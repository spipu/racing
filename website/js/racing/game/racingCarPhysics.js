/**
 * Physics of the player's car, as the original 68K runs it at 20 Hz (entity
 * $FF9000, see the project notes physics.md): one tick() = one original tick,
 * with its 16 / 32-bit integer arithmetic, collision with the course included.
 * Field names give the entity offset they mirror. Positions are in collision
 * units (1 = 2 scenery units), headings in 1/65536 turn.
 */
class RacingCarPhysics {
    /**
     * @param {object} physics - physics.json
     * @param {string} car     - car code
     * @param {boolean} manual - manual gearbox
     * @param {{index: int, collision: RacingCourseCollision, sectionPairs: int[][], sectionBytes: int[], crashSections: int[],
     *          racePath: int[][], pitPath: int[][]}} course - race.json course, its collision
     */
    constructor(physics, car, manual, course) {
        const data = physics.cars[car];
        this._common     = physics;
        this._car        = data;
        this._manual     = manual;
        this._torque     = (manual ? physics.torque.manual : physics.torque.automatic);
        this._drag       = (manual ? data.dragTable.manual : data.dragTable.automatic);
        this._params     = data.params;
        this._carIndex   = Object.keys(physics.cars).indexOf(car);
        this._sin        = physics.sinQuarter;
        this._probePages = data.probeOffsets;
        this._course     = course;

        this.displaySpeed = 0;      // +$04, km/h of the HUD
        this.speed        = 0;      // +$06
        this._maxSpeeds   = (manual ? data.maxSpeed.manual : data.maxSpeed.automatic); // by damage
        this.maxSpeed     = this._maxSpeeds[0]; // +$0A, solo
        this.damage       = 0;      // +$8A, frontal crashes on the courses with damage ($C826)
        this.damaging     = RacingCarPhysics.DAMAGE_COURSES.includes(course.index);
        this.acceleration = 0;      // +$0C
        this.throttle     = -51;    // +$0E
        this.brake        = 0;      // +$10
        this.crashTimer   = 0;      // +$14
        this.resistance   = 0;      // +$16
        this.shakeTimer   = 0;      // +$6A
        this.rpm          = 0;      // +$74
        this.grip         = RacingCarPhysics.GRIP_FULL; // +$78
        this.gear         = 0;      // +$7A
        this.smoothRpm    = 0;      // +$7E
        this.skidTimer    = 0;      // +$80
        this.spinTimer    = 0;      // +$82
        this.overrevTimer = 0;      // +$84
        this.crashRecovery = 0;     // +$8C
        this.backOnTrack  = 0;      // +$92
        this.drivenBackOnTrack = true; // the car driven back to the racing line while +$92 runs ($A470); false: steered
        this.speedState   = 0;      // +$A8
        this.throttleGate = RacingCarPhysics.THROTTLE_GATE_START; // $C0AC: the throttle opens while it is >= backOnTrack
        this.offRoadWheels = 0;     // $C31A
        this.sliding      = 0;      // $C31B

        this.x            = 0;      // +$30
        this.z            = 0;      // +$34
        this.heading      = 0;      // +$3C, 1/65536 turn
        this.pitch        = 0;      // +$3A, body pitch
        this.roll         = 0;      // +$3E, body roll
        this.shownHeading = 0;      // +$40, heading plus the slip
        this.roadHeading  = 0;      // +$1E
        this.slipInput    = 0;      // +$4C, from the previous tick
        this.probeHeights = [0, 0, 0]; // +$5A, +$5C, +$5E: smoothed heights under 3 wheel probes
        this.wallTimer    = 0;      // +$62
        this.yawGain      = 0x100;  // +$76
        this.steer        = 0;      // +$8E, 8.8
        this.yawRate      = 0;      // +$90
        this.slip         = 0;      // +$94
        this.shownSlip    = 0;      // +$96
        this.steerLoad    = 0;      // +$AA
        this.steerSpeed   = 0;      // $C000
        this.roadAlignTicks = 0;    // $C002
        this.steerSense   = 0;      // $C006

        this.height       = 0;      // +$32, smoothed ground height
        this.prevX        = 0;      // +$36
        this.prevZ        = 0;      // +$38
        this.prevShownHeading = 0;  // +$42
        this.flags        = 0;      // +$02: bit 13 / 12 = shock to play
        this.shake        = 0;      // +$6C, index in the shock table
        this.shakeYaw     = 0;      // +$6E
        this.crashPose    = [0, 0, 0, 0]; // +$9C lift, +$9E tumble, +$A0 yaw, +$A2 roll, by recovery tick
        this.bodyPitch    = 0;      // +$44, the body's own pose
        this.bodyYaw      = 0;      // +$46
        this.bodyRoll     = 0;      // +$4A
        this.sparksTimer  = 0;      // +$86
        this.sparksFast   = 0;      // +$BE
        this.grassLeftTimer  = 0;   // +$98
        this.grassRightTimer = 0;   // +$9A
        this.sandLeftTimer   = 0;   // +$E6
        this.sandRightTimer  = 0;   // +$E8
        this.centerSurface = 0;     // $C319, surface byte under the car
        this.wrongWay     = 0;      // $C312
        // $C00C smoke, $C018 flames, $C012 sparks, $C01E / $C024 grass, $C00E / $C010 sand: -1 = off.
        this.effectFrames = {smoke: -1, flames: -1, sparks: -1, grass: [-1, -1], sand: [-1, -1]};
        // x of the left and right tyre smoke ($FF617A / $FF618E, model units / 4), set by the Stock only; null: the
        // car's render slots.
        this.smokeX       = null;
        // Ticks each spray has played, -1 = off: its frame steps once a tick.
        this._sprayTicks  = {grass: [-1, -1], sand: [-1, -1]};
        this.wallHeading  = 0;      // +$64, heading of the deflection
        this.wallTurn     = 0;      // +$66
        this.wallSide     = 0;      // +$68
        this.roadOffset   = 0;      // +$72, side of the road point
        this.roadPoint    = [0, 0]; // +$20, +$22
        this.section      = 0;      // +$1D
        this.progress     = 0;      // +$24, index in the racing lines
        this.roadFlags    = 0;      // +$E5
        this.layer        = 0;      // +$E4: alternative collision layer (crossings)
        this.probeCodes   = [0, 0, 0, 0]; // +$56..+$59: 1 wall, 2 road, 4 verge, 8 grass, $10 sand
        this.probeFlags   = 0;      // +$55: the codes ORed
        this.offTrackTicks = 0;     // $C02A
        this.mode         = RacingCarPhysics.MODE_DRIVE; // $C07A
        // Pit stop: state $C05C[+$AE] (0 free, 1 driven to the box, 2 at work, 3 leaving), ticks of the work +$B0,
        // frame of the mechanics $C026 (-1: away), ticks before they go $C8AE; the race closes the pits once finished
        // ($C30E bit 5; bit 0 too, unused in Time Attack). Time Attack sets +$AC to 2 every tick: no limit of stops.
        this.pitState     = RacingCarPhysics.PIT_FREE;
        this.pitTicks     = 0;
        this.pitCrewFrame = -1;
        this.pitCrewAway  = 0;
        this._pitArrival  = false;
        // The game's crew sets the length of the work and repairs the car (releaseFromPit, setDamage); false: the
        // original's 120 ticks, repaired at frame 20 (the reference of the benches).
        this.pitWorkByCrew = false;
        this._pitReleased  = false;
        this.raceFlags    = 0;      // $C30E, set by the race: bit 4 started, bit 5 finished (bits 5 and 0 close the pits)
        // Laps ($7F50): laps done +$2C, line crossings +$2E, best progress of the lap +$28, progress of the tick
        // before +$26, laps of the race $C310; distance past the section point along the road +$E2 ($764E).
        this.laps         = RacingCarPhysics.RACE_LAPS;
        this.lap          = 0;
        this.lapLine      = 0;
        this.lapProgress  = 0;
        this.prevProgress = 0;
        this.roadAlong    = 0;
        // Events of the race raised by the tick ({type: 'lap'|'checkpoint', ...}), taken by the race.
        this.events       = [];
        // Sound commands of the original raised by the tick ('B1' skid...), taken by the game: the effects mailbox
        // $C8A4 (one a tick, the last written wins), the last command sent $C8A6 and the ticks before the slide
        // squeal may start again $C8A2; the pit jingles go through $C8A5.
        this.sounds       = [];
        this.lastSound    = null;
        this.squealTicks  = 0;
        this._mailbox     = null;
        this.respawnTicks = 0;      // $C02C
        this.respawnStep  = [0, 0, 0]; // +$4E, +$50, +$52: x, z, heading per tick
        // Probe results kept between ticks, as the entity keeps its polygon pointers.
        this._centerPolygon = null; // +$CE
        this._probePolygons = [null, null, null, null]; // +$D2, +$D6, +$DA, +$DE
        this._probeLocal    = [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]]; // $C0D0..$C0E2: center then probes
    }

    /**
     * On a start grid place: {x, height, z} in entity units, heading in 1/65536 turn.
     */
    place(x, height, z, heading) {
        this.x            = x;
        this.z            = z;
        this.height       = height;
        this.probeHeights = [height, height, height];
        this.heading      = heading;
        this.shownHeading = heading;

        return this.settle();
    }

    /**
     * Probes the ground under the car where it stands (race start, state loaded from elsewhere).
     */
    settle() {
        this._probe();
        this._roadInfo();
        this._roadSide();
        this._keepPrevious();

        return this;
    }

    /**
     * @param {{accelerate: boolean, brake: boolean, gearUp: boolean, gearDown: boolean, steer: int, steerAxis: (number|undefined)}} input
     *        steer: +1 left, -1 right; steerAxis: analog steering from -1 (right) to +1 (left), null or absent for a digital pad
     */
    tick(input) {
        // The variant is chosen once a tick: a carrying back or a crash met during a tick starts with the next one.
        const mode = this._lastTick('mode');
        // Every variant but the pit stop's starts with the body's own pose cleared: its probes are placed by the
        // body yaw the pit drive left.
        if (mode !== RacingCarPhysics.MODE_PIT) {
            this.bodyPitch = 0;
            this.bodyYaw   = 0;
            this.bodyRoll  = 0;
        }
        if (mode === RacingCarPhysics.MODE_PIT) {
            this._pitTick(input);
        } else if ((mode === RacingCarPhysics.MODE_RESPAWN) || (mode === RacingCarPhysics.MODE_CRASH)) {
            this._respawnTick();
        } else if (mode === RacingCarPhysics.MODE_INTRO) {
            this._introTick();
        } else if (mode === RacingCarPhysics.MODE_GRID) {
            this._gridTick(input);
        } else if (mode === RacingCarPhysics.MODE_FINISH) {
            this._finishTick();
        } else {
            this._slideSqueal();
            this._driveTick(input);
        }
        if (mode !== RacingCarPhysics.MODE_PIT) {
            this._surfaceSprays();
        }
        // The road under the car is read once a tick, after the variant: within a tick, it is that of the tick before.
        if (this._atTickEnd()) {
            this._roadInfo();
            if (mode !== RacingCarPhysics.MODE_PIT) {
                this._lapLine();
            }
            if ((mode !== RacingCarPhysics.MODE_PIT) && (mode !== RacingCarPhysics.MODE_GRID) && (mode !== RacingCarPhysics.MODE_FINISH)) {
                this._pitEntry();
            }
            // The race loop ($6444) checks the heading after every variant, a carrying back included, against the road
            // heading of this tick.
            this._wrongWayCheck();
            this._lapFlags();
            this._raceEnd();
            this._sendSound();
            if (mode !== RacingCarPhysics.MODE_PIT) {
                this._roadSide();
            }
        }
        if (mode !== RacingCarPhysics.MODE_PIT) {
            this._effects();
        }
    }

    // Variant $5AB6, the car driven.
    _driveTick(input) {
        this._shock();
        this._wallTimerEnd();
        this._crashRecoveryStep();
        this._timers();
        this._steering(input.steer, (input.steerAxis ?? null));
        this._forces();
        this._clampSpeed();
        this._gearbox(input);
        this._pedals(input);
        this._yaw();
        this._slide(input);
        this._offTrack();
        this._position();
        this._walls();
        this._sparks();
        this._bodyPose();
    }

    // Variant $6636 (table $659C): the car slid to the point of a section, the pad ignored ($4A0C). Carried back
    // (mode 8, $662A) its engine is stopped first and the forces are skipped ($C26C = 4 in the traces); after a
    // frontal crash (mode $1C) it keeps its speed under the crash drag, tumbling (+$9C..+$A2).
    _respawnTick() {
        // $49EE / $4A0C mask the pad copy the steering reads but write $FFFF in the raw pad $C970: the Stock's grip
        // ($99C8) sees B held.
        const idle = {accelerate: true, brake: false, gearUp: false, gearDown: false, steer: 0};
        const carried = (this.mode === RacingCarPhysics.MODE_RESPAWN);
        if (carried) {
            this.speed = 0;
            this.rpm   = 0;
        }
        this._shock();
        this._wallTimerEnd();
        this._crashRecoveryStep();
        this._timers();
        this._steering(idle.steer);
        if (!carried) {
            this._forces();
        }
        this._clampSpeed();
        this._gearbox(idle);
        this._slide(idle);
        this.heading      = this._angle(this.heading + this._scaled(this.respawnStep[2]));
        this.shownHeading = this._angle(this.heading + this.shownSlip);
        this.x            = this._word(this.x + this._scaled(this.respawnStep[0]));
        this.z            = this._word(this.z + this._scaled(this.respawnStep[1]));
        this._bodyPose();
        this._probe();
        this._heights();
        this.respawnTicks = this._countDown(this.respawnTicks);
        if (this.respawnTicks <= 0) {
            this.respawnTicks = 0;
            this.rpm          = 0;
            this.mode         = RacingCarPhysics.MODE_DRIVE;
        }
    }

    // Variant $6A3A (mode 16): the opening of the race, the car standing still and the pad ignored.
    _introTick() {
        const idle = RacingCarPhysics.IDLE_INPUT;
        this._crashRecoveryStep();
        this._timers();
        this._slide(idle);
        this._offTrack();
        this._position();
        this._walls();
        this._bodyPose();
    }

    // Variant $69D0 (mode 12): waiting for the start on the grid, the engine revving to the throttle ($A8F8); the
    // start bit of the race ($C30E bit 4) lets the car go from the next tick.
    _gridTick(input) {
        const idle = RacingCarPhysics.IDLE_INPUT;
        this._shock();
        this._wallTimerEnd();
        this._crashRecoveryStep();
        this._timers();
        this._slide(idle);
        this._offTrack();
        this._position();
        this._walls();
        this._sparks();
        this._bodyPose();
        this._pedals(input);
        this._idleRpm();
        if ((this.raceFlags & RacingCarPhysics.RACE_STARTED) !== 0) {
            this.mode = RacingCarPhysics.MODE_DRIVE;
        }
    }

    // Variant $6B04 (mode 24): after the finish the car drives itself, throttle held, automatic gearbox, on the
    // racing line of the getting back ($A470, +$92 = 2 each tick).
    _finishTick() {
        this.backOnTrack = RacingCarPhysics.FINISH_AUTOPILOT;
        const manual = this._manual;
        this._manual = false;
        this._driveTick(RacingCarPhysics.FINISH_INPUT);
        this._manual = manual;
    }

    // $85C4: the tyres squeal while the car slides (|+$94| > $20), again 32 ticks after the squeal was sent; the
    // squeal sent last is cut ($C8) once the slide is under $10.
    _slideSqueal() {
        if (this.squealTicks > 0) {
            this.squealTicks = this._countDown(this.squealTicks);
            if (this.squealTicks === 0) {
                this.lastSound = null;
            }
        }
        const slide = Math.abs(this.slip);
        if (slide <= RacingCarPhysics.SQUEAL_END) {
            if (this.lastSound === RacingCarPhysics.SOUND_SQUEAL) {
                this._sound(RacingCarPhysics.SOUND_SQUEAL_CUT);
            }
        } else if ((slide > RacingCarPhysics.SQUEAL_START) && (this.lastSound !== RacingCarPhysics.SOUND_SQUEAL) && (this.squealTicks === 0)) {
            this._sound(RacingCarPhysics.SOUND_SQUEAL);
            this.squealTicks = RacingCarPhysics.SQUEAL_TICKS;
        }
    }

    // Into the effects mailbox ($C8A4): the last one of the tick is sent.
    _sound(command) {
        this._mailbox = command;
    }

    // $20D6: the mailbox is sent at the end of the tick, nothing once the race is over ($C30E bit 5).
    _sendSound() {
        if (this._mailbox === null) {
            return;
        }
        if ((this.raceFlags & RacingCarPhysics.RACE_FINISHED) === 0) {
            this.sounds.push(this._mailbox);
            this.lastSound = this._mailbox;
        }
        this._mailbox = null;
    }

    // $7F50: the line crossed backwards takes a crossing back; forwards, a lap is done when the crossings come back to
    // it: the lap message ($C305 = 4), the split ($4000) unless through the pit lane, the finish after the last lap,
    // the last lap call ($BE). Otherwise $8004: a new best progress of the lap on a checkpoint polygon ($C319 bit 7)
    // shows the split.
    _lapLine() {
        const gap = (this.progress - this.prevProgress);
        if (gap > RacingCarPhysics.LINE_GAP) {
            this.lapLine--;
            return;
        }
        if (gap >= -RacingCarPhysics.LINE_GAP) {
            if ((this.lap === this.lapLine) && (this.progress > this.lapProgress)) {
                this.lapProgress = this.progress;
                if ((this.centerSurface & RacingCarPhysics.SURFACE_CHECKPOINT) !== 0) {
                    this.flags |= RacingCarPhysics.FLAG_SPLIT;
                }
            }
            return;
        }
        this.lapLine++;
        if ((this.lap + 1) !== this.lapLine) {
            return;
        }
        this.lap++;
        this.lapProgress = 0;
        const throughPits = (this.section > RacingCarPhysics.LINE_LAST_SECTION);
        if (!throughPits) {
            this.flags |= RacingCarPhysics.FLAG_SPLIT;
        }
        const finished = (this.lap > (this.laps - 1));
        this.events.push({type: 'lap', lap: this.lap, finished: finished, throughPits: throughPits});
        if (finished) {
            // Time Attack ($C80E bit 5) keeps the split of the last lap.
            this.raceFlags |= RacingCarPhysics.RACE_FINISHED;
            this.flags     |= RacingCarPhysics.FLAG_SPLIT;
        } else if ((this.lap === (this.laps - 1)) && (this.section < RacingCarPhysics.LINE_FINAL_CALL_SECTION)) {
            this._sound(RacingCarPhysics.SOUND_FINAL_LAP);
        }
    }

    // $6BEA: once finished, the timers stop and the car drives itself from the next tick.
    _raceEnd() {
        if (((this.raceFlags & RacingCarPhysics.RACE_FINISHED) === 0) || ((this.raceFlags & RacingCarPhysics.RACE_STARTED) === 0)) {
            return;
        }
        this.raceFlags &= ~RacingCarPhysics.RACE_STARTED;
        this.mode       = RacingCarPhysics.MODE_FINISH;
    }

    // Variant $6ACC (table $68A8, mode 4): the pit stop, the car driven by the pit state ($A8E0).
    _pitTick(input) {
        this._shock();
        this._wallTimerEnd();
        this._crashRecoveryStep();
        this._timers();
        this._pedals(input);
        this._probe();
        this._heights();
        if (this._atTickEnd()) {
            this._roadSide();
        }
        this._bodyPose();
        this._pitStep();
        // $9B54 before the gearbox and the slide: their timers show from the next tick.
        this._effects();
        this._gearbox(input);
        this._slide(input);
    }

    // $825C: the race loop takes the split flag of the tick (+$02 bit 14: a line crossed, a pit stop left) and, after a
    // pit stop, its flag (bit 9) with it.
    _lapFlags() {
        if ((this.flags & RacingCarPhysics.FLAG_SPLIT) === 0) {
            return;
        }
        this.flags &= ~RacingCarPhysics.FLAG_SPLIT;
        if ((this.flags & RacingCarPhysics.FLAG_PIT) !== 0) {
            this.flags &= ~RacingCarPhysics.FLAG_PIT;
            return;
        }
        // $8280: the split of a checkpoint (bits 6-7 of $C319: $80 the first, $C0 the second).
        const checkpoint = (this.centerSurface & RacingCarPhysics.SURFACE_CHECKPOINTS);
        if (checkpoint === RacingCarPhysics.SURFACE_CHECKPOINT) {
            this.events.push({type: 'checkpoint', checkpoint: 1});
        } else if (checkpoint === RacingCarPhysics.SURFACE_CHECKPOINTS) {
            this.events.push({type: 'checkpoint', checkpoint: 2});
        }
    }

    // $AC3E: the mechanics leave 60 ticks after the stop; the band across the pit lane (surface $0D) starts a stop,
    // unless the race closed the pits, the car is already in one or goes the wrong way.
    _pitEntry() {
        if (this.pitCrewAway > 0) {
            this.pitCrewAway = this._countDown(this.pitCrewAway);
            if (this.pitCrewAway === 0) {
                this.pitCrewFrame = -1;
            }
        }
        if (((this.centerSurface & RacingCarPhysics.SURFACE_CLASS) !== RacingCarPhysics.SURFACE_PIT) || ((this.raceFlags & RacingCarPhysics.RACE_PITS_CLOSED) !== 0) || (this.pitState !== RacingCarPhysics.PIT_FREE)
            || (this.wrongWay !== 0)) {
            return;
        }
        this.pitState = RacingCarPhysics.PIT_DRIVEN;
        this.mode     = RacingCarPhysics.MODE_PIT;
        this.flags   |= RacingCarPhysics.FLAG_PIT;
        this.sounds.push(RacingCarPhysics.SOUND_PIT_IN);
    }

    // $A8E0: the states of the stop.
    _pitStep() {
        switch (this.pitState) {
            case RacingCarPhysics.PIT_DRIVEN:
                this._pitApproach();
                break;
            case RacingCarPhysics.PIT_WORK:
                this._pitWork();
                break;
            case RacingCarPhysics.PIT_LEAVING:
                this._pitLeave();
                break;
            default:
                break;
        }
    }

    // $A972: driven to the box (the pad ignored), slower near it; on it, the car stops for 120 ticks.
    _pitApproach() {
        const w   = RacingCarPhysics._w;
        const pit = this._course.pit;
        const [boxX, boxZ] = pit.box;
        this.pitCrewFrame = 0;
        // Gap, aim and turn are those of the car as the tick began: a share of a tick does not cross a threshold early.
        const fromX = this._lastTick('x');
        const fromZ = this._lastTick('z');
        const gap   = w(boxZ - fromZ);
        if (gap < RacingCarPhysics.PIT_ARRIVAL) {
            this.x = boxX;
            this.z = boxZ;
            for (const name of ['heading', 'shownHeading', 'steer', 'yawRate', 'speed', 'displaySpeed', 'gear', 'backOnTrack', 'crashTimer', 'crashRecovery']) {
                this[name] = 0;
            }
            this.respawnTicks = 0;
            this.pitState     = RacingCarPhysics.PIT_WORK;
            this.pitTicks     = RacingCarPhysics.PIT_WORK_TICKS;
            this._forces();
            // The forces of the whole tick of the arrival; the work counts from the next tick.
            this._pitArrival = !this._atTickEnd();
            return;
        }
        let aim   = [boxX, boxZ];
        let speed = RacingCarPhysics.PIT_SLOW_KMH;
        if (gap > RacingCarPhysics.PIT_FAR) {
            aim   = [(boxX + pit.approachX), (boxZ - RacingCarPhysics.PIT_AIM_FAR)];
            speed = Math.min(((gap >> 4) + RacingCarPhysics.PIT_FAST_BASE), RacingCarPhysics.PIT_FAST_KMH);
        } else if (gap > RacingCarPhysics.PIT_MIDDLE) {
            aim   = [(boxX + pit.approachX), (boxZ - RacingCarPhysics.PIT_AIM_FAR)];
            speed = (((gap >> 4) * 2) + RacingCarPhysics.PIT_MIDDLE_BASE);
        } else if (gap > RacingCarPhysics.PIT_NEAR) {
            aim   = [boxX, (boxZ - RacingCarPhysics.PIT_AIM_NEAR)];
            speed = (((gap >> 4) * 3) + RacingCarPhysics.PIT_NEAR_BASE);
        }
        const heading = this._angleTo(aim, fromX, fromZ);
        const turn    = RacingCarPhysics._clamp(w(heading - this._lastTick('heading')), -RacingCarPhysics.PIT_TURN, RacingCarPhysics.PIT_TURN);
        this.heading = this._angle(this.heading + this._scaled(turn));
        // The heading of the whole tick snaps straight: a share of a tick has not turned it yet.
        if (this._atTickEnd() && (Math.abs(this.heading) < RacingCarPhysics.PIT_STRAIGHT)) {
            this.heading = 0;
        }
        this.steer        = turn;
        this.yawRate      = turn;
        this.bodyYaw      = w(-(turn * 2));
        this.shownHeading = this._angle(this.shownHeading + this._shiftShare(w(heading - this.shownHeading), 2));
        // km/h into speed units: x 1000 x 256 / 3600 / 20.
        const target = Math.trunc(Math.trunc((speed * RacingCarPhysics.PIT_METRES_PER_KM * 256) / RacingCarPhysics.PIT_SECONDS_PER_HOUR) / RacingCarPhysics.PIT_SPEED_DIVISOR);
        this.speed += this._scaled(RacingCarPhysics._clamp((target - this.speed), RacingCarPhysics.PIT_BRAKE, RacingCarPhysics.PIT_ACCELERATE));
        this._clampSpeed();
        // $6FDE moves the car over the whole tick with the speed and the heading it ends the tick with.
        this._advance(this._tickEndAngle(this.shownHeading, 'shownHeading'), this._tickEndSpeed(this.speed));
        this._forces();
    }

    // $AB88: the work, 120 ticks; the damage is repaired at frame 20 of the mechanics. Worked by the game's crew, the
    // car leaves at the end of the tick its crew is done in, as the countdown of the original ends it.
    _pitWork() {
        if (this._pitArrival) {
            this._forces();
            this._pitArrival = !this._atTickEnd();
            return;
        }
        if (this.pitWorkByCrew) {
            if (this._pitReleased && this._atTickEnd()) {
                this._pitReleased = false;
                this.pitState     = RacingCarPhysics.PIT_LEAVING;
            }
            this._idleRpm();
            return;
        }
        this.pitCrewFrame = RacingCarPhysics.crewFrame(RacingCarPhysics.PIT_WORK_TICKS - this.pitTicks);
        if ((this.pitCrewFrame >= RacingCarPhysics.PIT_REPAIR_FRAME) && (this.damage !== 0)) {
            this.setDamage(0);
        }
        this.pitTicks = this._countDown(this.pitTicks);
        if (this.pitTicks <= 0) {
            this.pitTicks = 0;
            this.pitState = RacingCarPhysics.PIT_LEAVING;
        }
        this._idleRpm();
    }

    // $ABCE: back to the driver, from the box; the mechanics leave 60 ticks later.
    _pitLeave() {
        this.flags      |= RacingCarPhysics.FLAG_SPLIT;
        this.pitState    = RacingCarPhysics.PIT_FREE;
        this.pitCrewAway = RacingCarPhysics.PIT_CREW_STAY;
        this.mode        = RacingCarPhysics.MODE_DRIVE;
        this.sounds.push(RacingCarPhysics.SOUND_PIT_OUT);
    }

    // $A8F8, car stopped: the engine revs towards the throttle (x 64), by $400 up or $300 down a tick.
    _idleRpm() {
        const step = RacingCarPhysics._clamp(((this.throttle << 6) - this.rpm), -RacingCarPhysics.IDLE_RPM_DOWN, RacingCarPhysics.IDLE_RPM_UP);
        this.rpm       = RacingCarPhysics._clamp((this.rpm + this._scaled(step)), 0, RacingCarPhysics.IDLE_RPM_MAX);
        this.smoothRpm = this.rpm;
    }

    /**
     * The pit of the player's place on a course (race.json pit): its box and the x offset of the approach.
     *
     * @returns {{box: int[], approachX: int}}
     */
    static coursePit(race, course) {
        return {box: race.pit.pitBoxes[course][0], approachX: race.pit.approachX[course]};
    }

    /**
     * $3BBB >> 16: frame of the mechanics after the given ticks of their work (7 frames in 30 ticks), the last held.
     */
    static crewFrame(ticks) {
        return Math.min(Math.floor((Math.max(0, ticks) * RacingCarPhysics.CREW_FRAME_RATE) / RacingCarPhysics.CREW_FRAME_ONE), RacingCarPhysics.CREW_LAST_FRAME);
    }

    // $A434: the Formula and the Prototype strike sparks on a surface byte 4 above 89 km/h (sound $B7), fast ones
    // from 200 km/h.
    _sparks() {
        if ((this._carIndex === RacingCarPhysics.CAR_STOCK) || (this.displaySpeed < RacingCarPhysics.SPARKS_SPEED) || (this.centerSurface !== RacingCarPhysics.SPARKS_SURFACE)
            || (this.sparksTimer !== 0)) {
            return;
        }
        this.sparksTimer = RacingCarPhysics.EFFECT_TICKS;
        this.sparksFast  = ((this.displaySpeed >= RacingCarPhysics.SPARKS_FAST_SPEED) ? 1 : 0);
        this._sound(RacingCarPhysics.SOUND_SPARKS);
    }

    // $7C4E: the rear wheels on grass or sand throw it for 15 ticks (sound $D2).
    _surfaceSprays() {
        if (this.displaySpeed === 0) {
            return;
        }
        const left  = this.probeCodes[RacingCarPhysics.PROBE_REAR_LEFT];
        const right = this.probeCodes[RacingCarPhysics.PROBE_REAR_RIGHT];
        const start = (name, code, bit) => {
            if ((this[name] === 0) && ((code & bit) !== 0)) {
                this[name] = RacingCarPhysics.EFFECT_TICKS;
                // Only into an empty mailbox.
                if (this._mailbox === null) {
                    this._sound(RacingCarPhysics.SOUND_GRASS);
                }
            }
        };
        start('grassLeftTimer', left, RacingCarPhysics.CODE_GRASS);
        start('grassRightTimer', right, RacingCarPhysics.CODE_GRASS);
        start('sandLeftTimer', left, RacingCarPhysics.CODE_SAND);
        start('sandRightTimer', right, RacingCarPhysics.CODE_SAND);
    }

    // $7F04: heading more than a quarter turn from the road's.
    _wrongWayCheck() {
        const gap = ((this.heading - this.roadHeading) & RacingCarPhysics.TURN_MASK);
        this.wrongWay = (((gap > RacingCarPhysics.QUARTER_TURN) && (gap < RacingCarPhysics.THREE_QUARTER_TURN)) ? 1 : 0);
    }

    // $9B54 / $9B82: frame of each effect model, -1 when off: tyre smoke after a skid or a spin, exhaust flames
    // after a down-shift, sparks, grass and sand thrown by each rear wheel (frames 0-3 above 120 km/h, 4-7 below).
    _effects() {
        const frames = this.effectFrames;
        frames.smoke  = -1;
        frames.flames = -1;
        frames.sparks = -1;
        const late       = RacingCarPhysics.EFFECT_SHORT_END;
        const smokeTimer = ((this.skidTimer > late) ? this.skidTimer : ((this.spinTimer > late) ? this.spinTimer : 0));
        if (smokeTimer > 0) {
            frames.smoke = Math.trunc(RacingCarPhysics.EFFECT_TICKS - smokeTimer);
        }
        if ((this.overrevTimer > 0) && (this.overrevTimer <= RacingCarPhysics.OVERREV_TICKS)) {
            frames.flames = Math.trunc(RacingCarPhysics.OVERREV_TICKS - this.overrevTimer);
        }
        const played = this._sprayTicks;
        const spray  = (kind, side, timer) => {
            if ((this.displaySpeed <= RacingCarPhysics.SPRAY_SPEED) || (timer === 0)) {
                played[kind][side] = -1;
                return -1;
            }
            played[kind][side] = ((played[kind][side] < 0) ? 0 : (played[kind][side] + this._scaled(1)));
            return ((Math.floor(played[kind][side]) & 3) + ((this.displaySpeed > RacingCarPhysics.SPRAY_FAST_SPEED) ? 0 : 4));
        };
        frames.grass = [spray('grass', 0, this.grassLeftTimer), spray('grass', 1, this.grassRightTimer)];
        frames.sand  = [spray('sand', 0, this.sandLeftTimer), spray('sand', 1, this.sandRightTimer)];
        const table  = (this.sparksFast ? RacingCarPhysics.SPARKS_FAST_FRAMES : RacingCarPhysics.SPARKS_FRAMES);
        const first  = (this.sparksFast ? 0 : late);
        if (this.sparksTimer > first) {
            frames.sparks = table[RacingCarPhysics.EFFECT_TICKS - Math.ceil(this.sparksTimer)];
        }
    }

    // $70AA: the body's roll from the front probes' heights, its pitch from the left ones, and the side slip input
    // of the next tick.
    // The body's own pose comes first: tumble (+$44), yaw offset of the slip, the shock spin and the crash (+$46),
    // roll of the turn and the crash (+$4A), with the side slip input of the previous tick.
    _bodyPose() {
        const w = RacingCarPhysics._w;
        const heights = this.probeHeights;
        this.roll  = this._tilt(this._common.rollTable, (heights[RacingCarPhysics.PROBE_FRONT_RIGHT] - heights[RacingCarPhysics.PROBE_FRONT_LEFT]));
        this.pitch = this._tilt(this._common.pitchTable, (heights[RacingCarPhysics.PROBE_REAR_LEFT] - heights[RacingCarPhysics.PROBE_FRONT_LEFT]));
        this.bodyRoll  = w(w(((-this.steer) * this.displaySpeed) >> 15) + this.crashPose[3]);
        this.bodyPitch = this.crashPose[1];
        this.bodyYaw   = w(((this.crashPose[2] !== 0) ? this.crashPose[2] : w((this.slip << 3) + this.shakeYaw)) + this.slipInput);
        this.slipInput = RacingCarPhysics._w(((-(this.steer >> 8)) * this.displaySpeed) >> 5);
    }

    // $A350: a shock (car contact, spin) shakes the car for 30 ticks and closes the throttle.
    _shock() {
        if (this.shakeTimer > 0) {
            this.shakeYaw   = this._shakeYawAt(this.shake);
            this.shakeTimer = this._countDown(this.shakeTimer);
            this.shake     += this._scaled(1);
            return;
        }
        // The shock bits set during a tick are read at the start of the next one.
        if (!this._atTickStart()) {
            return;
        }
        if ((this.flags & RacingCarPhysics.FLAG_SHOCK_HARD) !== 0) {
            this.flags &= ~RacingCarPhysics.FLAG_SHOCK_HARD;
            this.shake      = RacingCarPhysics.SHOCK_TICKS;
            this.shakeTimer = RacingCarPhysics.SHOCK_TICKS;
            this.crashTimer = RacingCarPhysics.SHOCK_TICKS;
            this.throttle   = 0;
        } else if ((this.flags & RacingCarPhysics.FLAG_SHOCK) !== 0) {
            this.flags &= ~RacingCarPhysics.FLAG_SHOCK;
            this.throttle   = 0;
            this.shake      = 0;
            this.shakeTimer = RacingCarPhysics.SHOCK_TICKS;
            this.crashTimer = RacingCarPhysics.SHOCK_TICKS;
        }
    }

    // Yaw of the shake table at a shake position, a whole tick for the original.
    _shakeYawAt(position) {
        const table = this._common.shakeTable;

        return table[Math.min(Math.trunc(position), (table.length - 1))];
    }

    // Pose of the crash table ($939EEC: lift, tumble, yaw, roll) at a recovery position, a whole tick for the original.
    _crashPoseAt(position) {
        return this._common.crashRecovery[Math.ceil(position)].slice();
    }

    // $8170: end of a wall deflection, the throttle held back a while.
    _wallTimerEnd() {
        if (this.wallTimer <= 0) {
            return;
        }
        this.wallTimer = this._endCountDown(this.wallTimer);
        if ((this.wallTimer !== 0) || this._bridgeCrossing(RacingCarPhysics.BRIDGE_LAST_WALL)) {
            return;
        }
        this.throttleGate = ((this._carIndex === RacingCarPhysics.CAR_PROTOTYPE) ? RacingCarPhysics.THROTTLE_GATE_PROTOTYPE : RacingCarPhysics.THROTTLE_GATE_WALL);
        this.backOnTrack  = RacingCarPhysics.BACK_ON_TRACK_TICKS;
        this.shownHeading = this.heading;
    }

    // $80CC: after a frontal crash, the car restarts at a minimum speed.
    _crashRecoveryStep() {
        if (this.crashRecovery === 0) {
            return;
        }
        this.crashPose     = this._crashPoseAt(this.crashRecovery);
        this.crashRecovery = this._endCountDown(this.crashRecovery);
        if (this.crashRecovery > 0) {
            return;
        }
        this.crashRecovery = 0;
        this.crashPose     = [0, 0, 0, 0];
        this.speed = Math.max(this.speed, RacingCarPhysics.CRASH_RESTART_SPEED);
        if (this._bridgeCrossing(RacingCarPhysics.BRIDGE_LAST_CRASH)) {
            return;
        }
        this.throttleGate = RacingCarPhysics.THROTTLE_GATE_CRASH;
        this.backOnTrack  = RacingCarPhysics.BACK_ON_TRACK_TICKS;
        this.shownHeading = this.heading;
    }

    // The bridge of Bay Bridge (on its side lanes, progress $69..last) skips the throttle hold.
    _bridgeCrossing(last) {
        return (this._onBayBridge() && this._onSideLane() && (this.progress >= RacingCarPhysics.BRIDGE_FIRST) && (this.progress <= last));
    }

    _onBayBridge() {
        return (this._course.index === RacingCarPhysics.COURSE_BAY_BRIDGE);
    }

    // Road flags 2 / 4: the pit lane, the lanes of the bridge on Bay Bridge.
    _onSideLane() {
        return ((this.roadFlags & RacingCarPhysics.ROAD_SIDE_LANES) !== 0);
    }

    // Shaken or recovering from a crash: the pedals and the gears are taken over.
    _controlsLocked() {
        return ((this.shakeTimer !== 0) || (this.crashRecovery !== 0));
    }

    // $8548
    _timers() {
        for (const name of ['grassLeftTimer', 'grassRightTimer', 'sparksTimer', 'skidTimer', 'spinTimer', 'overrevTimer', 'sandLeftTimer', 'sandRightTimer']) {
            if (this[name] > 0) {
                this[name] = this._countDown(this[name]);
            }
        }
    }

    // $94FA. The original pad is digital: the steering speed ramps by steps. An analog stick sets it directly to its
    // deflection (user specification), then goes through the same dead zone, bound and smoothing.
    _steering(sense, axis = null) {
        const table = RacingCarPhysics.STEER_STEP;
        // Change of the steering speed over a tick, for the time hooks.
        let rate = 0;
        if (axis !== null) {
            this.steerSense = Math.sign(axis);
            this.steerSpeed = Math.round(axis * RacingCarPhysics.STEER_SPEED_MAX);
        } else if (sense !== this.steerSense) {
            // Released (sense 0), the steering speed zeroed on the change stays so.
            this.steerSense = sense;
            this.steerSpeed = (table * sense);
            this.steer      = RacingCarPhysics._w(this.steerSpeed << 8);
            this._steerBase = this.steer;
            this._steerChanged();
        } else if ((sense !== 0) && !this._steerChangedThisTick()) {
            let step = (table * sense);
            // The sign test of EOR.W: same signs, a zero slip counting as positive.
            if ((this._carIndex !== RacingCarPhysics.CAR_FORMULA) && ((this._lastTick('slip') < 0) === (step < 0))) {
                step >>= 1;
                this.slip = this._decay(this.slip, 3);
            }
            this.steerSpeed += this._scaled(step);
            rate = step;
        }
        this.steerSpeed = RacingCarPhysics._clamp(this.steerSpeed, -RacingCarPhysics.STEER_SPEED_MAX, RacingCarPhysics.STEER_SPEED_MAX);
        const speed = this.steerSpeed;
        // The original only drops the small positive speeds: its negative branch skips the test.
        if ((speed >= 0) && (speed < table)) {
            this.steerSpeed = 0;
        }
        // The steering goes halfway to the steering speed reached at the end of the tick.
        const ahead  = RacingCarPhysics._clamp(this._tickEnd(speed, rate), -RacingCarPhysics.STEER_SPEED_MAX, RacingCarPhysics.STEER_SPEED_MAX);
        this._steerAim = (ahead << 8);
        const target = this._halfway(this.steer, this._steerAim);
        this.steerLoad = RacingCarPhysics._clamp((this.steerLoad + (Math.abs(RacingCarPhysics._w(target - this.steer)) >> 8)), 0, RacingCarPhysics.STEER_LOAD_MAX);
        this.steer     = ((Math.abs(RacingCarPhysics._w(target)) < table) ? 0 : RacingCarPhysics._w(target));
    }

    // $9312: engine force against the drag and the brake, into the speed.
    _forces() {
        const brakeLimit    = this._params.C0EC;
        const tractionLimit = this._params.C0EA;
        const rpm  = RacingCarPhysics._clamp(this._lastTick('rpm'), 0, RacingCarPhysics.RPM_MAX);
        const tq   = this._torque[rpm >> 7];
        let force  = ((tq * this._car.gears[this._lastTick('gear')]) >>> 5);
        force = ((RacingCarPhysics._w(force) * this._lastTick('throttle')) >> 7);
        if (force <= 0) {
            force = Math.min(force, RacingCarPhysics.MIN_ENGINE_FORCE);
        }
        const r = this._resistanceForce();
        this.resistance = RacingCarPhysics._w(r);
        force -= (r << 4);
        force -= ((this._lastTick('brake') * RacingCarPhysics.BRAKE_FORCE) >> 7);
        if (force < 0) {
            force *= 2;
        }

        this.grip = RacingCarPhysics.GRIP_FULL;
        if (force <= -brakeLimit) {
            if ((this.skidTimer === 0) && (force <= (-2 * brakeLimit)) && (this.crashRecovery === 0) && (this._lastTick('displaySpeed') > RacingCarPhysics.SKID_SPEED)) {
                this.skidTimer = RacingCarPhysics.EFFECT_TICKS;
                this._sound(RacingCarPhysics.SOUND_SKID);
            }
            force = -brakeLimit;
        } else if (force > tractionLimit) {
            const q = RacingCarPhysics._divs(((force - tractionLimit) << 8), tractionLimit);
            this.grip -= q;
            if (q > RacingCarPhysics.GRIP_SPIN_MIN) {
                this.grip = RacingCarPhysics.GRIP_SPIN_MIN;
            }
            if ((this.gear === 0) && (this.spinTimer === 0)) {
                this.spinTimer = RacingCarPhysics.EFFECT_TICKS;
                this._sound(RacingCarPhysics.SOUND_WHEELSPIN);
            }
        }
        force = ((RacingCarPhysics._w(force >> 1) * this.grip) >> 7);
        const dv = RacingCarPhysics._divs((RacingCarPhysics._w(force) >> 2), RacingCarPhysics.SPEED_DIVISOR);
        this.acceleration = dv;
        this.speed += this._scaled(dv);
        if (this.speed < 0) {
            this.speed = 0;
        }
        this.rpm = Math.min((((this._car.gears[this.gear] * this.speed) * RacingCarPhysics.RPM_FACTOR) >>> 12), RacingCarPhysics.RPM_MAX);
    }

    // The drag of the speed (scaled by C0E6), more over the speed limit, off the road, sliding or after a shock.
    _resistanceForce() {
        const table        = this._drag;
        const displaySpeed = this._lastTick('displaySpeed');
        const offRoad      = this._lastTick('offRoadWheels');
        let r = ((table[Math.min(Math.trunc(displaySpeed), (table.length - 1))] * this._params.C0E6) >> 8);
        if (this.damaging) {
            // $9474: the damage adds a sixteenth of drag a crash.
            r = RacingCarPhysics._w(((RacingCarPhysics.DAMAGE_DRAG_BASE + this.damage) * r) >> 4);
        }
        if (this.speedState > 4) {
            r = ((11 * r) >> 4);
        } else if ((this.speedState !== 0) && (this.speed > this.maxSpeed)) {
            r += (r >> 1);
        }
        if (offRoad !== 0) {
            let extra = (((displaySpeed * displaySpeed) >>> 4));
            if (offRoad <= 2) {
                extra >>= 1;
            }
            r += extra;
        }
        if (this._lastTick('sliding') !== 0) {
            r += ((r >> 1) + (r >> 2));
        }
        if (this.crashTimer > 0) {
            this.crashTimer = this._countDown(this.crashTimer);
            r += RacingCarPhysics.CRASH_DRAG;
        }

        return r;
    }

    // $9B12
    _clampSpeed() {
        const speed = (((this.speedState === 0) && (this.speed > this.maxSpeed)) ? this.maxSpeed : this.speed);
        this.displaySpeed = ((speed * RacingCarPhysics.DISPLAY_FACTOR) >> 8);
    }

    // $9182
    _gearbox(input) {
        const ratios = this._common.gearRatios;
        if (this._controlsLocked()) {
            // Throttle closed, the automatic down-shift only.
            this.throttle = RacingCarPhysics.THROTTLE_MIN;
            this._downshift();
        } else if (this._manual) {
            if (input.gearUp) {
                if (this.gear < RacingCarPhysics.TOP_GEAR) {
                    this._upshift();
                }
            } else if (input.gearDown && (this.gear > 0)) {
                this.gear--;
                this.rpm = Math.trunc((this.rpm << 8) / ratios[this.gear]);
                if (this.rpm > RacingCarPhysics.RPM_MAX) {
                    this.rpm = RacingCarPhysics.RPM_MAX;
                    if (this.overrevTimer === 0) {
                        this.overrevTimer = RacingCarPhysics.OVERREV_TICKS;
                    }
                    this.brake = RacingCarPhysics.PEDAL_MAX;
                }
            }
        } else if ((this.displaySpeed !== 0) && (this.rpm > this._common.upshiftRpm[this.gear])) {
            this._upshift();
        } else {
            this._downshift();
        }
        const smoothStep = this._scaled(RacingCarPhysics.RPM_SMOOTH_STEP);
        this.smoothRpm += RacingCarPhysics._clamp((this.rpm - this.smoothRpm), -smoothStep, smoothStep);
    }

    // A high revving up-shift in the low gears squeals (sound $B4).
    _upshift() {
        this.rpm = ((this.rpm * this._common.gearRatios[this.gear]) >>> 8);
        this.gear++;
        if ((this.rpm >= RacingCarPhysics.SQUEAL_RPM) && (this.gear < RacingCarPhysics.SQUEAL_GEARS) && (this.spinTimer === 0)) {
            this.spinTimer = RacingCarPhysics.EFFECT_TICKS;
            this._sound(RacingCarPhysics.SOUND_WHEELSPIN);
        }
    }

    _downshift() {
        if (this.rpm >= this._common.downshiftRpm[this.gear]) {
            return;
        }
        this.gear--;
        this.rpm = RacingCarPhysics._divs((this.rpm << 8), this._common.gearRatios[this.gear]);
        if (this.overrevTimer === 0) {
            this.overrevTimer = RacingCarPhysics.OVERREV_TICKS;
        }
    }

    // $961E
    _pedals(input) {
        if (this._controlsLocked()) {
            return;
        }
        const step = this._scaled(RacingCarPhysics.PEDAL_STEP);
        const open = (input.accelerate && (this.throttleGate >= this.backOnTrack));
        this.throttle = RacingCarPhysics._clamp((this.throttle + (open ? step : -step)), RacingCarPhysics.THROTTLE_MIN, RacingCarPhysics.PEDAL_MAX);
        this.brake    = RacingCarPhysics._clamp((this.brake + (input.brake ? step : -step)), 0, RacingCarPhysics.PEDAL_MAX);
    }

    // $9688: turn rate from the steering and the speed, pull towards the road heading, yaw gain.
    _yaw() {
        const w  = RacingCarPhysics._w;
        let rate = (Math.floor(this._tickEndSteer(this.steer)) >> 4);
        rate     = w(rate + RacingCarPhysics._divs((rate * w(RacingCarPhysics.YAW_SPEED - this.speed)), RacingCarPhysics.YAW_SPEED));
        this.yawRate = rate;
        let y = rate;
        if (this.displaySpeed < RacingCarPhysics.YAW_LOW_SPEED) {
            const sin = w(this._sinOf(w((this.displaySpeed << 7) + RacingCarPhysics.HALF_TURN)) + RacingCarPhysics.SIN_ONE);
            y = w(w((sin * rate) >> 6) + rate);
        }
        y = w((y * this.displaySpeed) >> 10);
        let gain = this._lastTick('yawGain');
        if (this.acceleration < 0) {
            gain = w(gain - (2 * this.acceleration));
        }
        y = w((y * gain) >> 8);
        if (this.backOnTrack > 0) {
            y = w((y * (RacingCarPhysics.BACK_ON_TRACK_TICKS - this.backOnTrack)) >> 5);
        }
        let turn = w(y + (y >> 1));
        if (this._lastTick('sliding') !== 0) {
            turn = w(turn + (y >> 1));
        }
        this.heading = this._angle(this.heading + this._scaled(turn));
        this._roadAlign();
        this._yawGainUpdate();
    }

    // Close to the road heading for 4 ticks, the car is pulled onto it.
    _roadAlign() {
        const w   = RacingCarPhysics._w;
        const gap = w(this.heading - this.roadHeading);
        if (RacingCarPhysics._absWord(gap) < RacingCarPhysics.ROAD_ALIGN_ANGLE) {
            this.roadAlignTicks += this._scaled(1);
            if (this.roadAlignTicks >= RacingCarPhysics.ROAD_ALIGN_TICKS) {
                const pull = RacingCarPhysics._clamp(w(this.roadHeading - this.shownHeading), -RacingCarPhysics.ROAD_ALIGN_STEP, RacingCarPhysics.ROAD_ALIGN_STEP);
                this.heading = this._angle(this.heading + this._scaled(pull));
            }
        } else {
            this.roadAlignTicks = 0;
        }
    }

    // The yaw gain of the next tick: up with the roll of the road, down with the turn rate at speed and the braking,
    // settling slowly once the steering is at rest.
    _yawGainUpdate() {
        const w       = RacingCarPhysics._w;
        const gainMax = this._params.C0E8;
        const heights = this._lastTick('probeHeights');
        let probe     = w(heights[RacingCarPhysics.PROBE_FRONT_RIGHT] - heights[RacingCarPhysics.PROBE_FRONT_LEFT]);
        let rateAbs = this.yawRate;
        if (rateAbs < 0) {
            probe   = w(-probe);
            rateAbs = w(-rateAbs);
        }
        probe = RacingCarPhysics._clamp(probe, RacingCarPhysics.PROBE_MIN, RacingCarPhysics.PROBE_MAX);
        let d = (w(w(probe << 4) * 5) >> 8);
        const fast  = w(this.speed * 20);
        let damping = w((w((fast * fast) >> 16) * rateAbs) >> 13);
        damping     = (damping >> 3);
        damping     = w(damping + (damping >> 1));
        d = w(d + RacingCarPhysics.YAW_GAIN_BASE - damping);
        d = w(d + RacingCarPhysics._clamp(w(w(-this.acceleration) << 4), RacingCarPhysics.YAW_BRAKE_MIN, RacingCarPhysics.YAW_BRAKE_MAX));
        d = Math.min(Math.max(d, RacingCarPhysics.YAW_GAIN_MIN), gainMax);
        if (this.steerLoad > 0) {
            this.steerLoad -= this._scaled(RacingCarPhysics.STEER_LOAD_EASE);
        }
        // Down by 12 a tick at most, while settled.
        const fall = this._scaled(RacingCarPhysics.YAW_GAIN_STEP);
        if ((this.steerLoad <= RacingCarPhysics.STEER_LOAD_SETTLED) && (w(this.yawGain - d) > fall)) {
            this.yawGain -= fall;
        } else {
            this.yawGain = d;
        }
    }

    // $980C: side slip, one routine per car.
    _slide(input) {
        switch (this._carIndex) {
            case RacingCarPhysics.CAR_STOCK:
                this._slideStock(input);
                return;
            case RacingCarPhysics.CAR_PROTOTYPE:
                this._slidePrototype();
                return;
            default:
                this._slideFormula();
        }
    }

    // $9818
    _slideFormula() {
        const w = RacingCarPhysics._w;
        const slipInput = this._lastTick('slipInput');
        if ((this.backOnTrack === 0) && (this.wallTimer === 0) && (Math.abs(slipInput) > RacingCarPhysics.SLIP_THRESHOLD)) {
            const q = (slipInput >> 7);
            this.slip      = this._word(this.slip + this._scaled(w(q + (q >> 1))));
            this.shownSlip = (this.slip >> 1);
            return;
        }
        const before = this.slip;
        this.slip      = this._decay(this.slip, 2);
        this.shownSlip = this.slip;
        this._slipRest(before);
    }

    // $99AA: grip lost by braking while steering, and by full throttle above 200 km/h.
    _slideStock(input) {
        const w           = RacingCarPhysics._w;
        const slipDivisor = this._params.C0EE;
        const slideLimit  = this._params.C0F0;
        const slipTurn    = this._params.C0F6;
        this.smokeX = [RacingCarPhysics.STOCK_SMOKE_X, RacingCarPhysics.STOCK_SMOKE_X];
        let loss = ((Math.abs(this.steerSpeed) * this.brake) >> 7);
        if ((this.displaySpeed > RacingCarPhysics.STOCK_FAST_SPEED) && input.accelerate) {
            loss = w(loss + w((RacingCarPhysics.PEDAL_MAX - this.throttle) << 3));
        }
        this.grip = RacingCarPhysics._clamp(w(this.grip - loss), RacingCarPhysics.STOCK_GRIP_MIN, RacingCarPhysics.STOCK_GRIP_MAX);
        const slipInput = this._lastTick('slipInput');
        if ((this.backOnTrack !== 0) || (this.wallTimer !== 0) || (Math.abs(slipInput) <= RacingCarPhysics.SLIP_THRESHOLD)) {
            const base = this._slipDamp(RacingCarPhysics.STOCK_DAMP_MIN);
            this.shownSlip = w((this.slip >> 1) + this.slip);
            this._slipRest(base);
            return;
        }
        let push = RacingCarPhysics._divs(((slipInput * w((2 * RacingCarPhysics.GRIP_FULL) - this.grip)) >> 8), slipDivisor);
        if (Math.abs(this.slip) > slideLimit) {
            push >>= 1;
        }
        this.slip      = this._word(this.slip + this._scaled(push));
        this.shownSlip = w(this.slip * 2);
        const size = Math.abs(this.slip);
        if (size >= RacingCarPhysics.STOCK_SKID_SLIP) {
            // $9A54: the smoke moves towards the side the car slides to.
            const shift = ((this.slip < 0) ? RacingCarPhysics.STOCK_SMOKE_MOVE : -RacingCarPhysics.STOCK_SMOKE_MOVE);
            this.smokeX = [(RacingCarPhysics.STOCK_SMOKE_X + shift), (RacingCarPhysics.STOCK_SMOKE_X - shift)];
            if (this.skidTimer < RacingCarPhysics.STOCK_SKID_MAX) {
                this.skidTimer += this._scaled(RacingCarPhysics.STOCK_SKID_STEP);
            }
        }
        this.heading = this._angle(this.heading - this._scaled((this.slip * slipTurn) >> 8));
        this._spinOut(size);
    }

    // $987E: grip lost by braking while steering; past C0F0 the car slides ($C31B).
    _slidePrototype() {
        const w           = RacingCarPhysics._w;
        const slipDivisor = this._params.C0EE;
        const slideLimit  = this._params.C0F0;
        const slipTurn    = this._params.C0F6;
        const loss = (w(Math.abs(this.steerSpeed) * this.brake) >> 8);
        this.grip    = Math.max(w(this.grip - loss), RacingCarPhysics.PROTOTYPE_GRIP_MIN);
        this.sliding = 0;
        const slipInput = this._lastTick('slipInput');
        if ((this.backOnTrack !== 0) || (this.wallTimer !== 0) || (Math.abs(slipInput) <= RacingCarPhysics.SLIP_THRESHOLD)) {
            const base = this._slipDamp(RacingCarPhysics.PROTOTYPE_DAMP_MIN);
            this.shownSlip = this.slip;
            this._slipRest(base);
            return;
        }
        const size = Math.abs(this.slip);
        let push   = RacingCarPhysics._divs(slipInput, slipDivisor);
        if (size <= slideLimit) {
            this.slip      = this._word(this.slip + this._scaled((push * w((2 * RacingCarPhysics.GRIP_FULL) - this.grip)) >> 8));
            this.shownSlip = (this.slip >> 1);
            return;
        }
        this.sliding = 1;
        push = (push >> 2);
        this.slip      = this._word(this.slip + this._scaled(w(push + (push >> 1))));
        this.shownSlip = this.slip;
        this.heading   = this._angle(this.heading - this._scaled((this.slip * slipTurn) >> 8));
        if (this._spinOut(Math.abs(this.slip))) {
            this.sliding = 0;
        }
    }

    // A slip past C0F2 spins the car (shock bit 13 to the left, 12 to the right, sound $B2).
    _spinOut(size) {
        const spinLimit = this._params.C0F2;
        if ((size < spinLimit) || this._controlsLocked()) {
            return false;
        }
        this.flags |= ((this.slip < 0) ? RacingCarPhysics.FLAG_SHOCK_HARD : RacingCarPhysics.FLAG_SHOCK);
        this._sound(RacingCarPhysics.SOUND_SPIN);
        return true;
    }

    // Slip damping of the Stock and the Prototype: a C0F4 share of at least the given size, never past zero. The shown
    // slip is taken before the small slip stops (_slipRest).
    // @returns {int} the size the share was taken of
    _slipDamp(minimum) {
        const w     = RacingCarPhysics._w;
        const share = this._params.C0F4;
        const base  = ((this.slip >= 0) ? Math.max(this.slip, minimum) : Math.min(this.slip, -minimum));
        const damp  = this._scaled(w((base * share) >> 8));
        this.slip  = this._word(this.slip - damp);
        // Damped past zero (EOR.W of the signs, zero counting as positive).
        if ((this.slip < 0) !== (damp < 0)) {
            this.slip = 0;
        }

        return base;
    }

    // A small slip that does not grow any more stops.
    _slipRest(reference) {
        const before = Math.abs(reference);
        const now    = Math.abs(this.slip);
        if ((before >= now) && (now <= RacingCarPhysics.SLIP_REST)) {
            this.slip = 0;
        }
    }

    // $7E7A: no probe on the road for 80 ticks: the car is stopped and carried back.
    _offTrack() {
        if ((this._lastTick('probeFlags') & RacingCarPhysics.CODE_ROAD) !== 0) {
            this.offTrackTicks = 0;
            return;
        }
        this.offTrackTicks += this._scaled(1);
        if (this.offTrackTicks > RacingCarPhysics.OFF_TRACK_TICKS) {
            this.offTrackTicks = 0;
            this.speed = 0;
            this._respawn(this.section, RacingCarPhysics.RESPAWN_TICKS);
        }
    }

    // $6F98
    _position() {
        if (this.wallTimer !== 0) {
            this._deflect();
            this._probe();
        } else if ((this.backOnTrack > 0) && this._drivenBack()) {
            this.backOnTrack = this._countDown(this.backOnTrack);
            if (this.speed !== 0) {
                this._autopilot();
            }
            this._probe();
        } else {
            // Not driven back: the player steers while the throttle gate and the yaw still follow +$92.
            if (this.backOnTrack > 0) {
                this.backOnTrack = this._countDown(this.backOnTrack);
            }
            const fromX = this.x;
            const fromZ = this.z;
            this.shownHeading = this._angle(this.heading + this.shownSlip);
            this._advance(this._angle(this._tickEndAngle(this.heading, 'heading') + this._tickEndShownSlip()), this._tickEndSpeed(this.speed));
            this._collide(fromX, fromZ);
        }
        this._heights();
    }

    // $A470: back on the track, the car follows the opponents' racing line (the pit lane's in the pits), aiming
    // 2 points ahead; the comparison with the car ahead finds the player itself and never acts.
    _autopilot() {
        const w      = RacingCarPhysics._w;
        const path   = (this._onSideLane() ? this._course.pitPath : this._course.racePath);
        const target = path[Math.min((this.progress + RacingCarPhysics.PATH_AHEAD), (path.length - 1))];
        const abs    = RacingCarPhysics._absWord;
        const spread = w(abs(w(target[0] - this.x)) + abs(w(target[1] - this.z)));
        let divisor  = (RacingCarPhysics._divs((spread << 4), w(this.speed + 1)) >> 1);
        if (divisor <= 0) {
            divisor = 1;
        } else if ((this._lastTick('probeFlags') & RacingCarPhysics.CODE_WALL) !== 0) {
            divisor = 2;
        }
        const aim = this._angleTo(target);
        this.shownHeading = this._angle(this.shownHeading + this._shareOf(w(aim - this.shownHeading), divisor));
        this.heading      = this.shownHeading;
        const angle = w(-this._tickEndAngle(this.shownHeading, 'heading'));
        this.x = this._word(this.x + this._scaled(w((this._sinOf(angle) * this.speed) >> 8) >> 4));
        this.z = this._word(this.z + this._scaled(w((this._cosOf(angle) * this.speed) >> 8) >> 4));
    }

    // $A7A0: heading from the car (or another place) to a point.
    _angleTo(point, fromX = this.x, fromZ = this.z) {
        const w  = RacingCarPhysics._w;
        const dx = w(fromX - point[0]);
        const dz = w(point[1] - fromZ);
        if (dz === 0) {
            return ((dx > 0) ? RacingCarPhysics.QUARTER_TURN : ((dx < 0) ? -RacingCarPhysics.QUARTER_TURN : 0));
        }
        const ratio = Math.trunc((dx << 8) / dz);
        if ((ratio > 0x7FFF) || (ratio < -0x8000)) {
            return ((dx < 0) ? -RacingCarPhysics.QUARTER_TURN : RacingCarPhysics.QUARTER_TURN);
        }
        let angle = this._atan(ratio);
        if (dz < 0) {
            angle = w(angle + RacingCarPhysics.HALF_TURN);
        }
        return angle;
    }

    // $8FC8: arctangent of a ratio in 8.8, two tables then a coarse slope; 1/65536 turn.
    _atan(ratio) {
        const value = Math.abs(ratio);
        let angle;
        if (value < RacingCarPhysics.ATAN_LOW_END) {
            angle = this._common.atanLow[value >> 2];
        } else if (value < RacingCarPhysics.ATAN_HIGH_END) {
            angle = this._common.atanHigh[(value - RacingCarPhysics.ATAN_LOW_END) >> 4];
        } else if (value < RacingCarPhysics.ATAN_SLOPE_END) {
            angle = ((value >> 11) + RacingCarPhysics.ATAN_SLOPE_BASE);
        } else {
            angle = RacingCarPhysics.ATAN_MAX;
        }
        return RacingCarPhysics._w(((ratio < 0) ? -angle : angle) << 6);
    }

    // $7008: slid along the wall for 4 ticks, turning back to the road heading.
    _deflect() {
        const w    = RacingCarPhysics._w;
        const side = ((this.roadOffset > 0) ? 1 : ((this.roadOffset < 0) ? -1 : 0));
        if (side === this.wallSide) {
            this.heading      = this._angle(this.heading - this._scaled(this.wallTurn >> 3));
            this.shownHeading = this._angle(this.heading - this.wallTurn);
        } else {
            const road = this.roadHeading;
            this.heading      = this._angle(this.heading + this._halfShare(w(road - this.heading)));
            this.shownHeading = this._angle(this.shownHeading + this._halfShare(w(road - this.shownHeading)));
            this.wallHeading  = this._angle(this.wallHeading + this._halfShare(w(road - this.wallHeading)));
        }
        this._advance(this._tickEndAngle(this.wallHeading, 'wallHeading'), RacingCarPhysics.DEFLECT_SPEED);
    }

    // A tick of moving along a heading.
    _advance(heading, speed) {
        const angle = RacingCarPhysics._w(-heading);
        this.x = this._word(this.x + this._scaled((this._sinOf(angle) * speed) >> 12));
        this.z = this._word(this.z + this._scaled((this._cosOf(angle) * speed) >> 12));
    }

    // $7700: a probe in a wall sends the car back, then forward again by quarters while the probes allow it.
    // @param {number} fromX - x before the move of this step (the time hooks hold the car back on a wall met before
    //                        the end of a tick)
    // @param {number} fromZ
    _collide(fromX, fromZ) {
        this._probe();
        if ((this.wallTimer > 0) || ((this.probeFlags & RacingCarPhysics.CODE_WALL) === 0)) {
            this._keepPrevious();
            return;
        }
        const dh = this._quarter(this._angle(this.shownHeading - this.prevShownHeading));
        const dx = this._quarter(this._word(this.x - this.prevX));
        const dz = this._quarter(this._word(this.z - this.prevZ));
        this.x = this.prevX;
        this.z = this.prevZ;
        this.shownHeading = this.prevShownHeading;
        let blocked = true;
        for (let step = 0; step < 4; step++) {
            this.shownHeading = this._angle(this.shownHeading + dh);
            this.x = this._word(this.x + dx);
            this.z = this._word(this.z + dz);
            this._probe();
            blocked = ((this.probeFlags & RacingCarPhysics.CODE_WALL) !== 0);
            if (blocked) {
                break;
            }
        }
        if (blocked) {
            this.shownHeading = this._angle(this.shownHeading - dh);
            this.x = this._word(this.x - dx);
            this.z = this._word(this.z - dz);
        }
        this._keepPrevious();
    }

    _keepPrevious() {
        this.prevShownHeading = this.shownHeading;
        this.prevX = this.x;
        this.prevZ = this.z;
    }

    // $789C: the polygon under the car, then under its 4 wheel probes, placed by the heading (+$40 + +$46).
    // The probes and the collision layer read whole units.
    _probe() {
        const collision = this._course.collision;
        const x         = Math.trunc(this.x);
        const z         = Math.trunc(this.z);
        this.offRoadWheels = 0;
        // Placed by the shown heading and the body's yaw (still 0 when the car is driven).
        const index  = ((Math.trunc(this.shownHeading + this.bodyYaw) & RacingCarPhysics.TURN_MASK) >> 6);
        const record = collision.record(x, z, this.layer);
        const lx     = RacingCourseCollision.local(x);
        const lz     = RacingCourseCollision.local(z);
        const center = collision.find(record, lx, lz);
        if (center !== null) {
            this._centerPolygon = center;
            this.centerSurface  = center[RacingCourseCollision.SURFACE];
            this._probeLocal[0] = [lx, lz];
        }

        let flags = 0;
        for (let probe = 0; probe < RacingCarPhysics.PROBES; probe++) {
            const [dx, dz] = this._probePages[probe][index];
            const px       = RacingCarPhysics._w(x + dx);
            const pz       = RacingCarPhysics._w(z + dz);
            const cell     = collision.record(px, pz, this.layer);
            const plx      = RacingCourseCollision.local(px);
            const plz      = RacingCourseCollision.local(pz);
            let polygon    = null;
            if ((center !== null) && (cell === record) && collision.inside(center, plx, plz)) {
                polygon = center;
            } else {
                polygon = collision.find(cell, plx, plz);
            }
            let code = RacingCarPhysics.CODE_WALL;
            if (polygon !== null) {
                this._probePolygons[probe] = polygon;
                this._probeLocal[probe + 1] = [plx, plz];
                code = this._surfaceCode(polygon);
            }
            this.probeCodes[probe] = code;
            flags |= code;
        }
        this.probeFlags = flags;
    }

    // $7A40: probe code of a surface class; the verge, the grass and the sand count the wheels off the road ($C31A).
    _surfaceCode(polygon) {
        const code = RacingCarPhysics.SURFACE_CODES[polygon[RacingCourseCollision.SURFACE] & 0x0F] ?? RacingCarPhysics.CODE_ROAD;
        if (code > RacingCarPhysics.CODE_ROAD) {
            this.offRoadWheels++;
        }

        return code;
    }

    // $7816 end: heights of the 3 first probes and of the car, averaged with the previous ones (a non-positive plane is ignored).
    _heights() {
        const collision = this._course.collision;
        for (let probe = 0; probe < RacingCarPhysics.HEIGHT_PROBES; probe++) {
            const polygon = this._probePolygons[probe];
            if (polygon === null) {
                continue;
            }
            const h = collision.height(polygon, ...this._probeLocal[probe + 1]);
            if (h > 0) {
                this.probeHeights[probe] = this._halfway(this.probeHeights[probe], h);
            }
        }
        if (this._centerPolygon !== null) {
            const h = collision.height(this._centerPolygon, ...this._probeLocal[0]);
            if (h > 0) {
                this.height = this._halfway(this.height, h);
            }
        }
    }

    /**
     * The height of the road plane under the car, as the last probe found it; the smoothed height where none is known.
     * @returns {number} in 1/256 m, as +$32
     */
    roadHeight() {
        if (this._centerPolygon === null) {
            return this.height;
        }
        const h = this._course.collision.height(this._centerPolygon, ...this._probeLocal[0]);

        return ((h > 0) ? h : this.height);
    }

    // $7CD8: grass spins, wall deflections, frontal crashes, carrying back.
    _walls() {
        // The original tests the walls at the end of each tick.
        if (!this._atTickEnd()) {
            return;
        }
        const common = this.probeCodes.reduce((all, code) => (all & code));
        if ((common & RacingCarPhysics.CODE_ROAD) !== 0) {
            return;
        }
        if (((common & (RacingCarPhysics.CODE_VERGE | RacingCarPhysics.CODE_GRASS)) !== 0) && (this.displaySpeed > RacingCarPhysics.SPIN_SPEED)
            && !this._controlsLocked()) {
            const limit = this._params.C8D2; // slip spinning the car on the grass
            if (limit <= this.slip) {
                this.flags |= RacingCarPhysics.FLAG_SHOCK;
                this._sound(RacingCarPhysics.SOUND_SPIN);
            } else if (-limit >= this.slip) {
                this.flags |= RacingCarPhysics.FLAG_SHOCK_HARD;
                this._sound(RacingCarPhysics.SOUND_SPIN);
            }
        }
        const codes      = this.probeCodes;
        const frontWalls = ((codes[RacingCarPhysics.PROBE_FRONT_LEFT] & codes[RacingCarPhysics.PROBE_FRONT_RIGHT] & RacingCarPhysics.CODE_WALL) !== 0);
        if (this.wallTimer !== 0) {
            if (frontWalls) {
                this._respawn(this.section, RacingCarPhysics.RESPAWN_TICKS);
            }
            return;
        }
        if ((this.probeFlags & RacingCarPhysics.CODE_WALL) === 0) {
            return;
        }
        this._sound(RacingCarPhysics.SOUND_WALL);
        const angle = RacingCarPhysics._absWord(RacingCarPhysics._w(this.shownHeading - this.roadHeading));
        if ((this.displaySpeed > RacingCarPhysics.CRASH_SPEED) && (angle > RacingCarPhysics.CRASH_ANGLE)) {
            if (this.crashRecovery !== 0) {
                return;
            }
            if (this._onBayBridge() && ((this.roadFlags & RacingCarPhysics.ROAD_BRIDGE_LANE) !== 0)) {
                this._respawn(this.section, RacingCarPhysics.RESPAWN_TICKS);
                return;
            }
            this._frontalCrash();
            this._sound(RacingCarPhysics.SOUND_CRASH);
            return;
        }
        if ((this._onBayBridge() && (this.section === RacingCarPhysics.BRIDGE_TUNNEL_SECTION)) || frontWalls || (angle > RacingCarPhysics.WALL_MAX_ANGLE)) {
            this._respawn(this.section, RacingCarPhysics.RESPAWN_TICKS);
            return;
        }
        if ((this.backOnTrack === 0) || !this._drivenBack()) {
            this._startDeflection(angle);
        }
    }

    // While +$92 runs, the car is driven back to the racing line ($A470), and after the finish; otherwise the player
    // steers it, and a wall deflects it.
    _drivenBack() {
        return (this.drivenBackOnTrack || (this.mode === RacingCarPhysics.MODE_FINISH));
    }

    // The car tumbles to the section of the crash table while it slows down.
    _frontalCrash() {
        const crash = (((this.progress + RacingCarPhysics.PATH_AHEAD) << 1) + (this._onSideLane() ? 1 : 0));
        this.crashRecovery = RacingCarPhysics.BACK_ON_TRACK_TICKS;
        this.crashTimer    = RacingCarPhysics.BACK_ON_TRACK_TICKS;
        this.mode          = RacingCarPhysics.MODE_CRASH;
        this._respawnSetup((this._course.crashSections[crash] ?? this.section), RacingCarPhysics.BACK_ON_TRACK_TICKS);
        // $7DEE: one more damage, the speed limit of the damage ($A1FC).
        if (this.damaging && (this.damage < RacingCarPhysics.DAMAGE_MAX)) {
            this.setDamage(this.damage + 1);
        }
    }

    /**
     * The game's crew is done (pitWorkByCrew): the car leaves the box at the end of the tick.
     */
    releaseFromPit() {
        this._pitReleased = (this.pitState === RacingCarPhysics.PIT_WORK);

        return this;
    }

    /**
     * $A1FC: the damage and its speed limit (a pit stop repairs to 0).
     */
    setDamage(damage) {
        this.damage   = damage;
        this.maxSpeed = this._maxSpeeds[damage];

        return this;
    }

    // Slid along the wall, away from the side of the road point, by an angle from the gap to the road heading.
    _startDeflection(angle) {
        const w  = RacingCarPhysics._w;
        let turn = w(w(angle + RacingCarPhysics.WALL_TURN_BASE) << 1);
        this.wallSide = -1;
        if (this.roadOffset > 0) {
            this.wallSide = 1;
            turn = w(-turn);
        }
        this.wallTurn    = turn;
        this.wallHeading = w(-(w(turn - this.shownHeading)));
        this.wallTimer   = RacingCarPhysics.WALL_TICKS;
        this.crashTimer  = RacingCarPhysics.WALL_TICKS;
    }

    // $7EA4: carried back to the point of a section in the given ticks.
    _respawn(section, ticks) {
        this.mode = RacingCarPhysics.MODE_RESPAWN;
        this._respawnSetup(section, ticks);
    }

    // $7EB8
    _respawnSetup(section, ticks) {
        const w     = RacingCarPhysics._w;
        const point = this._course.sectionPairs[section];
        this.respawnTicks = ticks;
        this.respawnStep  = [
            w(RacingCarPhysics._divs(w(point[0] - this.x), ticks) + 1),
            w(RacingCarPhysics._divs(w(point[1] - this.z), ticks) + 1),
            RacingCarPhysics._divs(w(this.roadHeading - this.heading), ticks),
        ];
    }

    // $714A: section, road point and heading, layer, from the polygon under the car.
    _roadInfo() {
        const polygon = this._centerPolygon;
        if (polygon === null) {
            return;
        }
        this.section      = polygon[RacingCourseCollision.SECTION];
        this.prevProgress = this.progress;
        this.progress     = (this._course.sectionBytes[this.section] ?? this.progress);
        this.roadHeading = RacingCarPhysics._w(polygon[RacingCourseCollision.DIRECTION] << 8);
        this.roadFlags   = polygon[RacingCourseCollision.FLAGS];
        this.layer       = (this.roadFlags & RacingCarPhysics.ROAD_LAYER);
        const point = this._course.sectionPairs[this.section];
        // Copied: the course data stays untouched.
        if (point !== undefined) {
            this.roadPoint[0] = point[0];
            this.roadPoint[1] = point[1];
        }
    }

    // $764E: side of the road point the car is on (sign used by the wall deflection).
    _roadSide() {
        const w   = RacingCarPhysics._w;
        const cos = this._cosOf(this.roadHeading);
        const sin = this._sinOf(this.roadHeading);
        const dx  = w(this.roadPoint[0] - this.x);
        const dz  = w(this.roadPoint[1] - this.z);
        this.roadOffset = w(-(((dx * cos) + (dz * sin)) >> 8));
        this.roadAlong  = w(((dx * sin) - (dz * cos)) >> 8);
    }

    // A tilt table by height gap (its first 512 doubled gaps), signed as the gap.
    _tilt(table, gap) {
        const doubled = RacingCarPhysics._w(Math.trunc(gap) * 2);
        const angle   = table[((((doubled < 0) ? -doubled : doubled) & RacingCarPhysics.TILT_MASK) >> 1)];

        return ((doubled < 0) ? -angle : angle);
    }

    // --- Time: one whole tick here; RacingCarContinuousPhysics applies the elapsed share of a tick ---

    // The change of one tick.
    _scaled(delta) {
        return delta;
    }

    // A change of side sets the steering speed for its whole tick: the ramp starts with the next one.
    _steerChanged() {
    }

    _steerChangedThisTick() {
        return false;
    }

    // Whether this step starts an original tick: the shock bits are read there.
    _atTickStart() {
        return true;
    }

    // Whether this step ends an original tick: the walls are tested there.
    _atTickEnd() {
        return true;
    }

    // The original moves the car over the whole tick with the heading and the speed it ends the tick with.
    // @param {string} name - the field the angle was read from (the time hooks know its value at the start of the step)
    _tickEndAngle(angle, name) {
        return angle;
    }

    _tickEndSpeed(speed) {
        return speed;
    }

    _tickEndShownSlip() {
        return this.shownSlip;
    }

    _tickEndSteer(steer) {
        return steer;
    }

    // A value the original reads as the previous tick left it (pedals and speed in the forces, slip input, sliding,
    // wheels off the road, yaw gain, slip in the steering, probe heights and flags before the move, variant): computed
    // later in the tick, it is that of the tick before.
    _lastTick(name) {
        return this[name];
    }

    // A tick counter, one tick less: what it times runs while it is positive before the count.
    _countDown(value) {
        return (value - 1);
    }

    // A tick counter, one tick less, whose end acts at the start of the tick that zeroes it (deflection, crash
    // recovery).
    _endCountDown(value) {
        return (value - 1);
    }

    // A value kept as a 16-bit word.
    _word(value) {
        return RacingCarPhysics._w(value);
    }

    // A heading, 1/65536 turn in a 16-bit word.
    _angle(value) {
        return RacingCarPhysics._w(value);
    }

    // A quarter of a move, for the steps of the wall check.
    _quarter(value) {
        return (value >> 2);
    }

    // The value less its 2^-shift share, each tick.
    _decay(value, shift) {
        return RacingCarPhysics._w(value - (value >> shift));
    }

    // The value halfway to the target, each tick.
    _halfway(value, target) {
        return RacingCarPhysics._w((value + target) >> 1);
    }

    // The gap shifted right, the move of a tick that takes this power-of-two share of it.
    _shiftShare(gap, shift) {
        return (gap >> shift);
    }

    // Half the gap, the move of a tick that halves it.
    _halfShare(gap) {
        return (gap >> 1);
    }

    // The gap divided, the move of a tick that takes this share of it.
    _shareOf(gap, divisor) {
        return RacingCarPhysics._divs(gap, divisor);
    }

    // The value at the end of the tick, from its change over a tick.
    _tickEnd(value) {
        return value;
    }

    // $8F52: quarter-wave table, amplitude 256, angle in 1/65536 turn.
    _sinOf(angle) {
        const a       = (angle & RacingCarPhysics.TURN_MASK);
        const index   = (a >> 6);
        const quarter = RacingCarPhysics.SIN_QUARTER;
        switch (a >> 14) {
            case 0:
                return this._sin[index];
            case 1:
                return this._sin[quarter - index];
            case 2:
                return -this._sin[index - quarter];
            default:
                return -this._sin[(2 * quarter) - index];
        }
    }

    _cosOf(angle) {
        return this._sinOf(angle + RacingCarPhysics.QUARTER_TURN);
    }

    // Low word of a 68K register, signed.
    static _w(value) {
        return ((value << 16) >> 16);
    }

    // Absolute value of a word: NEG.W leaves -32768 negative.
    static _absWord(value) {
        return ((value < 0) ? RacingCarPhysics._w(-value) : value);
    }

    // divs: quotient truncated towards zero.
    static _divs(dividend, divisor) {
        return RacingCarPhysics._w(Math.trunc(dividend / divisor));
    }

    static _clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }
}

RacingCarPhysics.CAR_FORMULA      = 0;
RacingCarPhysics.CAR_STOCK        = 1;
RacingCarPhysics.CAR_PROTOTYPE    = 2;
RacingCarPhysics.COURSE_BAY_BRIDGE = 1;
// $D19C: Acropolis and Highland damage the cars ($C826), up to 15 crashes; drag x (16 + damage) / 16.
RacingCarPhysics.DAMAGE_COURSES   = [2, 3];
RacingCarPhysics.DAMAGE_MAX       = 15;
RacingCarPhysics.DAMAGE_DRAG_BASE = 16;
// Angles in 1/65536 turn.
RacingCarPhysics.TURN_MASK          = 0xFFFF;
RacingCarPhysics.QUARTER_TURN       = 0x4000;
RacingCarPhysics.HALF_TURN          = 0x8000;
RacingCarPhysics.THREE_QUARTER_TURN = 0xC000;
// Entries of the quarter-wave table up to a quarter turn, and its value of 1.
RacingCarPhysics.SIN_QUARTER      = 0x200;
RacingCarPhysics.SIN_ONE          = 0x100;
// Road flags (+$E5).
RacingCarPhysics.ROAD_LAYER       = 0x01;
RacingCarPhysics.ROAD_BRIDGE_LANE = 0x04;
RacingCarPhysics.ROAD_SIDE_LANES  = 0x06;
// Racing line points ahead of the car's progress.
RacingCarPhysics.PATH_AHEAD       = 2;
RacingCarPhysics.WALL_TURN_BASE   = 0x1000;
RacingCarPhysics.RPM_MAX          = 17000;
RacingCarPhysics.RPM_FACTOR       = 596;
RacingCarPhysics.RPM_SMOOTH_STEP  = 0x400;
RacingCarPhysics.MIN_ENGINE_FORCE = -512;
RacingCarPhysics.CRASH_DRAG       = 0x738;
RacingCarPhysics.BRAKE_FORCE      = 0x71C0;
RacingCarPhysics.SPEED_DIVISOR    = 400;
RacingCarPhysics.DISPLAY_FACTOR   = 0x48;
RacingCarPhysics.EFFECT_TICKS     = 15;
// The smoke and the slow sparks play the first 8 ticks of an effect timer only.
RacingCarPhysics.EFFECT_SHORT_END = 7;
RacingCarPhysics.SKID_SPEED       = 20;
// Grip (+$78): full 1.0 in 8.8, at most halved by a wheel spin.
RacingCarPhysics.GRIP_FULL        = 0x100;
RacingCarPhysics.GRIP_SPIN_MIN    = 0x80;
RacingCarPhysics.OVERREV_TICKS    = 10;
RacingCarPhysics.TOP_GEAR         = 6;
RacingCarPhysics.SQUEAL_RPM       = 8000;
RacingCarPhysics.SQUEAL_GEARS     = 4;
RacingCarPhysics.PEDAL_STEP       = 48;
RacingCarPhysics.PEDAL_MAX        = 255;
RacingCarPhysics.THROTTLE_MIN     = -51;
RacingCarPhysics.STEER_STEP       = 24;
RacingCarPhysics.STEER_SPEED_MAX  = 127;
RacingCarPhysics.STEER_LOAD_MAX   = 200;
RacingCarPhysics.STEER_LOAD_SETTLED = 80;
RacingCarPhysics.STEER_LOAD_EASE  = 8;
RacingCarPhysics.YAW_SPEED        = 0x497;
RacingCarPhysics.YAW_LOW_SPEED    = 0x80;
RacingCarPhysics.YAW_GAIN_BASE    = 0x188;
RacingCarPhysics.YAW_GAIN_MIN     = 64;
RacingCarPhysics.YAW_GAIN_STEP    = 12;
RacingCarPhysics.YAW_BRAKE_MIN    = -16;
RacingCarPhysics.YAW_BRAKE_MAX    = 64;
RacingCarPhysics.BACK_ON_TRACK_TICKS = 40;
RacingCarPhysics.ROAD_ALIGN_ANGLE = 0x222;
RacingCarPhysics.ROAD_ALIGN_TICKS = 4;
RacingCarPhysics.ROAD_ALIGN_STEP  = 18;
RacingCarPhysics.PROBE_MIN        = -50;
RacingCarPhysics.PROBE_MAX        = 400;
RacingCarPhysics.SLIP_THRESHOLD   = 55;
RacingCarPhysics.SLIP_REST        = 15;
RacingCarPhysics.STOCK_FAST_SPEED = 200;
RacingCarPhysics.STOCK_GRIP_MIN   = 0x40;
RacingCarPhysics.STOCK_GRIP_MAX   = 0xFF;
RacingCarPhysics.STOCK_DAMP_MIN   = 0x200;
RacingCarPhysics.STOCK_SKID_SLIP  = 0x100;
RacingCarPhysics.STOCK_SKID_MAX   = 11;
RacingCarPhysics.STOCK_SMOKE_X    = 0xB5;
RacingCarPhysics.STOCK_SMOKE_MOVE = 0x7F;
RacingCarPhysics.STOCK_SKID_STEP  = 4;
RacingCarPhysics.PROTOTYPE_GRIP_MIN = 0x7F;
RacingCarPhysics.PROTOTYPE_DAMP_MIN = 0x100;
RacingCarPhysics.MODE_DRIVE       = 0;
RacingCarPhysics.MODE_PIT         = 4;
RacingCarPhysics.MODE_GRID        = 12;
RacingCarPhysics.MODE_INTRO       = 16;
RacingCarPhysics.MODE_FINISH      = 24;
RacingCarPhysics.MODE_RESPAWN     = 8;
RacingCarPhysics.MODE_CRASH       = 0x1C;
RacingCarPhysics.SPARKS_SPEED     = 0x59;
RacingCarPhysics.SPARKS_FAST_SPEED = 200;
RacingCarPhysics.SPARKS_SURFACE   = 4;
// Sparks frame by tick since the strike ($9C9C below 200 km/h from tick 8 on, $9CAE above).
RacingCarPhysics.SPARKS_FRAMES    = [0, 1, 2, 3, 4, 6, 8, 9, 10];
RacingCarPhysics.SPARKS_FAST_FRAMES = [0, 1, 1, 2, 3, 3, 4, 5, 5, 6, 7, 7, 8, 9, 9, 10];
RacingCarPhysics.SPRAY_SPEED      = 20;
RacingCarPhysics.SPRAY_FAST_SPEED = 0x78;
RacingCarPhysics.FLAG_SHOCK       = 0x1000;
RacingCarPhysics.FLAG_PIT         = 0x0200;
// +$02 bit 14: a split to show (a line crossed, a checkpoint, a pit stop left), taken by $825C.
RacingCarPhysics.FLAG_SPLIT       = 0x4000;
RacingCarPhysics.FLAG_SHOCK_HARD  = 0x2000;
RacingCarPhysics.SHOCK_TICKS      = 30;
// Wheel probes (+$56..+$59); the heights are kept for the 3 first.
RacingCarPhysics.PROBES            = 4;
RacingCarPhysics.HEIGHT_PROBES     = 3;
RacingCarPhysics.PROBE_FRONT_LEFT  = 0;
RacingCarPhysics.PROBE_FRONT_RIGHT = 1;
RacingCarPhysics.PROBE_REAR_LEFT   = 2;
RacingCarPhysics.PROBE_REAR_RIGHT  = 3;
RacingCarPhysics.CODE_WALL        = 0x01;
RacingCarPhysics.CODE_ROAD        = 0x02;
RacingCarPhysics.CODE_VERGE       = 0x04;
RacingCarPhysics.CODE_GRASS       = 0x08;
RacingCarPhysics.CODE_SAND        = 0x10;
// Surface class -> probe code ($7A40; classes 5-7 and 9-12 stop the original on a division by zero).
RacingCarPhysics.SURFACE_CODES    = [0x01, 0x02, 0x04, 0x08, 0x02, null, null, null, 0x10, null, null, null, null, 0x02];
RacingCarPhysics.OFF_TRACK_TICKS  = 80;
RacingCarPhysics.RESPAWN_TICKS    = 20;
RacingCarPhysics.SPIN_SPEED       = 100;
RacingCarPhysics.CRASH_SPEED      = 0x118;
RacingCarPhysics.CRASH_ANGLE      = 0x800;
RacingCarPhysics.WALL_MAX_ANGLE   = 0x3000;
RacingCarPhysics.WALL_TICKS       = 4;
RacingCarPhysics.DEFLECT_SPEED    = 0x1AB;
RacingCarPhysics.CRASH_RESTART_SPEED = 0x11C;
RacingCarPhysics.THROTTLE_GATE_WALL = 15;
RacingCarPhysics.THROTTLE_GATE_PROTOTYPE = 4;
RacingCarPhysics.THROTTLE_GATE_CRASH = 0x27;
RacingCarPhysics.THROTTLE_GATE_START = 30;
RacingCarPhysics.BRIDGE_FIRST     = 0x69;
RacingCarPhysics.BRIDGE_LAST_WALL = 0x6F;
RacingCarPhysics.BRIDGE_LAST_CRASH = 0x71;
RacingCarPhysics.BRIDGE_TUNNEL_SECTION = 0xB1;
RacingCarPhysics.TILT_MASK        = 0x3FF;
RacingCarPhysics.ATAN_LOW_END     = 0x400;
RacingCarPhysics.ATAN_HIGH_END    = 0xD8F;
RacingCarPhysics.ATAN_SLOPE_END   = 0x517C;
RacingCarPhysics.ATAN_SLOPE_BASE  = 0xF4;
RacingCarPhysics.ATAN_MAX         = 0xFE;
// Pit stop ($AC3E, $A972, $AB88, $ABCE): surface class $0D of the band across the pit lane; the approach aims at the
// box, or before it (64 / 128 units, x offset of the course) at 32 km/h near it, faster up to 200 km/h away; the heading
// turns $140 a tick at most and snaps to 0 under $100; the speed goes to its aim by -80 / +47 a tick. Arrived under 2
// units; 120 ticks of work, repaired at frame 20; the mechanics stay 60 ticks after the stop.
// States of a pit stop ($C05C): free, driven to the box, at work, leaving.
RacingCarPhysics.PIT_FREE             = 0;
RacingCarPhysics.PIT_DRIVEN           = 1;
RacingCarPhysics.PIT_WORK             = 2;
RacingCarPhysics.PIT_LEAVING          = 3;
RacingCarPhysics.SURFACE_CLASS        = 0x3F;
RacingCarPhysics.RACE_PITS_CLOSED     = 0x21;
RacingCarPhysics.SURFACE_PIT          = 0x0D;
RacingCarPhysics.PIT_ARRIVAL          = 2;
RacingCarPhysics.PIT_NEAR             = 0x80;
RacingCarPhysics.PIT_MIDDLE           = 0x180;
RacingCarPhysics.PIT_FAR              = 0x400;
RacingCarPhysics.PIT_AIM_NEAR         = 0x40;
RacingCarPhysics.PIT_AIM_FAR          = 0x80;
RacingCarPhysics.PIT_SLOW_KMH         = 0x20;
RacingCarPhysics.PIT_NEAR_BASE        = 8;
RacingCarPhysics.PIT_MIDDLE_BASE      = 0x20;
RacingCarPhysics.PIT_FAST_BASE        = 0x64;
RacingCarPhysics.PIT_FAST_KMH         = 0xC8;
RacingCarPhysics.PIT_TURN             = 0x140;
RacingCarPhysics.PIT_STRAIGHT         = 0x100;
RacingCarPhysics.PIT_METRES_PER_KM    = 1000;
RacingCarPhysics.PIT_SECONDS_PER_HOUR = 3600;
RacingCarPhysics.PIT_SPEED_DIVISOR    = 20;
RacingCarPhysics.PIT_BRAKE            = -80;
RacingCarPhysics.PIT_ACCELERATE       = 47;
RacingCarPhysics.PIT_WORK_TICKS       = 120;
RacingCarPhysics.PIT_REPAIR_FRAME     = 20;
RacingCarPhysics.PIT_CREW_STAY        = 60;
RacingCarPhysics.IDLE_RPM_UP          = 0x400;
RacingCarPhysics.IDLE_RPM_DOWN        = 0x300;
RacingCarPhysics.IDLE_RPM_MAX         = 0x3E80;
RacingCarPhysics.CREW_FRAME_RATE      = 0x3BBB;
RacingCarPhysics.CREW_FRAME_ONE       = 0x10000;
RacingCarPhysics.CREW_LAST_FRAME      = 27;
RacingCarPhysics.SOUND_PIT_IN         = '90';
RacingCarPhysics.SOUND_PIT_OUT        = '91';
// The race ($C30E): bit 4 started (the timers run), bit 5 finished; laps of the race by default ($C310, set by the game).
RacingCarPhysics.RACE_STARTED            = 0x10;
RacingCarPhysics.RACE_FINISHED           = 0x20;
RacingCarPhysics.RACE_LAPS               = 5;
// $7F50: a progress jump past 100 is the line; the split of a lap needs a section of the track (not the pit lane);
// the last lap call under section 100. Checkpoints: bits 6-7 of the surface byte ($80, $C0).
RacingCarPhysics.LINE_GAP                = 100;
RacingCarPhysics.LINE_LAST_SECTION       = 3;
RacingCarPhysics.LINE_FINAL_CALL_SECTION = 100;
RacingCarPhysics.SURFACE_CHECKPOINT      = 0x80;
RacingCarPhysics.SURFACE_CHECKPOINTS     = 0xC0;
// Waiting on the grid and in the opening the pad is ignored; after the finish the throttle is held ($C970).
RacingCarPhysics.IDLE_INPUT              = {accelerate: false, brake: false, gearUp: false, gearDown: false, steer: 0};
RacingCarPhysics.FINISH_INPUT            = {accelerate: true, brake: false, gearUp: false, gearDown: false, steer: 0};
RacingCarPhysics.FINISH_AUTOPILOT        = 2;
// Sound commands ($C8A4): slide squeal $BD (|+$94| > $20, again after 32 ticks) cut by $C8 (|+$94| <= $10).
RacingCarPhysics.SOUND_CRASH             = 'B0';
RacingCarPhysics.SOUND_SKID              = 'B1';
RacingCarPhysics.SOUND_SPIN              = 'B2';
RacingCarPhysics.SOUND_WHEELSPIN         = 'B4';
RacingCarPhysics.SOUND_WALL              = 'B5';
RacingCarPhysics.SOUND_SPARKS            = 'B7';
RacingCarPhysics.SOUND_SQUEAL            = 'BD';
RacingCarPhysics.SOUND_FINAL_LAP         = 'BE';
RacingCarPhysics.SOUND_SQUEAL_CUT        = 'C8';
RacingCarPhysics.SOUND_GRASS             = 'D2';
RacingCarPhysics.SQUEAL_START            = 0x20;
RacingCarPhysics.SQUEAL_END              = 0x10;
RacingCarPhysics.SQUEAL_TICKS            = 32;

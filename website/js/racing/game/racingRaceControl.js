/**
 * The Time Attack race of the original around the car's physics, at its 20 Hz
 * ticks (race.md):
 *   - the opening (20 ticks, the car still), then the start: on Big Forest
 *     "PIT START" over the mechanics (60 ticks), "3", "2", "1" (20 ticks each,
 *     voices $C0-$C2), "GO!" ($C3, 60 ticks); elsewhere the "READY" lights,
 *     red after 21 ticks (beep $A6), green 21 ticks later = the start ($A7),
 *     gone 41 ticks later ($9EC0, $3D5A);
 *   - the lap and race times from the start, a lap taken off by the time
 *     past the line ($B2E4), the lap message (LAP TIME, BEST LAP of the race,
 *     FASTEST LAP over the record: 80 ticks blinking 4 on / 4 off, $34E8), the
 *     split at the checkpoints against the record's ($825C), REVERSE ($C312),
 *     PIT WORK during a stop;
 *   - the finish after the last lap: the car drives itself 40 ticks, the
 *     blinds close in 10 ticks ($476A), then the results.
 * The display reads the state; the sounds go to a callback (command ids).
 */
class RacingRaceControl {
    /**
     * @param {RacingCarPhysics} physics
     * @param {object} course - race.json course (records, lineCorrection, checkpointCorrections)
     * @param {{lapMs: number, checkpointsMs: (number|null)[]}|null} record - the record of the course and car, null
     *        before any lap: the first lap makes it
     * @param {boolean} pitStart - the start in the pit box with the mechanics (Big Forest)
     * @param {string[]} lapJingles - music command of the lap done, by laps done ($8989EE)
     * @param {string[]} checkpointJingles - music command after a checkpoint, by laps done ($8256, mode Virtua Racing)
     */
    constructor(physics, course, record, pitStart, lapJingles, checkpointJingles) {
        this._lapJingles = lapJingles;
        this._checkpointJingles = checkpointJingles;
        this._sounds     = [];          // {ticks, command}: sounds the race sends some ticks later
        this._physics   = physics;
        this._course    = course;
        this._pitStart  = pitStart;
        this._onSound   = () => {};
        this._onFinish  = () => {};
        this._onRecord  = () => {};
        this.record     = ((record === null) ? null : {lapMs: record.lapMs, checkpointsMs: record.checkpointsMs.slice()});
        this.newRecord  = false;
        this.laps       = physics.laps;
        this.lapTimes   = [];
        this.bestLapMs  = null;
        this.lapMs      = 0;            // $C806, from the start
        this.started    = false;
        this.finished   = false;
        // Display: start (3, 2, 1, 'go', 'ready'), lights of the READY gantry (LIGHTS_*), messages.
        this.startSign  = null;
        this.lights     = null;
        this.pitStartSign = false;      // $FF6990, blinking from the end of the opening to GO
        this.message    = null;         // {kind: 'lapTime'|'bestLap'|'fastestLap', ms, shown}
        this.split      = null;         // {ms (signed gap), shown}
        this.reverse    = false;
        this.pitWork    = false;
        this.blinds     = 1;            // share of the screen closed by the blinds (opening, finish)
        this._ticks     = 0;            // ticks of the race, whole ones counted at their end
        this._step      = RacingRaceControl.STEP_INTRO;
        this._stepTicks = 0;            // $C8AA of the step
        this._blink     = 0;            // $C8AA as the blinking reads it
        this._crewTicks = 0;            // +$B0 of the start crew
        this._message   = null;
        this._split     = null;
        this._splitsMs  = [null, null]; // $C270 / $C274 of the lap
        this._finishTicks = null;
        physics.mode = RacingCarPhysics.MODE_INTRO;
        if (pitStart) {
            physics.pitCrewFrame = 0;
        } else {
            this.startSign = RacingRaceControl.SIGN_READY;
            this.lights    = RacingRaceControl.LIGHTS_OFF;
        }
    }

    setOnSound(callback) {
        this._onSound = callback;

        return this;
    }

    // A new record of the lap, as soon as it is done: {lapMs, checkpointsMs}.
    setOnRecord(callback) {
        this._onRecord = callback;

        return this;
    }

    setOnFinish(callback) {
        this._onFinish = callback;

        return this;
    }

    /**
     * After the physics step of a frame: the time, the race events, the ticks ended in the frame.
     *
     * @param {number} ticks - time elapsed, in original ticks
     */
    update(ticks) {
        if (this.started && !this.finished) {
            this.lapMs += (ticks * RacingRaceControl.TICK_MS);
        }
        for (const event of this._physics.events) {
            this._event(event);
        }
        this._physics.events.length = 0;
        const end = (this._ticks + ticks);
        while (Math.floor(this._ticks + RacingRaceControl.EPSILON) < Math.floor(end + RacingRaceControl.EPSILON)) {
            this._ticks = (Math.floor(this._ticks + RacingRaceControl.EPSILON) + 1);
            this._tick();
        }
        this._ticks = end;
        this._blinds();

        return this;
    }

    // --- A tick ---

    _tick() {
        this._stepTicks++;
        this._blink++;
        const physics = this._physics;
        this._start();
        this.reverse = ((physics.wrongWay !== 0) && !this.finished);
        if ((physics.pitState === RacingCarPhysics.PIT_DRIVEN) || (physics.pitState === RacingCarPhysics.PIT_WORK)) {
            if (!this.pitWork) {
                this._blink = 0;
            }
            this.pitWork = true;
        } else {
            this.pitWork = false;
        }
        this._messages();
        this._delayedSounds();
        if (this._finishTicks !== null) {
            this._finishTicks++;
            if (this._finishTicks === (RacingRaceControl.FINISH_DRIVE_TICKS + RacingRaceControl.BLINDS_TICKS)) {
                this._onFinish(this.result());
            }
        }
    }

    // $9EC0 (Big Forest) / $3D5A (the lights), after the opening of 20 ticks ($6A3A).
    _start() {
        const physics = this._physics;
        const ticks   = this._stepTicks;
        switch (this._step) {
            case RacingRaceControl.STEP_INTRO:
                if (ticks >= RacingRaceControl.INTRO_TICKS) {
                    physics.mode = RacingCarPhysics.MODE_GRID;
                    this._next(this._pitStart ? RacingRaceControl.STEP_PIT_START : RacingRaceControl.STEP_LIGHTS);
                    this.pitStartSign = this._pitStart;
                }
                break;
            case RacingRaceControl.STEP_PIT_START:
                this._crew();
                if (ticks >= RacingRaceControl.PIT_START_TICKS) {
                    this._count(3, RacingRaceControl.STEP_THREE, 'C0');
                }
                break;
            case RacingRaceControl.STEP_THREE:
            case RacingRaceControl.STEP_TWO:
            case RacingRaceControl.STEP_ONE:
                this._crew();
                if (ticks >= RacingRaceControl.COUNT_TICKS) {
                    if (this._step === RacingRaceControl.STEP_THREE) {
                        this._count(2, RacingRaceControl.STEP_TWO, 'C1');
                    } else if (this._step === RacingRaceControl.STEP_TWO) {
                        this._count(1, RacingRaceControl.STEP_ONE, 'C2');
                    } else {
                        this._count(RacingRaceControl.SIGN_GO, RacingRaceControl.STEP_GO, 'C3');
                        this.pitStartSign = false;
                        this._go();
                    }
                }
                break;
            case RacingRaceControl.STEP_GO:
                this._crew();
                if (ticks >= RacingRaceControl.GO_TICKS) {
                    // $A04E: the crew goes.
                    physics.pitCrewFrame = -1;
                    this.startSign = null;
                    this._next(RacingRaceControl.STEP_RACE);
                }
                break;
            case RacingRaceControl.STEP_LIGHTS:
                if (ticks >= RacingRaceControl.RED_TICKS) {
                    this.lights = RacingRaceControl.LIGHTS_RED;
                    this._onSound(RacingRaceControl.SOUND_BEEP_LOW);
                    this._next(RacingRaceControl.STEP_RED);
                }
                break;
            case RacingRaceControl.STEP_RED:
                if (ticks >= RacingRaceControl.GREEN_TICKS) {
                    this.lights = RacingRaceControl.LIGHTS_GREEN;
                    this._onSound(RacingRaceControl.SOUND_BEEP_HIGH);
                    this._go();
                    this._next(RacingRaceControl.STEP_GREEN);
                }
                break;
            case RacingRaceControl.STEP_GREEN:
                if (ticks >= RacingRaceControl.LIGHTS_GONE_TICKS) {
                    this.lights    = null;
                    this.startSign = null;
                    this._next(RacingRaceControl.STEP_RACE);
                }
                break;
            default:
                break;
        }
    }

    _next(step) {
        this._step      = step;
        this._stepTicks = 0;
        this._blink     = 0;
    }

    _count(sign, step, sound) {
        this.startSign = sign;
        this._onSound(sound);
        this._next(step);
    }

    // $9FBC / $3DD4: the race starts ($C30E bit 4), the car goes from the next tick.
    _go() {
        this._physics.raceFlags |= RacingCarPhysics.RACE_STARTED;
        this.started  = true;
        // The start jingle (it chains the DAC $C6): 5 ticks after GO ($9FBC), 10 after the green light ($3E08).
        this._later((this._pitStart ? RacingRaceControl.START_JINGLE_PIT_TICKS : RacingRaceControl.START_JINGLE_LIGHTS_TICKS), RacingRaceControl.JINGLE_START);
    }

    // $A034: the crew of the pit start, frame = ticks x 7 / 30 from the end of the opening.
    _crew() {
        this._physics.pitCrewFrame = RacingCarPhysics.crewFrame(this._crewTicks);
        this._crewTicks++;
    }

    // --- Laps ---

    _event(event) {
        if (event.type === 'lap') {
            this._lap(event);
        } else if (event.type === 'checkpoint') {
            this._checkpoint(event.checkpoint);
        }
    }

    // $34E8 state 4 / $B2E4: the lap time less the time past the line, against the best lap of the race and the record.
    _lap(event) {
        // Whole milliseconds: the time is summed by shares of ticks.
        const lapMs = Math.max(0, Math.round(this.lapMs - this._lineCorrection(this._course.lineCorrection)));
        this.lapTimes.push(lapMs);
        this.lapMs = 0;
        let kind = 'lapTime';
        if ((this.bestLapMs === null) || (lapMs < this.bestLapMs)) {
            this.bestLapMs = lapMs;
            kind = 'bestLap';
            if ((this.record === null) || (lapMs < this.record.lapMs)) {
                kind = 'fastestLap';
                this.newRecord = true;
                this.record = {lapMs: lapMs, checkpointsMs: this._splitsMs.slice()};
                this._onRecord(this.record);
            }
        }
        this._splitsMs = [null, null];
        if (event.finished) {
            this.finished     = true;
            this._finishTicks = 0;
        }
        // $34E8 state 36: the jingle of the lap at the end of the first blink of its message (the second when the voice
        // of the last lap plays first), $97 for a new record; none after the finish nor through the pit lane.
        if (!event.throughPits && !event.finished) {
            const jingles = this._lapJingles;
            const command = ((kind === 'fastestLap') ? RacingRaceControl.JINGLE_RECORD : jingles[Math.min(event.lap, (jingles.length - 1))]);
            this._later(((event.lap === (this.laps - 1)) ? RacingRaceControl.LAST_LAP_JINGLE_TICKS : RacingRaceControl.LAP_JINGLE_TICKS), command);
        }
        // Through the pit lane the split flag is not set: the message stays hidden ($C04E = 0).
        if (!event.throughPits || event.finished) {
            this._message = {kind: kind, ms: lapMs, ticks: 0, frozen: event.finished};
            this._split   = null;
            this._blink   = 0;
        }
    }

    // A sound some ticks later; one of a checkpoint is dropped if a lap message shows by then.
    _later(ticks, command, unlessMessage = false) {
        if (command !== undefined) {
            this._sounds.push({ticks: ticks, command: command, unlessMessage: unlessMessage});
        }
    }

    _delayedSounds() {
        for (const sound of this._sounds) {
            sound.ticks--;
            if ((sound.ticks === 0) && !(sound.unlessMessage && (this._message !== null))) {
                this._onSound(sound.command);
            }
        }
        this._sounds = this._sounds.filter((sound) => (sound.ticks > 0));
    }

    // $825C: the lap time at a checkpoint (less its correction) against the record's, unless a lap message shows.
    // The sounds of the mode Virtua Racing (user request, Time Attack has none): the voice $BF, then 20 ticks later the
    // music of the laps done unless a lap message shows ($81D8).
    _checkpoint(checkpoint) {
        this._onSound(RacingRaceControl.SOUND_CHECKPOINT);
        const jingles = this._checkpointJingles;
        this._later(RacingRaceControl.CHECKPOINT_JINGLE_TICKS, jingles[Math.min(this._physics.lap, (jingles.length - 1))], true);
        const ms = Math.max(0, Math.round(this.lapMs - this._lineCorrection(this._course.checkpointCorrections[checkpoint - 1])));
        this._splitsMs[checkpoint - 1] = ms;
        const recordMs = ((this.record === null) ? null : this.record.checkpointsMs[checkpoint - 1]);
        if ((this._message !== null) || (recordMs === null)) {
            return;
        }
        this._split = {ms: (ms - recordMs), ticks: 0};
        this._blink = 0;
    }

    // $B2E4 / $B386: the time the car took past the point ((K + +$E2) x 800 / +$06 ms, at most 50).
    _lineCorrection(base) {
        const physics = this._physics;
        const past    = (base + physics.roadAlong);
        if ((past < 0) || (physics.speed <= 0)) {
            return 0;
        }

        return Math.min(RacingRaceControl.LINE_CORRECTION_MAX, Math.trunc((past * RacingRaceControl.LINE_CORRECTION_FACTOR) / physics.speed));
    }

    // 80 ticks blinking 4 on / 4 off, shown first; the finish freezes the last lap message.
    _messages() {
        const on = ((this._blink & RacingRaceControl.BLINK_BIT) === 0);
        const age = (item) => {
            if (item === null) {
                return null;
            }
            item.ticks++;

            return ((item.ticks > RacingRaceControl.MESSAGE_TICKS) ? null : item);
        };
        if ((this._message !== null) && !this._message.frozen) {
            this._message = age(this._message);
        }
        this._split = age(this._split);
        this.message = ((this._message === null) ? null : {kind: this._message.kind, ms: this._message.ms, shown: (this._message.frozen || on)});
        this.split   = ((this._split === null) ? null : {ms: this._split.ms, shown: on});
    }

    // The blinds open over ticks 3 to 12 of the opening and close in the 10 ticks after the 40 of the finish drive.
    _blinds() {
        const ticks = this._ticks;
        if (this._finishTicks !== null) {
            const closing = (this._finishTicks - RacingRaceControl.FINISH_DRIVE_TICKS);
            this.blinds = Math.min(1, Math.max(0, (closing / RacingRaceControl.BLINDS_TICKS)));
            return;
        }
        this.blinds = Math.min(1, Math.max(0, (1 - ((ticks - RacingRaceControl.BLINDS_OPEN_FIRST) / RacingRaceControl.BLINDS_TICKS))));
    }

    /**
     * @returns {boolean} the blinking signs (PIT START, GO!, REVERSE, PIT WORK) shown now: 4 ticks on, 4 off
     */
    isBlinkOn(firstOn) {
        const on = ((this._blink & RacingRaceControl.BLINK_BIT) === 0);

        return ((firstOn) ? on : !on);
    }

    /**
     * @returns {{raceMs: number, lapsMs: number[], bestLapMs: number, record: object, newRecord: boolean}}
     */
    result() {
        return {
            raceMs:    this.lapTimes.reduce((sum, ms) => (sum + ms), 0),
            lapsMs:    this.lapTimes.slice(),
            bestLapMs: this.bestLapMs,
            record:    this.record,
            newRecord: this.newRecord,
        };
    }
}

RacingRaceControl.TICK_MS                = 50;
RacingRaceControl.EPSILON                = 1e-6;
RacingRaceControl.STEP_INTRO             = 0;
RacingRaceControl.STEP_PIT_START         = 8;
RacingRaceControl.STEP_THREE             = 12;
RacingRaceControl.STEP_TWO               = 16;
RacingRaceControl.STEP_ONE               = 20;
RacingRaceControl.STEP_GO                = 24;
RacingRaceControl.STEP_LIGHTS            = 36;
RacingRaceControl.STEP_RED               = 40;
RacingRaceControl.STEP_GREEN             = 44;
RacingRaceControl.STEP_RACE              = 28;
RacingRaceControl.INTRO_TICKS            = 20;
RacingRaceControl.PIT_START_TICKS        = 60;
RacingRaceControl.COUNT_TICKS            = 20;
RacingRaceControl.GO_TICKS               = 60;
// The lights after the opening: red at tick 42, green at 63, gone at 104 ($3D9A takes one tick, then > 20, > 20, > 40).
RacingRaceControl.RED_TICKS              = 22;
RacingRaceControl.GREEN_TICKS            = 21;
RacingRaceControl.LIGHTS_GONE_TICKS      = 41;
RacingRaceControl.MESSAGE_TICKS          = 80;
RacingRaceControl.BLINK_BIT              = 4;
RacingRaceControl.BLINDS_OPEN_FIRST      = 3;
RacingRaceControl.BLINDS_TICKS           = 10;
RacingRaceControl.FINISH_DRIVE_TICKS     = 40;
RacingRaceControl.START_JINGLE_PIT_TICKS    = 5;
RacingRaceControl.START_JINGLE_LIGHTS_TICKS = 10;
RacingRaceControl.LAP_JINGLE_TICKS          = 7;
RacingRaceControl.LAST_LAP_JINGLE_TICKS     = 15;
RacingRaceControl.CHECKPOINT_JINGLE_TICKS   = 20;
RacingRaceControl.LINE_CORRECTION_MAX    = 50;
RacingRaceControl.LINE_CORRECTION_FACTOR = 800;
RacingRaceControl.SIGN_GO                = 'go';
// The READY gantry: red top row, then green bottom row = the start.
RacingRaceControl.LIGHTS_OFF             = 0;
RacingRaceControl.LIGHTS_RED             = 1;
RacingRaceControl.LIGHTS_GREEN           = 2;
RacingRaceControl.SIGN_READY             = 'ready';
RacingRaceControl.SOUND_BEEP_LOW         = 'A6';
RacingRaceControl.SOUND_BEEP_HIGH        = 'A7';
RacingRaceControl.JINGLE_START           = '93';
RacingRaceControl.JINGLE_RECORD          = '97';
RacingRaceControl.SOUND_CHECKPOINT       = 'BF';

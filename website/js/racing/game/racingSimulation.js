/**
 * The race of one course and the rules that move it: each player's car with the physics of the original transposed
 * to the frame time (RacingCarContinuousPhysics), its race (RacingRaceControl) and the work of its pit crew
 * (RacingPitWork), the contacts between the cars, and the step that advances everything from one command per player.
 * It runs on the main alone, never reads a device and never draws: RacingMainRole feeds it; after each step it writes
 * the state every device shows (RacingCarState) and emits the one-shot events (RacingTurnEvents), which
 * RacingPresentation shows without knowing it.
 *
 * A race alone starts as the Time Attack. A race of several players starts as the 2 players VS mode, from the places
 * of the start grid of 8 (multiplayer_grids.json), and at the end of each original tick, as the 2 players VS mode tests
 * its pair after both ticks ($87E2 then $AF18), the cars are ranked and every pair close enough is tested, from the
 * leading car to the last, the car ahead as the first player (user decision).
 *
 * In a race of several players, the first finish leaves the others RacingRaceOutcome.FINISH_WINDOW_MS: then their races
 * stop; the cars are placed at the end of each step, and a player whose car leaves the track after the start
 * abandoned (RacingRaceOutcome).
 *
 * The physics runs on the unmirrored course: on a mirrored one, the steering of the commands is turned back, as the
 * original swaps the left and right bits of the pad before the steering ($950A).
 */
class RacingSimulation {
    /**
     * @param {RacingPlayerRoster} roster
     * @param {RacingTurnEvents}   events - where every one-shot event of a step goes
     * @param {function(): number} random - uniform in [0, 1[, the pit stops' draw
     */
    constructor(roster, events, random) {
        this._roster    = roster;
        this._events    = events;
        this._random    = random;
        this._data      = null;
        this._collision = null;         // of the course, shared by the cars
        this._pitBoxes  = null;         // RacingPitBoxes.of: two in a race of several players
        this._pitWork   = new Map();    // player id → RacingPitWork of its car
        this._previous  = new Map();    // player id → its command of the previous step, the presses derived from it
        this._input     = {accelerate: false, brake: false, steer: 0, steerAxis: null, gearUp: false, gearDown: false};
        this._clock     = 0;            // original ticks since the race was built: the end of a tick tests the contacts
        this._outcome   = new RacingRaceOutcome();
        this._endTick   = null;         // the clock the race of several players ends at, once a car finished
        this._places    = new Map();    // player id → its place at the end of the previous step
        this._onFinish  = null;
        this._onRecord  = null;
    }

    /**
     * The course the race runs on, and what its races report.
     *
     * @param {object}   data
     * @param {object}   data.physics          - physics.json
     * @param {object}   data.race             - race.json
     * @param {object}   data.course           - the course's export (its collision)
     * @param {object}   data.multiplayerGrids - multiplayer_grids.json
     * @param {object}   data.selection        - {course, mirror, car, gearbox}
     * @param {boolean}  data.multiplayer      - a race of several players
     * @param {int}      data.laps
     * @param {string[]} data.lapJingles       - music command of the lap done, by laps done (racingSound.laps)
     * @param {function(RacingPlayer, object)} onFinish - a player's race is over: its result (RacingRaceControl.result)
     * @param {function(RacingPlayer, object)} onRecord - a new record of a player's lap, as soon as it is done:
     *                                                   {lapMs, checkpointsMs}
     */
    adoptRace(data, onFinish, onRecord) {
        this._data      = data;
        this._collision = new RacingCourseCollision(data.course.collision);
        this._pitBoxes  = RacingPitBoxes.of(data.race, data.selection.course, this._collision, data.multiplayer);
        this._onFinish  = onFinish;
        this._onRecord  = onRecord;

        return this;
    }

    /**
     * Gives the player its car on its place of the start grid (its slot's), its race against its record.
     *
     * @param {RacingPlayer} player
     * @param {{lapMs: number, checkpointsMs: (number|null)[]}|null} record - null before any lap
     */
    addPlayer(player, record) {
        const {physics: physicsData, race, selection, multiplayer} = this._data;
        const physics = new RacingCarContinuousPhysics(physicsData, selection.car, (selection.gearbox === RacingMenuNavigator.GEARBOX_MANUAL), {
            index:     racingCatalog.getCourseIndex(selection.course),
            collision: this._collision,
            ...race.courses[selection.course],
            pit:       {...RacingCarPhysics.coursePit(race, selection.course), boxes: this._pitBoxes.map((box) => [box.x, box.z])},
        });
        physics.laps = this._data.laps;
        // Damage on every course (user decision: the original damages the cars on Acropolis and Highland only, $D19C).
        physics.damaging = true;
        // After a wall or a crash the player steers (user decision: the original drives the car back to its line 2 s).
        physics.drivenBackOnTrack = false;
        physics.pitWorkByCrew = true;
        physics.place(...RacingSimulation.startPlace(this._data, player.getId()));
        if (multiplayer && (physics.progress > RacingCarPhysics.LINE_GAP)) {
            physics.startBehindLine();
        }

        const id          = player.getId();
        const raceControl = new RacingRaceControl(physics, race.courses[selection.course], record, this._startKind(),
            this._data.lapJingles, race.checkpointJingles)
            .setOnSound((command) => this._events.sound(id, command))
            .setCrewSoundsByClips(true)
            .setOnRecord((lap) => {
                this._events.lapRecord(id, lap);
                this._onRecord(player, lap);
            })
            .setOnFinish((result) => this._onFinish(player, result));
        if (multiplayer) {
            raceControl.setSplitAgainst((pass) => this._aheadAt(player, pass));
        }
        player.enterRace(physics, raceControl);
        player.getCarState().capture(physics);
        this._pitWork.set(id, new RacingPitWork(player, this._events, this._random));

        return this;
    }

    /**
     * Takes the player's car off the track (a sub gone).
     *
     * @param {RacingPlayer} player
     */
    removePlayer(player) {
        if (this._data.multiplayer && (this._clock > 0) && !this._outcome.over && (player.getRace() !== null)) {
            this._outcome.abandons.push(player.getId());
        }
        this._pitWork.delete(player.getId());
        this._previous.delete(player.getId());
        player.leaveRace();

        return this;
    }

    /**
     * The record a player's car races against, known once the race is built (a sub's device sends its own).
     *
     * @param {RacingPlayer} player
     * @param {{lapMs: number, checkpointsMs: (number|null)[]}} record
     */
    setRecord(player, record) {
        player.getRace().setRecord(record);

        return this;
    }

    /**
     * @returns {RacingRaceOutcome} the end of a race of several players
     */
    getOutcome() {
        return this._outcome;
    }

    /**
     * The Time Attack's place alone, else the slot's place of the grid of 8 — a sub poses its cars there too until the
     * main's first state.
     *
     * @param {object} data - see adoptRace
     * @param {int}    slot - the player's
     * @returns {number[]} [x, height, z, heading] in entity units
     */
    static startPlace(data, slot) {
        const {race, multiplayerGrids, selection, multiplayer} = data;
        if (!multiplayer) {
            return race.startGrids[selection.car].race[racingCatalog.getCourseIndex(selection.course)][RacingSimulation.TIME_ATTACK_PLACE];
        }

        return multiplayerGrids.grids[selection.course][selection.car][slot - RacingPlayer.MAIN_ID];
    }

    // Big Forest starts alone in the pit box, with the mechanics ($6AB4); several players as the 2 players VS mode.
    _startKind() {
        if (this._data.multiplayer) {
            return RacingRaceControl.START_TWO_PLAYERS;
        }

        return ((RacingSimulation.PIT_START_COURSES.includes(this._data.selection.course)) ? RacingRaceControl.START_PIT : RacingRaceControl.START_LIGHTS);
    }

    /**
     * One step of the race: each car moves by its command, then its race and its crew go on; at the end of each
     * original tick the cars touching each other collide.
     *
     * @param {number}                  ticks    - time elapsed, in original ticks
     * @param {Map<int, RacingCommand>} commands - by player id
     */
    tick(ticks, commands) {
        const players = this._roster.getAll().filter((player) => (player.getPhysics() !== null));
        let left  = ticks;
        let first = true;
        while (left > 0) {
            const boundary = (Math.floor(this._clock + RacingSimulation.EPSILON) + 1);
            const step     = Math.min(left, (boundary - this._clock));
            for (const player of players) {
                this._stepPlayer(player, (commands.get(player.getId()) ?? RacingSimulation.NEUTRAL_COMMAND), step, first);
            }
            left       -= step;
            first       = false;
            this._clock = ((Math.abs(this._clock + step - boundary) < RacingSimulation.EPSILON) ? boundary : (this._clock + step));
            if (this._clock === boundary) {
                this._collide(players);
            }
        }
        if (this._data.multiplayer) {
            this._updateOutcome(players);
        }
        for (const player of players) {
            player.getCarState().capture(player.getPhysics());
        }
    }

    // The window after the first finish, the races stopped once it ran out, the places, the end of the race.
    _updateOutcome(players) {
        const outcome = this._outcome;
        const races   = players.map((player) => player.getRace());
        if ((this._endTick === null) && races.some((race) => race.finished)) {
            this._endTick = (this._clock + (RacingRaceOutcome.FINISH_WINDOW_MS / RacingRaceControl.TICK_MS));
        }
        if (this._endTick !== null) {
            outcome.countdownMs = (Math.max(0, (this._endTick - this._clock)) * RacingRaceControl.TICK_MS);
            if (this._clock >= this._endTick) {
                races.forEach((race) => race.stop());
            }
        }
        const finished = (player) => (player.getRace().finished && !player.getRace().stopped);
        players.slice().sort((a, b) => {
            if (finished(a) && finished(b)) {
                return (RacingRaceOutcome.raceMs(a.getRace()) - RacingRaceOutcome.raceMs(b.getRace()));
            }
            if (finished(a) || finished(b)) {
                return ((finished(a)) ? -1 : 1);
            }
            return RacingSimulation.rankOrder(a.getPhysics(), b.getPhysics());
        }).forEach((player, index) => {
            player.getRace().place = (index + 1);
        });
        outcome.over = ((races.length > 0) && races.every((race) => race.finished));
        this._overtakes(players);
    }

    // The race time at a pass of the car placed just ahead of the player, null when it leads or has not passed there.
    _aheadAt(player, pass) {
        const place = player.getRace().place;
        const ahead = this._roster.getAll().find((other) => ((other.getRace() !== null) && (other.getRace().place === (place - 1))));

        return ((ahead !== undefined) ? (ahead.getRace().passesMs[pass] ?? null) : null);
    }

    // $87E2: a player whose place changed hears the overtaking sound, if its car and the one it swapped places with run
    // fast at clearly different speeds (and, at Sand Park, on the same layer of road); heard by that player alone.
    _overtakes(players) {
        for (const player of players) {
            const id       = player.getId();
            const place    = player.getRace().place;
            const previous = (this._places.get(id) ?? place);
            this._places.set(id, place);
            const race = player.getRace();
            if ((previous === place) || !race.started || race.finished) {
                continue;
            }
            const other = players.find((candidate) => (candidate.getRace().place === previous));
            if ((other === undefined) || !RacingSimulation._overtakeHeard(player.getPhysics(), other.getPhysics(), this._data.selection.course)) {
                continue;
            }
            this._events.sound(id, RacingSimulation.OVERTAKE_SOUNDS[this._data.selection.car]);
        }
    }

    static _overtakeHeard(a, b, course) {
        const speeds = ((Math.abs(a.displaySpeed - b.displaySpeed) > RacingSimulation.OVERTAKE_GAP_KMH)
            && ((a.displaySpeed + b.displaySpeed) > RacingSimulation.OVERTAKE_SUM_KMH));

        return (speeds && ((course !== RacingSimulation.LAYERED_COURSE) || (((a.roadFlags ^ b.roadFlags) & RacingSimulation.ROAD_LAYER_BITS) === 0)));
    }

    // A command acts once: its presses on the first part of the step only. The race sends its sounds as it updates,
    // before those of the physics step.
    _stepPlayer(player, command, step, first) {
        const id      = player.getId();
        const physics = player.getPhysics();
        physics.freePitBox = this._freePitBox(player);
        physics.step(this._physicsInput(command, ((first) ? (this._previous.get(id) ?? null) : command)), step);
        if (first) {
            this._previous.set(id, command);
        }
        player.getRace().update(step);
        this._sendSounds(player);
        this._pitWork.get(id).update(step);
    }

    // The first box no other car holds in its stop (the original's first), -1 when each is held.
    _freePitBox(player) {
        const held = (box) => this._roster.getAll().some((other) => ((other !== player) && (other.getPhysics() !== null)
            && (other.getPhysics().pitState !== RacingCarPhysics.PIT_FREE) && (other.getPhysics().pitBox === box)));

        return this._pitBoxes.findIndex((box, index) => !held(index));
    }

    _collide(players) {
        RacingSimulation.collideCars(players.map((player) => player.getPhysics()));
        for (const player of players) {
            this._sendSounds(player);
        }
    }

    /**
     * $87E2 then $AF18 at the end of a tick: the cars ranked, then each pair within reach, the car ahead first.
     *
     * @param {RacingCarPhysics[]} cars - in slot order
     */
    static collideCars(cars) {
        if (cars.length < RacingSimulation.PAIR) {
            return;
        }
        const ranked = cars.slice().sort(RacingSimulation.rankOrder);
        for (let i = 0; i < ranked.length; i++) {
            for (let j = (i + 1); j < ranked.length; j++) {
                if (RacingCarPhysics.inReach(ranked[i], ranked[j])) {
                    RacingCarPhysics.collide(ranked[i], ranked[j]);
                }
            }
        }
    }

    /**
     * $87E2: negative when a is ahead — the greater key, then the greater projection; 0 at equal places (a stable sort
     * then keeps the slot order).
     *
     * @param {RacingCarPhysics} a
     * @param {RacingCarPhysics} b
     */
    static rankOrder(a, b) {
        const key = (b.rankKey() - a.rankKey());
        if (key !== 0) {
            return key;
        }

        return Math.sign(b.rankProjection() - a.rankProjection());
    }

    _sendSounds(player) {
        const physics = player.getPhysics();
        for (const command of physics.sounds) {
            this._events.sound(player.getId(), command);
        }
        physics.sounds.length = 0;
    }

    /**
     * The command as the physics reads it (RacingCarPhysics.tick): the steering buttons all or nothing, else the stick
     * in proportion; a gear change on its press.
     *
     * @param {RacingCommand}      command
     * @param {RacingCommand|null} previous - the same player's previous command
     * @returns {object} valid until the next one
     */
    _physicsInput(command, previous) {
        const side  = ((this._data.selection.mirror) ? -1 : 1);
        const left  = command.isPressed((side > 0) ? RacingCommand.STEER_LEFT : RacingCommand.STEER_RIGHT);
        const right = command.isPressed((side > 0) ? RacingCommand.STEER_RIGHT : RacingCommand.STEER_LEFT);
        const stick = (command.getSteerAxis() * side);
        const axis  = ((!left && !right && (stick !== 0)) ? stick : null);
        const input = this._input;
        input.accelerate = command.isPressed(RacingCommand.ACCELERATE);
        input.brake      = command.isPressed(RacingCommand.BRAKE);
        input.steer      = ((axis !== null) ? Math.sign(axis) : (((left) ? 1 : 0) - ((right) ? 1 : 0)));
        input.steerAxis  = axis;
        input.gearUp     = command.isJustPressed(RacingCommand.GEAR_UP, previous);
        input.gearDown   = command.isJustPressed(RacingCommand.GEAR_DOWN, previous);

        return input;
    }
}

// Big Forest starts in the pit box, with the mechanics ($6AB4).
RacingSimulation.PIT_START_COURSES = ['big_forest'];
// A race alone starts on the first place of the race grid of the original, the Time Attack's.
RacingSimulation.TIME_ATTACK_PLACE = 0;
RacingSimulation.PAIR              = 2;
RacingSimulation.EPSILON           = 1e-6;
// A player without a command this step: off the pedals, wheels straight.
RacingSimulation.NEUTRAL_COMMAND   = new RacingCommand();
// The overtaking sound by car, and when it plays ($87E2): speeds +$04 apart by more than 20, more than 100 together; at
// Sand Park, bits 1-2 of the road flags +$E5 equal (the same layer of road).
RacingSimulation.OVERTAKE_SOUNDS   = {formula: 'B3', stock: 'CC', prototype: 'CF'};
RacingSimulation.OVERTAKE_GAP_KMH  = 20;
RacingSimulation.OVERTAKE_SUM_KMH  = 100;
RacingSimulation.LAYERED_COURSE    = 'sand_park';
RacingSimulation.ROAD_LAYER_BITS   = 0x06;

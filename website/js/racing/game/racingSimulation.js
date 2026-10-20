/**
 * The race of one course and the rules that move it: each player's car with the physics of the original transposed
 * to the frame time (RacingCarContinuousPhysics), its Time Attack race (RacingRaceControl) and the work of its pit
 * crew (RacingPitWork), and the step that advances everything from one command per player. It runs on the main alone,
 * never reads a device and never draws: RacingMainRole feeds it; after each step it writes the state every device
 * shows (RacingCarState) and emits the one-shot events (RacingTurnEvents), which RacingPresentation shows without
 * knowing it.
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
        this._roster   = roster;
        this._events   = events;
        this._random   = random;
        this._data     = null;
        this._pitWork  = new Map();     // player id → RacingPitWork of its car
        this._previous = new Map();     // player id → its command of the previous step, the presses derived from it
        this._input    = {accelerate: false, brake: false, steer: 0, steerAxis: null, gearUp: false, gearDown: false};
        this._onFinish = null;
        this._onRecord = null;
    }

    /**
     * The course the race runs on, and what its races report.
     *
     * @param {object}   data
     * @param {object}   data.physics    - physics.json
     * @param {object}   data.race       - race.json
     * @param {object}   data.course     - the course's export (its collision)
     * @param {object}   data.selection  - {course, mirror, car, gearbox}
     * @param {int}      data.laps
     * @param {string[]} data.lapJingles - music command of the lap done, by laps done (racingSound.laps)
     * @param {function(RacingPlayer, object)} onFinish - a player's race is over: its result (RacingRaceControl.result)
     * @param {function(RacingPlayer, object)} onRecord - a new record of a player's lap, as soon as it is done:
     *                                                   {lapMs, checkpointsMs}
     */
    adoptRace(data, onFinish, onRecord) {
        this._data     = data;
        this._onFinish = onFinish;
        this._onRecord = onRecord;

        return this;
    }

    /**
     * Gives the player its car on its place of the start grid (its slot's), its race against its record.
     *
     * @param {RacingPlayer} player
     * @param {{lapMs: number, checkpointsMs: (number|null)[]}|null} record - null before any lap
     */
    addPlayer(player, record) {
        const {physics: physicsData, race, course, selection} = this._data;
        const index   = racingCatalog.getCourseIndex(selection.course);
        const physics = new RacingCarContinuousPhysics(physicsData, selection.car, (selection.gearbox === RacingMenuNavigator.GEARBOX_MANUAL), {
            index:     index,
            collision: new RacingCourseCollision(course.collision),
            ...race.courses[selection.course],
            pit:       RacingCarPhysics.coursePit(race, selection.course),
        });
        const [x, height, z, heading] = race.startGrids[selection.car].race[index][RacingSimulation._gridPlace(player)];
        physics.laps = this._data.laps;
        // Damage on every course (user decision: the original damages the cars on Acropolis and Highland only, $D19C).
        physics.damaging = true;
        // After a wall or a crash the player steers (user decision: the original drives the car back to its line 2 s).
        physics.drivenBackOnTrack = false;
        physics.pitWorkByCrew = true;
        physics.place(x, height, z, heading);

        const id          = player.getId();
        const raceControl = new RacingRaceControl(physics, race.courses[selection.course], record,
            RacingSimulation.PIT_START_COURSES.includes(selection.course), this._data.lapJingles, race.checkpointJingles)
            .setOnSound((command) => this._events.sound(id, command))
            .setCrewSoundsByClips(true)
            .setOnRecord((lap) => this._onRecord(player, lap))
            .setOnFinish((result) => this._onFinish(player, result));
        player.enterRace(physics, raceControl);
        player.getCarState().capture(physics);
        this._pitWork.set(id, new RacingPitWork(player, this._events, this._random));

        return this;
    }

    /**
     * One step of the race: each car moves by its command, then its race and its crew go on.
     *
     * @param {number}                  ticks    - time elapsed, in original ticks
     * @param {Map<int, RacingCommand>} commands - by player id
     */
    tick(ticks, commands) {
        for (const player of this._roster.getAll()) {
            const physics = player.getPhysics();
            if (physics === null) {
                continue;
            }
            const command = (commands.get(player.getId()) ?? RacingSimulation.NEUTRAL_COMMAND);
            physics.step(this._physicsInput(command, (this._previous.get(player.getId()) ?? null)), ticks);
            this._previous.set(player.getId(), command);
            // The race sends its sounds as it updates: before those of the physics step.
            player.getRace().update(ticks);
            for (const command of physics.sounds) {
                this._events.sound(player.getId(), command);
            }
            physics.sounds.length = 0;
            this._pitWork.get(player.getId()).update(ticks);
            player.getCarState().capture(physics);
        }
    }

    // The grid is taken in slot order: the main on the first place.
    static _gridPlace(player) {
        return (player.getId() - RacingPlayer.MAIN_ID);
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
// A player without a command this step: off the pedals, wheels straight.
RacingSimulation.NEUTRAL_COMMAND   = new RacingCommand();

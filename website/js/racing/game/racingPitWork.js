/**
 * The work of the pit crew on the car, for the simulation (pitWorkByCrew, user decision: the crew's own pace sets the
 * stop): a passage starts with the pit start sequence, all mechanics at once, or with the work of a stop, each one as
 * drawn on this device alone; the car is repaired once the last mechanic reaches the repair, and leaves 4 ticks after
 * the last one is done (RacingPitCrewSchedule). The start of a passage goes out with its schedule (RacingTurnEvents):
 * the mechanics the presentation animates follow it.
 */
class RacingPitWork {
    /**
     * @param {RacingPlayer}       player - in the race
     * @param {RacingTurnEvents}   events
     * @param {function(): number} random - uniform in [0, 1[, the stops' draw
     */
    constructor(player, events, random) {
        this._player    = player;
        this._physics   = player.getPhysics();
        this._race      = player.getRace();
        this._events    = events;
        this._random    = random;
        this._started   = false;
        this._seconds   = 0;            // since the start of the passage
        this._repaired  = false;
        this._finished  = false;
        this._releaseIn = null;         // ticks before the car leaves the box
        this._schedule  = null;
    }

    /**
     * After the race of the frame: the passage under way goes on, or a new one starts.
     *
     * @param {number} ticks - time elapsed, in original ticks
     */
    update(ticks) {
        const physics = this._physics;
        if (physics.pitCrewFrame < 0) {
            this._started = false;
        }
        if (this._started) {
            this._seconds += ((ticks * RacingGame.TICK_MS) / RacingGame.MS_PER_SECOND);
            this._repair();
            if (!this._finished && (this._seconds >= this._schedule.finishedAt())) {
                this._finished  = true;
                this._releaseIn = ((RacingPitCrewSchedule.RELEASE_DELAY * RacingGame.MS_PER_SECOND) / RacingGame.TICK_MS);
            }
        }
        this._release(ticks);
        if (!this._started && (physics.pitCrewFrame >= 0) && (this._race.crewRunning || (physics.pitState === RacingCarPhysics.PIT_WORK))) {
            this._start();
        }

        return this;
    }

    _start() {
        this._schedule  = ((this._race.crewRunning) ? RacingPitCrewSchedule.start() : RacingPitCrewSchedule.draw(this._random));
        this._started   = true;
        this._seconds   = 0;
        this._repaired  = false;
        this._finished  = false;
        this._releaseIn = null;
        this._events.crewStarted(this._player.getId(), this._schedule);
    }

    // The last mechanic reaches the repair (the original's frame 20, $AB88).
    _repair() {
        if (this._repaired || (this._seconds < this._schedule.repairedAt())) {
            return;
        }
        this._repaired = true;
        if (this._physics.damage !== 0) {
            this._physics.setDamage(0);
        }
    }

    // The count starts on the frame the last mechanic is done, as the original after its last frame (tick 116 of 120).
    _release(ticks) {
        if (this._releaseIn === null) {
            return;
        }
        this._releaseIn -= ticks;
        if (this._releaseIn <= 0) {
            this._releaseIn = null;
            this._physics.releaseFromPit();
        }
    }
}

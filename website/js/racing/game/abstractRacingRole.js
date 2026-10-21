/**
 * What a device does with the race it shows — the contract RacingGame drives, one implementation per kind of device,
 * as AbstractGameRole of doom: RacingMainRole simulates (alone, or as the main of a session), RacingSubRole follows
 * the main's race. RacingGame runs the flow every device shares and asks its role, never which role it is.
 */
class AbstractRacingRole {
    /**
     * The course the race runs on, inside the loader batch.
     *
     * @param {object}           data     - see RacingSimulation.adoptRace
     * @param {function(object)} onFinish - this device's player's race is over: see RacingRaceControl.result
     * @param {function(object)} onRecord - a new record of this device's player's lap: {lapMs, checkpointsMs}
     */
    adoptRace(data, onFinish, onRecord) {
        throw new Error('AbstractRacingRole: adoptRace not implemented');
    }

    /**
     * The players' cars enter the race, on the places of their slots.
     *
     * @param {{lapMs: number, checkpointsMs: (number|null)[]}|null} record - this device's, null before any lap
     */
    enterRace(record) {
        throw new Error('AbstractRacingRole: enterRace not implemented');
    }

    /**
     * @returns {RacingRaceOutcome} the end of a race of several players, as this device shows it
     */
    getOutcome() {
        throw new Error('AbstractRacingRole: getOutcome not implemented');
    }

    /**
     * @param {int} id - a player of the race, still there or not
     * @returns {string} its nickname in the session, '' outside one
     */
    getNickname(id) {
        throw new Error('AbstractRacingRole: getNickname not implemented');
    }

    /**
     * The race is shown.
     *
     * @param {object} level - {course, mirror, car, gearbox, laps}
     */
    levelStarted(level) {
        throw new Error('AbstractRacingRole: levelStarted not implemented');
    }

    /**
     * @param {boolean} paused - this device's pause menu is open over the race, which stops it for everyone
     */
    setLocalPaused(paused) {
        throw new Error('AbstractRacingRole: setLocalPaused not implemented');
    }

    /**
     * @returns {boolean} another player's pause holds the race: its frames are frozen here
     */
    isHeld() {
        throw new Error('AbstractRacingRole: isHeld not implemented');
    }

    /**
     * @param {number} now
     * @returns {boolean} whether the next turn may run on this frame
     */
    isTurnReady(now) {
        throw new Error('AbstractRacingRole: isTurnReady not implemented');
    }

    /**
     * One live frame of the race, never under the pause.
     *
     * @param {number}               ticks   - time elapsed, in original ticks
     * @param {RacingCommandSampler} sampler - the local player's, collected up to this frame
     * @param {number}               now     - performance.now() clock
     * @returns {number} the ticks of race the frame presents: the ones simulated, or the main's ones received
     */
    advance(ticks, sampler, now) {
        throw new Error('AbstractRacingRole: advance not implemented');
    }

    // The race is left for the menus.
    leave() {
        throw new Error('AbstractRacingRole: leave not implemented');
    }
}

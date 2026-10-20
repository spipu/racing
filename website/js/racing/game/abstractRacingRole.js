/**
 * What a device does with the race it shows — the contract RacingGame drives, one implementation per kind of device,
 * as AbstractGameRole of doom: RacingMainRole simulates (alone, or as the main of a session); a sub will follow the
 * main's race. RacingGame runs the flow every device shares and asks its role, never which role it is.
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
     * The local player's car enters the race.
     *
     * @param {{lapMs: number, checkpointsMs: (number|null)[]}|null} record - this device's, null before any lap
     */
    enterRace(record) {
        throw new Error('AbstractRacingRole: enterRace not implemented');
    }

    /**
     * One live frame of the race, never under the pause.
     *
     * @param {number}               ticks   - time elapsed, in original ticks
     * @param {RacingCommandSampler} sampler - the local player's, collected up to this frame
     */
    advance(ticks, sampler) {
        throw new Error('AbstractRacingRole: advance not implemented');
    }
}

/**
 * Every one-shot event of the race — a sound command, the start of a pit crew's passage, a lap record — as plain
 * data, with what the simulation drew for it (the crew's schedule). The simulation emits, the listeners receive each
 * event as it is emitted: the presentation plays it at once, so the sounds come in the order the step made them, and a
 * session can listen too to send it with the turn.
 */
class RacingTurnEvents {
    constructor() {
        this._listeners = [];
    }

    /**
     * @param {function(object)} listener - receives every event as it is emitted
     */
    addListener(listener) {
        this._listeners.push(listener);

        return this;
    }

    removeListener(listener) {
        this._listeners = this._listeners.filter((other) => (other !== listener));

        return this;
    }

    /**
     * @param {int}    playerId - whose car or race sends it
     * @param {string} command  - sound command id (racingSound.send)
     */
    sound(playerId, command) {
        this._emit({type: RacingTurnEvents.SOUND, playerId: playerId, command: command});
    }

    /**
     * @param {int}                   playerId
     * @param {RacingPitCrewSchedule} schedule - when each mechanic starts its clip, and how fast it plays it
     */
    crewStarted(playerId, schedule) {
        this._emit({type: RacingTurnEvents.CREW_STARTED, playerId: playerId, schedule: schedule});
    }

    /**
     * A new record of a player's lap, as soon as it is done: the device of that player keeps it.
     *
     * @param {int}    playerId
     * @param {{lapMs: number, checkpointsMs: (number|null)[]}} lap
     */
    lapRecord(playerId, lap) {
        this._emit({type: RacingTurnEvents.LAP_RECORD, playerId: playerId, lapMs: lap.lapMs, checkpointsMs: lap.checkpointsMs.slice()});
    }

    _emit(event) {
        for (const listener of this._listeners) {
            listener(event);
        }
    }
}

RacingTurnEvents.SOUND        = 'sound';
RacingTurnEvents.CREW_STARTED = 'crewStarted';
RacingTurnEvents.LAP_RECORD   = 'lapRecord';

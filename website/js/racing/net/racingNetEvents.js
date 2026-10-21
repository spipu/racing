/**
 * The one-shot events of a turn as the turn message carries them, as DoomNetEvents: a listener of RacingTurnEvents
 * that keeps each event as plain data — a sound command by its player, the start of a crew's passage with the delays
 * and speeds of its mechanics. An event says what happens, never how a device perceives it.
 */
class RacingNetEvents {
    constructor() {
        this._events   = [];
        this._listener = (event) => this._record(event);
    }

    // The listener to add to the turn events.
    getListener() {
        return this._listener;
    }

    /**
     * @returns {object[]} the events recorded since the previous drain
     */
    drain() {
        const events = this._events;
        this._events = [];

        return events;
    }

    _record(event) {
        if (event.type === RacingTurnEvents.SOUND) {
            this._events.push({type: event.type, playerId: event.playerId, command: event.command});
            return;
        }
        const count = RacingPitCrewSchedule.MECHANICS;
        this._events.push({
            type:     event.type,
            playerId: event.playerId,
            delays:   Array.from({length: count}, (unused, n) => event.schedule.getDelay(n)),
            speeds:   Array.from({length: count}, (unused, n) => event.schedule.getSpeed(n))
        });
    }
}

/**
 * The replicated state of a turn, built on the main as plain data (no encoding), as DoomNetStateCapture: the time the
 * turn ran, every car on the track — what the presentation draws of it (RacingCarState) and the display of its race
 * (RacingRaceView) —, the end of a race of several players (RacingRaceOutcome) and the events of the turn. What the
 * simulation alone reads stays on the main.
 */
class RacingNetStateCapture {
    /**
     * @param {RacingPlayerRoster} roster
     * @param {RacingRaceOutcome}  outcome
     * @param {RacingNetEvents}    events
     */
    constructor(roster, outcome, events) {
        this._roster  = roster;
        this._outcome = outcome;
        this._events  = events;
        this._races   = new Map();   // player id → the RacingRaceView its race is captured into
    }

    /**
     * @param {int}    turn  - counted from the start of the session's cycle
     * @param {number} ticks - time the turn ran, in original ticks
     * @returns {object} the StateSnapshot of the turn
     */
    capture(turn, ticks) {
        const players = this._roster.getAll().filter((player) => (player.getRace() !== null))
            .sort((a, b) => (a.getId() - b.getId()));

        return {
            turn:    turn,
            ticks:   ticks,
            cars:    players.map((player) => ({id: player.getId(), car: player.getCarState(), race: this._race(player)})),
            outcome: this._outcome,
            events:  this._events.drain()
        };
    }

    _race(player) {
        let view = this._races.get(player.getId());
        if (view === undefined) {
            view = new RacingRaceView(player.getRace().laps);
            this._races.set(player.getId(), view);
        }

        return view.capture(player.getRace());
    }
}

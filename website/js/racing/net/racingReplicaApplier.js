/**
 * Writes a decoded turn state into the race a sub built, on its own, without any previous state, as
 * DoomReplicaApplier: each car's drawable state (RacingCarState) and the display of its race (RacingRaceView), a car
 * gone from the state taken off the track, the end of the race (RacingRaceOutcome), then the turn's events played. The
 * sub simulates nothing: its race is only ever posed.
 */
class RacingReplicaApplier {
    /**
     * @param {RacingPlayerRoster} roster
     * @param {RacingRaceOutcome}  outcome
     * @param {function(object)}   playEvent - RacingPresentation.playTurnEvent, the lap records included
     */
    constructor(roster, outcome, playEvent) {
        this._roster    = roster;
        this._outcome   = outcome;
        this._playEvent = playEvent;
    }

    /**
     * @param {object} snapshot - a decoded StateSnapshot
     */
    apply(snapshot) {
        const seen = new Set();
        for (const car of snapshot.cars) {
            const player = this._roster.getById(car.id);
            if ((player === null) || (player.getRace() === null)) {
                continue;
            }
            seen.add(car.id);
            RacingReplicaApplier._applyCar(player.getCarState(), car.car);
            Object.assign(player.getRace(), car.race);
        }
        // A sub gone: its car leaves the track, as on the main.
        for (const player of this._roster.getAll()) {
            if (!seen.has(player.getId()) && (player !== this._roster.getLocal())) {
                this._roster.remove(player.getId());
            }
        }
        Object.assign(this._outcome, snapshot.outcome);
        for (const event of snapshot.events) {
            this._playEvent(this._event(event));
        }
    }

    static _applyCar(state, car) {
        const frames = state.effectFrames;
        Object.assign(state, car, {effectFrames: frames});
        frames.smoke    = car.effectFrames.smoke;
        frames.flames   = car.effectFrames.flames;
        frames.sparks   = car.effectFrames.sparks;
        frames.grass[0] = car.effectFrames.grass[0];
        frames.grass[1] = car.effectFrames.grass[1];
        frames.sand[0]  = car.effectFrames.sand[0];
        frames.sand[1]  = car.effectFrames.sand[1];
    }

    // The RacingTurnEvents event the presentation plays.
    _event(event) {
        if (event.type === RacingTurnEvents.CREW_STARTED) {
            return {type: event.type, playerId: event.playerId, schedule: new RacingPitCrewSchedule(event.delays, event.speeds)};
        }

        return event;
    }
}

/**
 * The end of a race of several players as every device shows it, the same on every one: written by the simulation on
 * the main, by the replica of its state elsewhere. From the first finish the others have FINISH_WINDOW_MS left (user
 * decision 2026-10-11); the race is over once every car still on the track is finished, its last lap done or stopped
 * when the time ran out. A player gone after the start, before its finish, abandoned; one gone after its finish keeps
 * its result (user decisions).
 */
class RacingRaceOutcome {
    constructor() {
        this.countdownMs = null;   // time left to the others after the first finish, null before it
        this.over        = false;
        this.abandons    = [];     // player ids, in the order they left
    }

    /**
     * The standings as the results show them: the cars by their places (finished by race time, stopped where they were,
     * then by the ranking of the original, RacingSimulation), then the abandons.
     *
     * @param {RacingPlayer[]} players - on the track
     * @returns {{id: int, race: object|null}[]} race: the player's race display, null for an abandon
     */
    standings(players) {
        const byPlace = players.slice().sort((a, b) => (a.getRace().place - b.getRace().place));

        return [
            ...byPlace.map((player) => ({id: player.getId(), race: player.getRace()})),
            ...this.abandons.map((id) => ({id: id, race: null}))
        ];
    }
}

RacingRaceOutcome.FINISH_WINDOW_MS = 30000;

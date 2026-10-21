/**
 * The end of a race of several players as every device shows it, the same on every one: written by the simulation on
 * the main, by the replica of its state elsewhere. From the first finish the others have FINISH_WINDOW_MS left (user
 * decision 2026-10-11); the race is over once every car still on the track is finished, its last lap done or stopped
 * when the time ran out. A player whose car left the track after the start abandoned.
 */
class RacingRaceOutcome {
    constructor() {
        this.countdownMs = null;   // time left to the others after the first finish, null before it
        this.over        = false;
        this.abandons    = [];     // player ids, in the order they left
    }

    /**
     * The standings as the results show them: the finished cars by their race time, then the others by their place on
     * the track (RacingRaceControl.place), then the abandons.
     *
     * @param {RacingPlayer[]} players - on the track
     * @returns {{id: int, race: object|null}[]} race: the player's race display, null for an abandon
     */
    standings(players) {
        const classified = players.filter((player) => (player.getRace().finished && !player.getRace().stopped))
            .sort((a, b) => (RacingRaceOutcome.raceMs(a.getRace()) - RacingRaceOutcome.raceMs(b.getRace())));
        const others     = players.filter((player) => !classified.includes(player))
            .sort((a, b) => (a.getRace().place - b.getRace().place));

        return [
            ...[...classified, ...others].map((player) => ({id: player.getId(), race: player.getRace()})),
            ...this.abandons.map((id) => ({id: id, race: null}))
        ];
    }

    /**
     * @param {object} race - RacingRaceControl or RacingRaceView
     * @returns {number} the time of its laps done
     */
    static raceMs(race) {
        return race.lapTimes.reduce((sum, ms) => (sum + ms), 0);
    }
}

RacingRaceOutcome.FINISH_WINDOW_MS = 30000;

/**
 * When each of the 4 mechanics starts its clip and how fast it plays it, for one passage of the crew (the pit start
 * or a stop); the original plays them all at once, at its own pace.
 */
class RacingPitCrewSchedule {
    /**
     * @param {number[]} delays - seconds before each mechanic starts
     * @param {number[]} speeds - playback speed of each mechanic's clip
     */
    constructor(delays, speeds) {
        this._delays = [...delays];
        this._speeds = [...speeds];
        Object.freeze(this);
    }

    /**
     * The original's: every mechanic at once, at the clips' pace.
     *
     * @returns {RacingPitCrewSchedule}
     */
    static start() {
        const count = RacingPitCrewSchedule.MECHANICS;

        return new RacingPitCrewSchedule(new Array(count).fill(0), new Array(count).fill(1));
    }

    /**
     * @param {int} mechanic
     * @returns {number} seconds
     */
    getDelay(mechanic) {
        return this._delays[mechanic];
    }

    /**
     * @param {int} mechanic
     * @returns {number}
     */
    getSpeed(mechanic) {
        return this._speeds[mechanic];
    }
}

RacingPitCrewSchedule.MECHANICS = 4;

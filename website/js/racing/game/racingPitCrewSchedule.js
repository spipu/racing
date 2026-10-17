/**
 * When each of the 4 mechanics starts its clip and how fast it plays it, for one passage of the crew (the pit start
 * or a stop); the original plays them all at once, at its own pace. At a stop each mechanic gets its own (project
 * decision): a delay, and an end around the original's, its whole clip played in between.
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
     * A stop's: each mechanic starts within [0, 0.5] s and ends within [5.3, 6.3] s (the original's end, 5.8 s, ± 0.5 s).
     *
     * @param {function(): number} random - uniform in [0, 1[ (Math.random)
     * @returns {RacingPitCrewSchedule}
     */
    static draw(random) {
        const delays = [];
        const speeds = [];
        for (let n = 0; n < RacingPitCrewSchedule.MECHANICS; n++) {
            const delay = (random() * RacingPitCrewSchedule.DELAY_MAX);
            const end   = (RacingPitCrewSchedule.END_RANGE[0] + (random() * (RacingPitCrewSchedule.END_RANGE[1] - RacingPitCrewSchedule.END_RANGE[0])));
            delays.push(delay);
            speeds.push(RacingPitCrewSchedule.CLIP_END / (end - delay));
        }

        return new RacingPitCrewSchedule(delays, speeds);
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

    /**
     * @returns {number} seconds from the start: the last mechanic reaches the repair (the original's frame 20)
     */
    repairedAt() {
        return this._latest(RacingPitCrewSchedule.CLIP_REPAIR);
    }

    /**
     * @returns {number} seconds from the start: the last mechanic is done
     */
    finishedAt() {
        return this._latest(RacingPitCrewSchedule.CLIP_END);
    }

    /**
     * @returns {number} seconds from the start: the car leaves, as the original 4 ticks after its last frame
     */
    releaseAt() {
        return (this.finishedAt() + RacingPitCrewSchedule.RELEASE_DELAY);
    }

    // When the last mechanic reaches a time of its clip.
    _latest(clipTime) {
        return Math.max(...this._delays.map((delay, n) => (delay + (clipTime / this._speeds[n]))));
    }
}

RacingPitCrewSchedule.MECHANICS     = 4;
RacingPitCrewSchedule.DELAY_MAX     = 0.5;
RacingPitCrewSchedule.END_RANGE     = [5.3, 6.3];
// The clips' repair (frame 20, tick 86) and end (frame 27, tick 116), seconds; the original leaves at tick 120.
RacingPitCrewSchedule.CLIP_REPAIR   = 4.3;
RacingPitCrewSchedule.CLIP_END      = 5.8;
RacingPitCrewSchedule.RELEASE_DELAY = 0.2;

/**
 * The display of a player's race as the HUD and the camera read it, the same shape as RacingRaceControl's: written
 * from the race (capture) by the device that simulates it, by the replica of the main's state elsewhere — as
 * RacingCarState is to the physics. Only what is shown travels: the times of the laps, the start signs and lights,
 * the messages, the blinds, the blinking.
 */
class RacingRaceView {
    /**
     * @param {int} laps - of the race
     */
    constructor(laps) {
        this.laps         = laps;
        this.lapTimes     = [];
        this.lapMs        = 0;
        this.record       = null;       // {lapMs}, null before any lap
        this.started      = false;
        this.finished     = false;
        this.startSign    = null;       // 3, 2, 1, SIGN_GO, SIGN_READY
        this.lights       = null;       // LIGHTS_*
        this.pitStartSign = false;
        this.message      = null;       // {kind, ms, shown}
        this.split        = null;       // {ms, shown}
        this.reverse      = false;
        this.pitWork      = false;
        this.blinds       = 1;
        this.blink        = 0;          // RacingRaceControl's blinking counter
    }

    /**
     * @param {RacingRaceControl} race - after its update
     */
    capture(race) {
        this.laps         = race.laps;
        if (this.lapTimes.length !== race.lapTimes.length) {
            this.lapTimes = race.lapTimes.slice();
        }
        this.lapMs        = race.lapMs;
        this.record       = ((race.record === null) ? null : {lapMs: race.record.lapMs});
        this.started      = race.started;
        this.finished     = race.finished;
        this.startSign    = race.startSign;
        this.lights       = race.lights;
        this.pitStartSign = race.pitStartSign;
        this.message      = race.message;
        this.split        = race.split;
        this.reverse      = race.reverse;
        this.pitWork      = race.pitWork;
        this.blinds       = race.blinds;
        this.blink        = race.getBlink();

        return this;
    }

    /**
     * @returns {boolean} as RacingRaceControl.isBlinkOn
     */
    isBlinkOn(firstOn) {
        const on = ((this.blink & RacingRaceControl.BLINK_BIT) === 0);

        return ((firstOn) ? on : !on);
    }
}

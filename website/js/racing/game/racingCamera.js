/**
 * The 4 camera views of the original ($C048): 0 cockpit, 1 close chase (start
 * view), 2 far chase, 3 high view. One button steps through them in a loop,
 * 0 1 2 3 0... (project decision); the race starts on view 1.
 *
 * The camera hangs on a boom from the car's ground point: the boom leaves it
 * backwards and upwards ($C056, $C054, in 1/256 m) in a frame tilted down by
 * $C0C8 (192 / 8192 turn), and the camera looks along that frame (fitted on
 * the 4 views of the original, the cockpit one to its models). A
 * change of view plays the per-tick boom lengths of the car's transition
 * table (physics.json viewTransitions, 20 Hz) over the elapsed time.
 * Shaped like the viewer Engine3d.setCamera expects.
 */
class RacingCamera {
    /**
     * @param {int[][][]} transitions - 16 transitions (old view x 4 + new view) of [$C054, $C056] per tick
     */
    constructor(transitions) {
        this._transitions = transitions;
        this._view        = RacingCamera.START_VIEW;
        this._order       = RacingCamera.ORDER.indexOf(RacingCamera.START_VIEW);
        this._steps       = null;
        this._elapsed     = 0;
        this._from        = null;
        this._units       = this._rest(RacingCamera.START_VIEW);
        this._x           = 0;
        this._y           = 0;
        this._z           = 0;
        this._roll        = 0;
        // Read as fields by Engine3d.setCamera.
        this.yaw          = 0;
        this.pitch        = -RacingCamera.PITCH_DEGREES;
    }

    /**
     * @returns {int} 0..3
     */
    getView() {
        return this._view;
    }

    // The next view of the loop, its boom moving over the transition ticks.
    cycleView() {
        this._order = ((this._order + 1) % RacingCamera.ORDER.length);
        const next  = RacingCamera.ORDER[this._order];
        this._steps   = this._transitions[this._transition(this._view, next)];
        this._elapsed = 0;
        this._from    = this._units;
        this._view    = next;

        return this;
    }

    /**
     * The camera pitches and rolls with the car ($2984: the car's angles >> 3 plus $C0C8 / $C0CC, in 1/8192 turn).
     *
     * @param {number}   ticks    - time elapsed, in original ticks
     * @param {number[]} position - car position on the ground, metres
     * @param {number}   yaw      - car yaw, degrees
     * @param {number}   pitch    - car pitch, degrees, nose down positive
     * @param {number}   roll     - car roll, degrees, the engine's lean
     */
    follow(ticks, position, yaw, pitch = 0, roll = 0) {
        this._advance(ticks);
        const up    = (this._units[0] / RacingCamera.UNITS_PER_METRE);
        const back  = (this._units[1] / RacingCamera.UNITS_PER_METRE);
        const down  = (RacingCamera.PITCH_DEGREES + pitch);
        const tilt  = ((down * Math.PI) / 180);
        const ahead = ((up * Math.sin(tilt)) - (back * Math.cos(tilt)));
        const rise  = ((up * Math.cos(tilt)) + (back * Math.sin(tilt)));
        const turn  = ((yaw * Math.PI) / 180);
        this.pitch  = -down;
        this.yaw    = yaw;
        this._roll  = roll;
        this._x     = (position[0] + (Math.sin(turn) * ahead));
        this._y     = (position[1] + rise);
        this._z     = (position[2] + (Math.cos(turn) * ahead));

        return this;
    }

    getStrafeLean() {
        return this._roll;
    }

    getCameraX() {
        return this._x;
    }

    getCameraY() {
        return this._y;
    }

    getCameraZ() {
        return this._z;
    }

    // Boom lengths between the transition steps, one step a tick.
    _advance(ticks) {
        if (this._steps === null) {
            return;
        }
        this._elapsed += ticks;
        const steps = this._steps;
        if (this._elapsed >= steps.length) {
            this._units = steps[steps.length - 1];
            this._steps = null;
            return;
        }
        const index = Math.floor(this._elapsed);
        const from  = ((index === 0) ? this._from : steps[index - 1]);
        const to    = steps[index];
        const share = (this._elapsed - index);
        this._units = [(from[0] + ((to[0] - from[0]) * share)), (from[1] + ((to[1] - from[1]) * share))];
    }

    // The boom of a view at rest: the last step of a transition into it, from view 0 (from 1 into the cockpit,
    // a view does not move into itself).
    _rest(view) {
        const from  = ((view === RacingCamera.VIEW_COCKPIT) ? RacingCamera.START_VIEW : RacingCamera.VIEW_COCKPIT);
        const steps = this._transitions[this._transition(from, view)];

        return steps[steps.length - 1];
    }

    _transition(from, to) {
        return ((from * RacingCamera.VIEWS) + to);
    }
}

RacingCamera.VIEWS           = 4;
RacingCamera.VIEW_COCKPIT    = 0;
RacingCamera.START_VIEW      = 1;
RacingCamera.ORDER           = [0, 1, 2, 3];
RacingCamera.UNITS_PER_METRE = 256;
// $C0C8 = 192 / 8192 turn.
RacingCamera.PITCH_DEGREES   = ((192 / 8192) * 360);
// Vertical half field of the original: focal of ~125 pixels on 320, pixels 0.933 as wide as high, 112 lines up.
RacingCamera.VERTICAL_HALF_FOV_DEGREES = 40;

/**
 * The physics of the original transposed to a variable time step (project
 * decision): every display frame advances the car by the time elapsed, as a
 * share of an original tick. Each routine of RacingCarPhysics computes the
 * change of a whole tick with the original arithmetic, roundings included;
 * the time hooks then apply the elapsed share of it:
 *   - a change per tick is scaled by the share (speed, pedals, heading, position...);
 *   - a decay or an averaging per tick is raised to its power;
 *   - a tick counter becomes a duration in ticks (timers, deflection, carrying back);
 *   - an animation table read once a tick is blended between its rows (crash, shake).
 * Values are no longer kept in 16-bit words; headings still wrap at a turn.
 * Behaviour matches the original up to rounding: the bench compares it with
 * the traces (bench/comparePhysics.js --continuous).
 */
class RacingCarContinuousPhysics extends RacingCarPhysics {
    constructor(...args) {
        super(...args);
        this._t = 1;
    }

    /**
     * @param {object} input - see RacingCarPhysics.tick
     * @param {number} ticks - time elapsed, in original ticks (50 ms)
     */
    step(input, ticks) {
        let left  = ticks;
        let press = input;
        while (left > 0) {
            this._t = Math.min(left, RacingCarContinuousPhysics.MAX_STEP);
            left   -= this._t;
            this.tick(press);
            // A press acts once.
            press = {...input, gearUp: false, gearDown: false};
        }

        return this;
    }

    _scaled(delta) {
        return (delta * this._t);
    }

    _countDown(value) {
        return Math.max(0, (value - this._t));
    }

    _word(value) {
        return value;
    }

    _angle(value) {
        return ((((value + 32768) % 65536) + 65536) % 65536) - 32768;
    }

    _decay(value, shift) {
        return (value * Math.pow((1 - Math.pow(2, -shift)), this._t));
    }

    _halfway(value, target) {
        return (value + ((target - value) * (1 - Math.pow(0.5, this._t))));
    }

    _halfShare(gap) {
        return (gap * (1 - Math.pow(0.5, this._t)));
    }

    _shareOf(gap, divisor) {
        return (gap * (1 - Math.pow((1 - (1 / divisor)), this._t)));
    }

    _tickEnd(value, rate) {
        const end = (value + (rate * (1 - this._t)));

        // A move towards zero stops there.
        return (((value * end) < 0) ? 0 : end);
    }

    _shakeYawAt(position) {
        const table = this._common.shakeTable;
        const last  = (table.length - 1);
        const low   = Math.min(Math.floor(position), last);
        const high  = Math.min((low + 1), last);

        return (table[low] + ((table[high] - table[low]) * Math.min((position - low), 1)));
    }

    // The lift is a length, the other columns angles blended the shorter way round.
    _crashPoseAt(position) {
        const table = this._common.crashRecovery;
        const low   = Math.floor(position);
        const high  = Math.min((low + 1), (table.length - 1));
        const share = (position - low);

        return table[low].map((value, column) => {
            const gap = (table[high][column] - value);

            return (value + (((column === RacingCarContinuousPhysics.CRASH_LIFT) ? gap : this._angle(gap)) * share));
        });
    }

    _quarter(value) {
        return (value / 4);
    }
}

// At most one original tick per physics step: a long frame is cut, so walls and probes are not skipped.
RacingCarContinuousPhysics.MAX_STEP   = 1;
// Column of the crash table holding the lift, a length.
RacingCarContinuousPhysics.CRASH_LIFT = 0;

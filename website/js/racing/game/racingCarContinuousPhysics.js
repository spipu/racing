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
        this._t         = 1;
        this._clock     = 0;
        this._tickIndex = null;
        this._tickStart = {};
        this._stepStart = {heading: 0, speed: 0};
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
            this._keepTickStart();
            this._stepStart = {heading: this._angle(this.heading + this.shownSlip), speed: this.speed};
            this.tick(press);
            this._clock += this._t;
            // A press acts once.
            press = {...input, gearUp: false, gearDown: false};
        }

        return this;
    }

    // The values an original tick reads from the tick before, kept as they were when this tick began.
    _keepTickStart() {
        const index = Math.floor(this._clock + RacingCarContinuousPhysics.EPSILON);
        if (index === this._tickIndex) {
            return;
        }
        this._tickIndex = index;
        for (const name of RacingCarContinuousPhysics.LAST_TICK_FIELDS) {
            this._tickStart[name] = ((Array.isArray(this[name])) ? this[name].slice() : this[name]);
        }
    }

    // Extrapolated at the pace of this step to the end of the tick it is part of.
    _tickEndHeading(heading) {
        return this._angle(heading + (this._angle(heading - this._stepStart.heading) * this._tickRemainder()));
    }

    _tickEndSpeed(speed) {
        return (speed + ((speed - this._stepStart.speed) * this._tickRemainder()));
    }

    // Share of the step's tick left after the step, over the step's length.
    _tickRemainder() {
        const end   = (this._clock + this._t);
        const share = (end - Math.floor(end + RacingCarContinuousPhysics.EPSILON));
        const left  = ((share < RacingCarContinuousPhysics.EPSILON) ? 0 : (1 - share));

        return (left / this._t);
    }

    _lastTick(name) {
        return this._tickStart[name] ?? this[name];
    }

    _scaled(delta) {
        return (delta * this._t);
    }

    // Snapped to zero: thirds of a tick do not add up to a whole one.
    _countDown(value) {
        const left = (value - this._t);

        return ((left < RacingCarContinuousPhysics.EPSILON) ? 0 : left);
    }

    // The original zeroes it at the start of its last tick: from the first step of that tick on.
    _endCountDown(value) {
        const left = (value - this._t);

        return ((left <= ((1 - this._t) + RacingCarContinuousPhysics.EPSILON)) ? 0 : left);
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
// Read by a tick as the tick before left them (RacingCarPhysics._lastTick).
RacingCarContinuousPhysics.LAST_TICK_FIELDS = ['throttle', 'brake', 'displaySpeed', 'offRoadWheels', 'sliding', 'probeHeights', 'slipInput'];
// Below it a share of a tick is a rounding error.
RacingCarContinuousPhysics.EPSILON    = 1e-6;
// Column of the crash table holding the lift, a length.
RacingCarContinuousPhysics.CRASH_LIFT = 0;

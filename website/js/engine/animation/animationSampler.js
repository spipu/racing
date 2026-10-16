/**
 * A curve of an animation clip (a glTF sampler): key times, key values and
 * the interpolation between them. Fixed once built and shared by every
 * instance: the caller keeps its own cursor (the key found last), which saves
 * the search while the time moves on.
 */
class AnimationSampler {
    /**
     * @param {Float32Array} times         - seconds, strictly increasing
     * @param {Float32Array} values        - components per key, three times as many in CUBICSPLINE (in-tangent,
     *                                       value, out-tangent)
     * @param {string}       interpolation - AnimationSampler.STEP, LINEAR or CUBICSPLINE
     * @param {int}          components    - floats per value
     * @param {boolean}      quaternion    - unit quaternions: slerp in LINEAR, normalized in CUBICSPLINE
     */
    constructor(times, values, interpolation, components, quaternion) {
        const perKey = ((interpolation === AnimationSampler.CUBICSPLINE) ? (AnimationSampler.CUBIC_PARTS * components) : components);
        AnimationSampler._check(AnimationSampler.INTERPOLATIONS.includes(interpolation), 'unknown interpolation ' + interpolation);
        AnimationSampler._check((times.length > 0), 'no key');
        AnimationSampler._check((values.length === (times.length * perKey)), 'values do not match ' + times.length + ' keys');
        for (let k = 1; k < times.length; k++) {
            AnimationSampler._check((times[k] > times[k - 1]), 'key times not strictly increasing at key ' + k);
        }

        this._times         = times;
        this._values        = values;
        this._interpolation = interpolation;
        this._components    = components;
        this._quaternion    = quaternion;
        this._perKey        = perKey;
        Object.freeze(this);
    }

    /**
     * @returns {{key: int}} a cursor for one reader of the curve
     */
    static createCursor() {
        return {key: 0};
    }

    getComponents() {
        return this._components;
    }

    getEndTime() {
        return this._times[this._times.length - 1];
    }

    /**
     * The value at t, the first or last key outside them.
     *
     * @param {number}       t
     * @param {{key: int}}   cursor
     * @param {Float32Array} out
     * @param {int}          offset - where the value is written in out
     */
    sample(t, cursor, out, offset) {
        const times = this._times;
        const last  = (times.length - 1);
        if (t <= times[0]) {
            cursor.key = 0;
            return this._writeKey(0, out, offset);
        }
        if (t >= times[last]) {
            cursor.key = last;
            return this._writeKey(last, out, offset);
        }
        let k = Math.min(cursor.key, (last - 1));
        while (times[k] > t) {
            k--;
        }
        while (times[k + 1] <= t) {
            k++;
        }
        cursor.key = k;
        const span  = (times[k + 1] - times[k]);
        const share = ((t - times[k]) / span);
        if (this._interpolation === AnimationSampler.STEP) {
            return this._writeKey(k, out, offset);
        }
        if (this._interpolation === AnimationSampler.LINEAR) {
            return this._linear(k, share, out, offset);
        }

        return this._cubic(k, share, span, out, offset);
    }

    _writeKey(k, out, offset) {
        const start = ((k * this._perKey) + this._valueOffset());
        for (let c = 0; c < this._components; c++) {
            out[offset + c] = this._values[start + c];
        }

        return out;
    }

    _linear(k, share, out, offset) {
        const a = (k * this._perKey);
        const b = (a + this._perKey);
        if (this._quaternion) {
            return Quaternion.slerp(out, offset, this._values, a, this._values, b, share);
        }
        for (let c = 0; c < this._components; c++) {
            out[offset + c] = this._values[a + c] + ((this._values[b + c] - this._values[a + c]) * share);
        }

        return out;
    }

    // Hermite: value k with its out-tangent, value k + 1 with its in-tangent, tangents per second.
    _cubic(k, share, span, out, offset) {
        const n      = this._components;
        const values = this._values;
        const s2     = (share * share);
        const s3     = (s2 * share);
        const h00    = ((2 * s3) - (3 * s2) + 1);
        const h10    = ((s3 - (2 * s2) + share) * span);
        const h01    = ((3 * s2) - (2 * s3));
        const h11    = ((s3 - s2) * span);
        const value0 = ((k * this._perKey) + n);
        const out0   = (value0 + n);
        const in1    = ((k + 1) * this._perKey);
        const value1 = (in1 + n);
        for (let c = 0; c < n; c++) {
            out[offset + c] = (h00 * values[value0 + c]) + (h10 * values[out0 + c]) + (h01 * values[value1 + c]) + (h11 * values[in1 + c]);
        }
        if (this._quaternion) {
            Quaternion.normalize(out, offset);
        }

        return out;
    }

    // In CUBICSPLINE, a key's value follows its in-tangent.
    _valueOffset() {
        return ((this._interpolation === AnimationSampler.CUBICSPLINE) ? this._components : 0);
    }

    static _check(condition, message) {
        if (!condition) {
            throw new Error('AnimationSampler - ' + message);
        }
    }
}

// glTF names.
AnimationSampler.STEP           = 'STEP';
AnimationSampler.LINEAR         = 'LINEAR';
AnimationSampler.CUBICSPLINE    = 'CUBICSPLINE';
AnimationSampler.INTERPOLATIONS = Object.freeze([AnimationSampler.STEP, AnimationSampler.LINEAR, AnimationSampler.CUBICSPLINE]);
// In-tangent, value, out-tangent.
AnimationSampler.CUBIC_PARTS    = 3;

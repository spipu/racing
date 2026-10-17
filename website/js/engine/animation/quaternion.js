/**
 * Unit quaternions [x, y, z, w] (glTF order), read and written at an offset
 * of any array, with no allocation. For column vectors, a ⊗ b turns by b
 * first, then by a.
 */
class Quaternion {
    static identity(out, o) {
        out[o]     = 0;
        out[o + 1] = 0;
        out[o + 2] = 0;
        out[o + 3] = 1;

        return out;
    }

    // A zero quaternion becomes the identity.
    static normalize(q, o) {
        const length = Math.hypot(q[o], q[o + 1], q[o + 2], q[o + 3]);
        if (length === 0) {
            return Quaternion.identity(q, o);
        }
        q[o]     /= length;
        q[o + 1] /= length;
        q[o + 2] /= length;
        q[o + 3] /= length;

        return q;
    }

    static dot(a, ao, b, bo) {
        return (a[ao] * b[bo]) + (a[ao + 1] * b[bo + 1]) + (a[ao + 2] * b[bo + 2]) + (a[ao + 3] * b[bo + 3]);
    }

    // a ⊗ b; out may be a or b.
    static multiply(out, oo, a, ao, b, bo) {
        const ax = a[ao];
        const ay = a[ao + 1];
        const az = a[ao + 2];
        const aw = a[ao + 3];
        const bx = b[bo];
        const by = b[bo + 1];
        const bz = b[bo + 2];
        const bw = b[bo + 3];
        out[oo]     = (aw * bx) + (ax * bw) + (ay * bz) - (az * by);
        out[oo + 1] = (aw * by) - (ax * bz) + (ay * bw) + (az * bx);
        out[oo + 2] = (aw * bz) + (ax * by) - (ay * bx) + (az * bw);
        out[oo + 3] = (aw * bw) - (ax * bx) - (ay * by) - (az * bz);

        return out;
    }

    /**
     * Spherical interpolation along the shortest arc; out may be a or b.
     *
     * @param {number} t - 0 gives a, 1 gives b
     */
    static slerp(out, oo, a, ao, b, bo, t) {
        let cos  = Quaternion.dot(a, ao, b, bo);
        let sign = 1;
        if (cos < 0) {
            cos  = -cos;
            sign = -1;
        }
        let wa = (1 - t);
        let wb = t;
        // Nearly the same rotation: sin(angle) tends to 0, the linear blend is exact enough.
        if (cos < Quaternion.LINEAR_COS) {
            const angle = Math.acos(cos);
            const sin   = Math.sin(angle);
            wa = (Math.sin((1 - t) * angle) / sin);
            wb = (Math.sin(t * angle) / sin);
        }
        wb *= sign;
        const x = (wa * a[ao]) + (wb * b[bo]);
        const y = (wa * a[ao + 1]) + (wb * b[bo + 1]);
        const z = (wa * a[ao + 2]) + (wb * b[bo + 2]);
        const w = (wa * a[ao + 3]) + (wb * b[bo + 3]);
        out[oo]     = x;
        out[oo + 1] = y;
        out[oo + 2] = z;
        out[oo + 3] = w;

        return Quaternion.normalize(out, oo);
    }

    /**
     * The rotation of a Mat4 without scale (the inverse of Mat4.fromTranslationRotationScale with a unit scale).
     *
     * @param {Float32Array} m
     */
    static fromMat4(out, oo, m) {
        // m[4i + j] is the column-vector rotation's element (j, i).
        const r00   = m[0];
        const r11   = m[5];
        const r22   = m[10];
        const trace = (r00 + r11 + r22);
        if (trace > 0) {
            const s = (2 * Math.sqrt(trace + 1));
            out[oo]     = ((m[6] - m[9]) / s);
            out[oo + 1] = ((m[8] - m[2]) / s);
            out[oo + 2] = ((m[1] - m[4]) / s);
            out[oo + 3] = (s / 4);
        } else if ((r00 > r11) && (r00 > r22)) {
            const s = (2 * Math.sqrt(1 + r00 - r11 - r22));
            out[oo]     = (s / 4);
            out[oo + 1] = ((m[4] + m[1]) / s);
            out[oo + 2] = ((m[8] + m[2]) / s);
            out[oo + 3] = ((m[6] - m[9]) / s);
        } else if (r11 > r22) {
            const s = (2 * Math.sqrt(1 + r11 - r00 - r22));
            out[oo]     = ((m[4] + m[1]) / s);
            out[oo + 1] = (s / 4);
            out[oo + 2] = ((m[9] + m[6]) / s);
            out[oo + 3] = ((m[8] - m[2]) / s);
        } else {
            const s = (2 * Math.sqrt(1 + r22 - r00 - r11));
            out[oo]     = ((m[8] + m[2]) / s);
            out[oo + 1] = ((m[9] + m[6]) / s);
            out[oo + 2] = (s / 4);
            out[oo + 3] = ((m[1] - m[4]) / s);
        }

        return Quaternion.normalize(out, oo);
    }

    /**
     * The rotation of Instance.setRotation([x, y, z]): a vertex turns about y, then z, then x
     * (Matrix.composeInstanceTransform).
     *
     * @param {number[]} degrees - [x, y, z]
     */
    static fromDegrees(out, oo, degrees) {
        const half = (Math.PI / (2 * Quaternion.HALF_TURN_DEGREES));
        const x    = (degrees[0] * half);
        const y    = (degrees[1] * half);
        const z    = (degrees[2] * half);
        const qx   = [Math.sin(x), 0, 0, Math.cos(x)];
        const qy   = [0, Math.sin(y), 0, Math.cos(y)];
        const qz   = [0, 0, Math.sin(z), Math.cos(z)];
        Quaternion.multiply(out, oo, qx, 0, qz, 0);

        return Quaternion.multiply(out, oo, out, oo, qy, 0);
    }
}

// Above it, slerp blends linearly (sin(angle) below 1e-3).
Quaternion.LINEAR_COS        = 0.9999995;
Quaternion.HALF_TURN_DEGREES = 180;

/**
 * 4x4 matrices as Float32Array(16), with no allocation once created: the
 * layout of Matrix.v flattened row by row (m[4 * i + j] = v[i][j]), a row
 * vector times the matrix, translation in the last row. It is also the memory
 * layout of a glTF matrix (column-major, column vectors).
 */
class Mat4 {
    /**
     * @returns {Float32Array} an identity matrix
     */
    static create() {
        return Mat4.identity(new Float32Array(Mat4.SIZE));
    }

    static identity(out) {
        out.fill(0);
        out[0]  = 1;
        out[5]  = 1;
        out[10] = 1;
        out[15] = 1;

        return out;
    }

    static copy(out, a) {
        out.set(a);

        return out;
    }

    /**
     * The same transform seen in a scene mirrored in x: x negated before and after (row and column 0 negated).
     * out may be a.
     */
    static mirrorX(out, a) {
        if (out !== a) {
            out.set(a);
        }
        for (let k = 1; k < Mat4.ORDER; k++) {
            out[k]              = -out[k];
            out[Mat4.ORDER * k] = -out[Mat4.ORDER * k];
        }

        return out;
    }

    /**
     * The point (x, y, z) times the matrix, written at out[offset..offset + 2].
     */
    static transformPoint(out, offset, m, x, y, z) {
        out[offset]     = (x * m[0]) + (y * m[4]) + (z * m[8])  + m[12];
        out[offset + 1] = (x * m[1]) + (y * m[5]) + (z * m[9])  + m[13];
        out[offset + 2] = (x * m[2]) + (y * m[6]) + (z * m[10]) + m[14];

        return out;
    }

    /**
     * Writes a into an existing Matrix, keeping its arrays.
     *
     * @param {Matrix}       matrix
     * @param {Float32Array} a
     */
    static toMatrix(matrix, a) {
        for (let i = 0; i < Mat4.ORDER; i++) {
            const row = matrix.v[i];
            for (let j = 0; j < Mat4.ORDER; j++) {
                row[j] = a[(Mat4.ORDER * i) + j];
            }
        }

        return matrix;
    }

    /**
     * Reads a Matrix into a Mat4.
     *
     * @param {Float32Array} out
     * @param {Matrix}       matrix
     */
    static fromMatrix(out, matrix) {
        for (let i = 0; i < Mat4.ORDER; i++) {
            const row = matrix.v[i];
            for (let j = 0; j < Mat4.ORDER; j++) {
                out[(Mat4.ORDER * i) + j] = row[j];
            }
        }

        return out;
    }

    /**
     * a then b: a row vector times out is the vector times a, then times b. out may be a or b.
     */
    static multiply(out, a, b) {
        for (let i = 0; i < Mat4.ORDER; i++) {
            const a0 = a[(Mat4.ORDER * i)];
            const a1 = a[(Mat4.ORDER * i) + 1];
            const a2 = a[(Mat4.ORDER * i) + 2];
            const a3 = a[(Mat4.ORDER * i) + 3];
            out[(Mat4.ORDER * i)]     = (a0 * b[0]) + (a1 * b[4]) + (a2 * b[8])  + (a3 * b[12]);
            out[(Mat4.ORDER * i) + 1] = (a0 * b[1]) + (a1 * b[5]) + (a2 * b[9])  + (a3 * b[13]);
            out[(Mat4.ORDER * i) + 2] = (a0 * b[2]) + (a1 * b[6]) + (a2 * b[10]) + (a3 * b[14]);
            out[(Mat4.ORDER * i) + 3] = (a0 * b[3]) + (a1 * b[7]) + (a2 * b[11]) + (a3 * b[15]);
        }

        return out;
    }

    /**
     * Scale, then rotation, then translation (glTF's T * R * S for column vectors).
     *
     * @param {Float32Array} out
     * @param {Float32Array} t  - translations, x y z at to
     * @param {int}          to
     * @param {Float32Array} q  - unit quaternions, x y z w at qo
     * @param {int}          qo
     * @param {Float32Array} s  - scales, x y z at so
     * @param {int}          so
     */
    static fromTranslationRotationScale(out, t, to, q, qo, s, so) {
        const x  = q[qo];
        const y  = q[qo + 1];
        const z  = q[qo + 2];
        const w  = q[qo + 3];
        const sx = s[so];
        const sy = s[so + 1];
        const sz = s[so + 2];
        out[0]  = (1 - (2 * ((y * y) + (z * z)))) * sx;
        out[1]  = (2 * ((x * y) + (z * w))) * sx;
        out[2]  = (2 * ((x * z) - (y * w))) * sx;
        out[3]  = 0;
        out[4]  = (2 * ((x * y) - (z * w))) * sy;
        out[5]  = (1 - (2 * ((x * x) + (z * z)))) * sy;
        out[6]  = (2 * ((y * z) + (x * w))) * sy;
        out[7]  = 0;
        out[8]  = (2 * ((x * z) + (y * w))) * sz;
        out[9]  = (2 * ((y * z) - (x * w))) * sz;
        out[10] = (1 - (2 * ((x * x) + (y * y)))) * sz;
        out[11] = 0;
        out[12] = t[to];
        out[13] = t[to + 1];
        out[14] = t[to + 2];
        out[15] = 1;

        return out;
    }
}

Mat4.ORDER = 4;
Mat4.SIZE  = (Mat4.ORDER * Mat4.ORDER);

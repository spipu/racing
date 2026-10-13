/**
 * Turns an exported model ({v, f}, ROM axes) into the data of an engine
 * Object3d ({points, faces}, y up, metres): quads split in two triangles,
 * palette colours, both windings for the double-sided faces.
 */
class RacingModelConverter {
    /**
     * @param {RacingPalette} palette
     */
    constructor(palette) {
        this._palette = palette;
    }

    /**
     * @param {{v: int[], f: object[]}} model
     * @param {number}  scale  - metres per ROM unit
     * @param {boolean} mirror - mirrored course: x negated
     * @returns {{points: number[][], faces: object[]}}
     */
    toObjectData(model, scale, mirror) {
        const sx     = ((mirror) ? -scale : scale);
        const points = [];
        for (let i = 0; i < model.v.length; i += 3) {
            points.push([(model.v[i] * sx), (model.v[i + 1] * scale), (model.v[i + 2] * scale)]);
        }

        // A mirror (x negated) turns the faces inside out.
        const reverse = (RacingModelConverter.ROM_FRONT_REVERSED !== mirror);
        const faces   = [];
        const add     = (a, b, c, color, flip) => {
            const pts = ((flip) ? [(a + 1), (c + 1), (b + 1)] : [(a + 1), (b + 1), (c + 1)]);
            faces.push({pts: pts, color: color.slice()});
        };
        for (const face of model.f) {
            const color     = this._palette.getRgb(face.c);
            const indices   = ((face.l === undefined) ? face.i : this._lift(model, face, points, face.l, [sx, scale, scale]));
            const triangles = ((indices.length === 4) ? [[indices[0], indices[1], indices[2]], [indices[0], indices[2], indices[3]]] : [indices]);
            for (const [a, b, c] of triangles) {
                add(a, b, c, color, reverse);
                if (face.d === 1) {
                    add(a, b, c, color, !reverse);
                }
            }
        }

        return {points, faces};
    }

    /**
     * A face drawn over coplanar ones (exported lift, model units) gets its own
     * vertices, moved towards its visible side: opposite to its Newell normal.
     *
     * @returns {int[]} indices of the new points
     */
    _lift(model, face, points, distance, axisScale) {
        const corners = face.i.map((index) => [model.v[index * 3], model.v[(index * 3) + 1], model.v[(index * 3) + 2]]);
        const normal  = [0, 0, 0];
        corners.forEach((a, i) => {
            const b = corners[(i + 1) % corners.length];
            normal[0] += ((a[1] - b[1]) * (a[2] + b[2]));
            normal[1] += ((a[2] - b[2]) * (a[0] + b[0]));
            normal[2] += ((a[0] - b[0]) * (a[1] + b[1]));
        });
        const length = (Math.hypot(...normal) || 1);

        return corners.map((corner) => {
            points.push(corner.map((value, axis) => ((value - ((normal[axis] / length) * distance)) * axisScale[axis])));
            return (points.length - 1);
        });
    }
}

// Winding of a front face in the ROM, once y is turned up, compared with the engine's (clockwise on screen).
RacingModelConverter.ROM_FRONT_REVERSED = true;

/**
 * Draw order of the coplanar faces of a model. The original paints the faces
 * of a model in their ROM order, so a face lying on an earlier one of the same
 * plane (road markings, kerbs, signs) is drawn over it; a depth-buffered
 * renderer needs it lifted instead. Layer of a face = 1 + the highest layer of
 * the earlier coplanar faces it overlaps (0 when it overlaps none).
 */
class VrDecalLayers {
    /**
     * @param {{vertices: int[][], faces: {indices: int[]}[]}} model
     * @returns {int[]} one layer per face
     */
    compute(model) {
        const planes = model.faces.map((face) => this._plane(face.indices.map((index) => model.vertices[index])));
        const layers = [];
        planes.forEach((plane, j) => {
            let layer = 0;
            if (plane !== null) {
                for (let k = 0; k < j; k++) {
                    if ((planes[k] !== null) && this._sharesPlane(planes[k], plane) && this._overlaps(plane, planes[k])) {
                        layer = Math.max(layer, (layers[k] + 1));
                    }
                }
            }
            layers.push(layer);
        });

        return layers;
    }

    // Newell normal: the visible side of a face is opposite to it.
    _plane(points) {
        const normal = [0, 0, 0];
        points.forEach((a, i) => {
            const b = points[(i + 1) % points.length];
            normal[0] += ((a[1] - b[1]) * (a[2] + b[2]));
            normal[1] += ((a[2] - b[2]) * (a[0] + b[0]));
            normal[2] += ((a[0] - b[0]) * (a[1] + b[1]));
        });
        const length = Math.hypot(...normal);
        if (length === 0) {
            return null;
        }
        const unit = normal.map((value) => (value / length));
        const axis = [0, 1, 2].reduce((best, i) => ((Math.abs(unit[i]) > Math.abs(unit[best])) ? i : best), 0);

        return {normal: unit, distance: this._dot(unit, points[0]), axis, points};
    }

    _sharesPlane(base, face) {
        if (Math.abs(Math.abs(this._dot(base.normal, face.normal)) - 1) > VrDecalLayers.PARALLEL) {
            return false;
        }

        return face.points.every((point) => (Math.abs(this._dot(base.normal, point) - base.distance) < VrDecalLayers.ON_PLANE));
    }

    // Separating axis test of the two convex polygons, projected along the dominant axis of the upper face.
    _overlaps(face, base) {
        const keep = [0, 1, 2].filter((i) => (i !== face.axis));
        const a    = face.points.map((p) => [p[keep[0]], p[keep[1]]]);
        const b    = base.points.map((p) => [p[keep[0]], p[keep[1]]]);
        for (const polygon of [a, b]) {
            for (let i = 0; i < polygon.length; i++) {
                const p    = polygon[i];
                const q    = polygon[(i + 1) % polygon.length];
                const axis = [(q[1] - p[1]), (p[0] - q[0])];
                const length = Math.hypot(...axis);
                if (length === 0) {
                    continue;
                }
                const pa = a.map((v) => (((v[0] * axis[0]) + (v[1] * axis[1])) / length));
                const pb = b.map((v) => (((v[0] * axis[0]) + (v[1] * axis[1])) / length));
                if ((Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb))) <= VrDecalLayers.TOUCH) {
                    return false;
                }
            }
        }

        return true;
    }

    _dot(a, b) {
        return ((a[0] * b[0]) + (a[1] * b[1]) + (a[2] * b[2]));
    }
}

VrDecalLayers.PARALLEL = 1e-3;
// Model units: vertex distance to the plane, and overlap below which two faces only touch.
VrDecalLayers.ON_PLANE = 1;
VrDecalLayers.TOUCH    = 0.5;

module.exports = {VrDecalLayers};

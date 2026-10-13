/**
 * Draw order of coplanar faces. The original paints the faces of a model in
 * their ROM order, so a face lying on an earlier one of the same plane (road
 * markings, kerbs, signs) is drawn over it; a depth-buffered renderer needs it
 * lifted instead. A smaller face lying entirely within a later one goes over
 * it all the same: painted over, it would never show (arrow tips on the signs
 * of Bay Bridge). Between two models of a course the original order is not
 * decoded: the smaller face goes over the larger one (a marking over the road
 * of a neighbouring model; user decision 2026-10-13).
 *
 * A face is lifted towards its visible side by the lift of the faces it covers
 * plus what it takes to stand one step in front of them: faces whose vertices,
 * rounded to whole units, leave them a little off the same plane get the lift
 * that puts the covering one in front. Lifts are in model units, 0 when a face
 * covers none.
 */
class VrDecalLayers {
    /**
     * @param {number} unitsPerMetre - of the model vertices
     * @param {number} stepMetres    - distance a covering face stands in front of the covered one
     */
    constructor(unitsPerMetre, stepMetres) {
        this._step = (stepMetres * unitsPerMetre);
    }

    /**
     * @param {{vertices: int[][], faces: {indices: int[]}[]}} model
     * @returns {number[]} one lift per face
     */
    compute(model) {
        return this.computeScene([model])[0];
    }

    /**
     * The models of a course, ordered within each model and across models.
     *
     * @param {{vertices: int[][], faces: {indices: int[]}[]}[]} models
     * @returns {number[][]} one lift per face, by model
     */
    computeScene(models) {
        const faces = [];
        models.forEach((model, m) => {
            model.faces.forEach((face, f) => {
                const plane = this._plane(face.indices.map((index) => model.vertices[index]));
                if (plane !== null) {
                    faces.push({model: m, face: f, plane: plane, color: face.colorIndex, area: this._area(plane), box: this._box(plane.points), covers: []});
                }
            });
        });
        for (let a = 0; a < faces.length; a++) {
            for (let b = (a + 1); b < faces.length; b++) {
                this._order(faces[a], faces[b]);
            }
        }

        const lifts = models.map((model) => model.faces.map(() => 0));
        const state = new Map();
        const visit = (node) => {
            if (state.get(node) === VrDecalLayers.DONE) {
                return lifts[node.model][node.face];
            }
            if (state.get(node) === VrDecalLayers.VISITING) {
                throw new Error('coplanar faces cover each other: model ' + node.model + ' face ' + node.face);
            }
            state.set(node, VrDecalLayers.VISITING);
            let lift = 0;
            for (const lower of node.covers) {
                lift = Math.max(lift, (this._sameSide(node, lower) ? visit(lower) : 0) + this._step - this._ahead(node, lower));
            }
            lifts[node.model][node.face] = lift;
            state.set(node, VrDecalLayers.DONE);

            return lift;
        };
        faces.forEach(visit);

        return lifts;
    }

    // Records which of two coplanar overlapping faces covers the other: ROM order in a model, size across models.
    _order(first, second) {
        if (!this._boxesMeet(first.box, second.box)) {
            return;
        }
        const overlap = (this._sharesPlane(first.plane, second.plane) && this._overlaps(second.plane, first.plane));
        if (first.model === second.model) {
            if (!overlap) {
                return;
            }
            // A face lying entirely within a later one would never show if the later one were painted over it: the
            // original shows it (arrow tips on the signs of Bay Bridge), so it goes over.
            if ((first.color !== second.color) && (first.area < (second.area * VrDecalLayers.SMALLER)) && this._inside(first.plane, second.plane)) {
                first.covers.push(second);
                return;
            }
            second.covers.push(first);
            return;
        }
        // Same colour: whichever wins, the picture is the same. Across models the test must not depend on which face
        // comes first.
        if ((first.color === second.color) || (!overlap && !(this._sharesPlane(second.plane, first.plane) && this._overlaps(first.plane, second.plane)))) {
            return;
        }
        if (first.area < second.area) {
            first.covers.push(second);
            return;
        }
        second.covers.push(first);
    }

    // How far the upper face already stands in front of the lower one's plane, towards its visible side (its nearest
    // corner).
    _ahead(upper, lower) {
        const side = (this._sameSide(upper, lower) ? -1 : 1);

        return Math.min(...upper.plane.points.map((point) => (side * (this._dot(lower.plane.normal, point) - lower.plane.distance))));
    }

    // Lifted the same way: the lift of the lower face counts towards the upper one.
    _sameSide(upper, lower) {
        return (this._dot(upper.plane.normal, lower.plane.normal) > 0);
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

        return {normal: unit, distance: this._dot(unit, points[0]), axis, points, length};
    }

    // Twice the Newell length is the area of the polygon.
    _area(plane) {
        return (plane.length / 2);
    }

    _box(points) {
        return [0, 1, 2].map((axis) => [Math.min(...points.map((p) => p[axis])), Math.max(...points.map((p) => p[axis]))]);
    }

    _boxesMeet(a, b) {
        return a.every((range, axis) => ((range[0] <= (b[axis][1] + VrDecalLayers.ON_PLANE)) && (b[axis][0] <= (range[1] + VrDecalLayers.ON_PLANE))));
    }

    _sharesPlane(base, face) {
        if (Math.abs(Math.abs(this._dot(base.normal, face.normal)) - 1) > VrDecalLayers.PARALLEL) {
            return false;
        }

        return face.points.every((point) => (Math.abs(this._dot(base.normal, point) - base.distance) < VrDecalLayers.ON_PLANE));
    }

    // Every corner of the inner face within the outer convex face (projected along the outer face's dominant axis).
    _inside(inner, outer) {
        const keep = [0, 1, 2].filter((i) => (i !== outer.axis));
        const ring = outer.points.map((p) => [p[keep[0]], p[keep[1]]]);
        let sign   = 0;
        for (const point of inner.points) {
            const q = [point[keep[0]], point[keep[1]]];
            for (let i = 0; i < ring.length; i++) {
                const a     = ring[i];
                const b     = ring[(i + 1) % ring.length];
                const cross = (((b[0] - a[0]) * (q[1] - a[1])) - ((b[1] - a[1]) * (q[0] - a[0])));
                if (Math.abs(cross) <= VrDecalLayers.TOUCH) {
                    continue;
                }
                if ((sign !== 0) && (Math.sign(cross) !== sign)) {
                    return false;
                }
                sign = Math.sign(cross);
            }
        }

        return true;
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

VrDecalLayers.PARALLEL = 0.01;
// Model units: vertex distance to the plane (whole-unit roundings leave coplanar faces up to 2 units apart), and
// overlap below which two faces only touch.
VrDecalLayers.ON_PLANE = 2.5;
VrDecalLayers.TOUCH    = 0.5;
// A face within a later one goes over it when clearly smaller (the same face twice keeps the ROM order).
VrDecalLayers.SMALLER  = 0.95;
VrDecalLayers.VISITING = 1;
VrDecalLayers.DONE     = 2;

module.exports = {VrDecalLayers};

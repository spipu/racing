/**
 * The wheels the mechanics handle (race.json pitModels, car model units),
 * prepared for a smooth animation (project decision):
 *   - the wheels laid on the ground lack the side they lie on: it is closed,
 *     as they turn up when picked or laid;
 *   - a body that picks a wheel up starts its frame with the wheel where it
 *     lay (on the ground, or on the car's hub), and a body that puts one down
 *     ends its frame with the wheel where it lies next, turned as it lies.
 * The wheels are 16 vertices each, so that one turns and moves onto another.
 */
class RacingPitCrewWheels {
    /**
     * @param {object} race - race.json (pit, pitModels)
     * @param {object} cars - cars.json
     * @param {object} car  - entry of cars.json cars
     */
    constructor(race, cars, car) {
        this._hubs   = RacingPitCrewWheels._hubs(cars, car);
        this._models = {};
        for (const [code, model] of Object.entries(race.pitModels)) {
            this._models[code] = RacingPitCrewWheels._closed(model);
        }
    }

    /**
     * @param {string} code - model of race.json pitModels
     * @returns {object} the model, a wheel laid on the ground closed
     */
    model(code) {
        return this._models[code];
    }

    /**
     * The body of each frame where a wheel goes from a place to the hands or back: the shape it starts the frame with
     * (start) and the shape it ends it with (end), null for the body's own and the next frame's.
     *
     * @param {(string|null)[][]} frames - models of each frame (body, tool, removed wheel, new wheel)
     * @param {number[]} origin - place of the mechanic around the box, car model units
     * @returns {{start: object|null, end: object|null}[]}
     */
    bodyShapes(frames, origin) {
        const shapes = frames.map(() => ({start: null, end: null}));
        for (let k = 0; (k + 1) < frames.length; k++) {
            const body = this._models[frames[k][RacingPitCrewWheels.BODY]];
            const next = this._models[frames[k + 1][RacingPitCrewWheels.BODY]];
            const down = RacingPitCrewWheels._wheelStart(body, next);
            if (down !== null) {
                const lying = this._groundWheel(frames[k + 1], frames[k], origin);
                shapes[k].end = this._moved(body, down, lying, origin, next);
            }
            const up = RacingPitCrewWheels._wheelStart(next, body);
            if (up !== null) {
                const lay = this._groundWheel(frames[k], frames[k + 1], origin);
                shapes[k + 1].start = this._moved(next, up, lay, origin, null);
            }
        }

        return shapes;
    }

    // The pose of a wheel lying in frame `there` and not in frame `not` (laid down or picked up), null: none.
    _groundWheel(there, not, origin) {
        for (let column = (RacingPitCrewWheels.BODY + 1); column < there.length; column++) {
            const code = there[column];
            if ((code !== null) && (code !== not[column]) && ((this._models[code].v.length / 3) === RacingPitCrewWheels.WHEEL_VERTICES)) {
                const points = RacingPitCrewWheels._points(this._models[code].v, 0, RacingPitCrewWheels.WHEEL_VERTICES, origin);

                return RacingPitCrewWheels._pose(points);
            }
        }

        return null;
    }

    // The body with its wheel turned and moved onto the pose (null: the nearest hub of the car), its other vertices
    // those of the given pose (null: its own).
    _moved(body, from, pose, origin, others) {
        const wheel = RacingPitCrewWheels._points(body.v, from, RacingPitCrewWheels.WHEEL_VERTICES, origin);
        const own   = RacingPitCrewWheels._pose(wheel);
        const goal  = (pose ?? {centre: this.nearestHub(own.centre), axis: RacingPitCrewWheels.HUB_AXIS});
        const turn  = RacingPitCrewWheels._alignment(own.axis, goal.axis);
        const v     = [];
        for (let i = 0; i < (body.v.length / 3); i++) {
            const inWheel = ((i >= from) && (i < (from + RacingPitCrewWheels.WHEEL_VERTICES)));
            if (inWheel) {
                const p = RacingPitCrewWheels._apply(turn, RacingPitCrewWheels._minus(wheel[i - from], own.centre));
                v.push((p[0] + goal.centre[0] - origin[0]), (p[1] + goal.centre[1] - origin[1]), (p[2] + goal.centre[2] - origin[2]));
            } else if (others === null) {
                v.push(body.v[i * 3], body.v[(i * 3) + 1], body.v[(i * 3) + 2]);
            } else {
                const index = ((i < from) ? i : (i - RacingPitCrewWheels.WHEEL_VERTICES));
                v.push(others.v[index * 3], others.v[(index * 3) + 1], others.v[(index * 3) + 2]);
            }
        }

        return {...body, v};
    }

    /**
     * @param {number[]} point - car model units around the box
     * @returns {number[]} the centre of the car's wheel nearest to it
     */
    nearestHub(point) {
        const away = (hub) => RacingPitCrewWheels._distance(hub, point);

        return this._hubs.reduce((best, hub) => ((away(hub) < away(best)) ? hub : best));
    }

    // A wheel of 16 vertices open on one side (edges of a single face) gets that side: a fan of triangles over the
    // loop of open edges, in the colour of the faces off that loop, facing out as the other faces do.
    static _closed(model) {
        if ((model.v.length / 3) !== RacingPitCrewWheels.WHEEL_VERTICES) {
            return model;
        }
        const edges = new Map();
        for (const face of model.f) {
            face.i.forEach((a, k) => {
                const b   = face.i[(k + 1) % face.i.length];
                const key = Math.min(a, b) + '-' + Math.max(a, b);
                edges.set(key, ((edges.has(key)) ? null : [a, b]));
            });
        }
        const open = [...edges.values()].filter((edge) => (edge !== null));
        const loop = RacingPitCrewWheels._loop(open);
        if (loop === null) {
            return model;
        }
        const points  = RacingPitCrewWheels._points(model.v, 0, RacingPitCrewWheels.WHEEL_VERTICES, [0, 0, 0]);
        const centre  = RacingPitCrewWheels._centre(points);
        const outside = (face) => {
            const corners = face.map((i) => points[i]);
            const normal  = RacingPitCrewWheels._cross(RacingPitCrewWheels._minus(corners[1], corners[0]), RacingPitCrewWheels._minus(corners[2], corners[0]));

            return Math.sign(RacingPitCrewWheels._dot(normal, RacingPitCrewWheels._minus(RacingPitCrewWheels._centre(corners), centre)));
        };
        const onLoop = new Set(loop);
        const far    = model.f.find((face) => !face.i.some((i) => onLoop.has(i)));
        const side   = outside(model.f[0].i);
        const faces  = [];
        for (let k = 1; (k + 1) < loop.length; k++) {
            const triangle = [loop[0], loop[k], loop[k + 1]];
            faces.push({...far, i: ((outside(triangle) === side) ? triangle : triangle.reverse())});
        }

        return {...model, f: [...model.f, ...faces]};
    }

    // The open edges in a single closed loop, null when they make none.
    static _loop(edges) {
        if (edges.length < 3) {
            return null;
        }
        const loop = [edges[0][0], edges[0][1]];
        const left = edges.slice(1);
        while (left.length > 0) {
            const last = loop[loop.length - 1];
            const k    = left.findIndex((edge) => edge.includes(last));
            if (k < 0) {
                return null;
            }
            const [a, b] = left.splice(k, 1)[0];
            loop.push(((a === last) ? b : a));
        }

        return ((loop[loop.length - 1] === loop[0]) ? loop.slice(0, -1) : null);
    }

    // Centre of each wheel of the car: a front wheel model each, the rear one on both sides.
    static _hubs(cars, car) {
        const hubs = [];
        for (const wheel of car.wheels) {
            const v      = cars.models[wheel.model].v;
            const points = RacingPitCrewWheels._points(v, 0, (v.length / 3), wheel.offset);
            const reach  = Math.max(...points.map((p) => Math.abs(p[0] - wheel.offset[0])));
            // A model spanning the car is the rear axle: its wheels are its two ends.
            const ends   = ((reach > RacingPitCrewWheels.AXLE_HALF_WIDTH) ? [-1, 1] : [0]);
            for (const end of ends) {
                const own = points.filter((p) => ((end === 0) || (((p[0] - wheel.offset[0]) * end) > (reach / 2))));
                hubs.push(RacingPitCrewWheels._centre(own));
            }
        }

        return hubs;
    }

    // First vertex of the wheel a body holds and the other body lacks: the other is the holding one without these
    // vertices and their faces, the rest in the same order. Null when the bodies differ otherwise.
    static _wheelStart(holding, other) {
        const n = RacingPitCrewWheels.WHEEL_VERTICES;
        if ((holding.v.length - other.v.length) !== (n * 3)) {
            return null;
        }
        for (let from = 0; from <= (other.v.length / 3); from++) {
            const inWheel = (i) => ((i >= from) && (i < (from + n)));
            const kept    = holding.f.filter((face) => !face.i.every(inWheel));
            const same    = ((kept.length === other.f.length) && kept.every((face, k) => {
                const own = other.f[k];

                return (!face.i.some(inWheel) && (face.c === own.c) && (face.d === own.d) && (face.l === own.l)
                    && (face.i.map((i) => ((i < from) ? i : (i - n))).join() === own.i.join()));
            }));
            if (same) {
                return from;
            }
        }

        return null;
    }

    // Centre and flat axis of a wheel.
    static _pose(points) {
        const centre = RacingPitCrewWheels._centre(points);

        return {centre, axis: RacingPitCrewWheels._flatAxis(points.map((p) => RacingPitCrewWheels._minus(p, centre)))};
    }

    // The axis along which the points around their centre spread the least (a wheel's axle): power iteration on the
    // spread taken from its trace, whose largest eigenvalue is then that axis's.
    static _flatAxis(points) {
        const spread = [0, 1, 2].map((a) => [0, 1, 2].map((b) => points.reduce((sum, p) => (sum + (p[a] * p[b])), 0)));
        const trace  = (spread[0][0] + spread[1][1] + spread[2][2]);
        const matrix = spread.map((row, a) => row.map((value, b) => (((a === b) ? trace : 0) - value)));
        let axis = RacingPitCrewWheels._unit([1, 0.7, 0.4]);
        for (let step = 0; step < RacingPitCrewWheels.AXIS_STEPS; step++) {
            axis = RacingPitCrewWheels._unit(matrix.map((row) => RacingPitCrewWheels._dot(row, axis)));
        }

        return axis;
    }

    // Rotation (rows) turning one axis onto the other, or onto its opposite when nearer: a wheel has two sides alike.
    static _alignment(from, to) {
        const goal = ((RacingPitCrewWheels._dot(from, to) < 0) ? RacingPitCrewWheels._scaled(to, -1) : to);
        const axis = RacingPitCrewWheels._cross(from, goal);
        const sin  = Math.hypot(...axis);
        const cos  = RacingPitCrewWheels._dot(from, goal);
        if (sin < RacingPitCrewWheels.EPSILON) {
            return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
        }
        const [x, y, z] = RacingPitCrewWheels._scaled(axis, (1 / sin));
        const t = (1 - cos);

        return [
            [((t * x * x) + cos), ((t * x * y) - (sin * z)), ((t * x * z) + (sin * y))],
            [((t * x * y) + (sin * z)), ((t * y * y) + cos), ((t * y * z) - (sin * x))],
            [((t * x * z) - (sin * y)), ((t * y * z) + (sin * x)), ((t * z * z) + cos)]
        ];
    }

    static _points(v, from, count, origin) {
        const points = [];
        for (let i = from; i < (from + count); i++) {
            points.push([(v[i * 3] + origin[0]), (v[(i * 3) + 1] + origin[1]), (v[(i * 3) + 2] + origin[2])]);
        }

        return points;
    }

    // Centre of the bounding box: an average would lean towards the side with the most vertices.
    static _centre(points) {
        return [0, 1, 2].map((k) => ((Math.min(...points.map((p) => p[k])) + Math.max(...points.map((p) => p[k]))) / 2));
    }

    static _apply(rows, p) {
        return rows.map((row) => RacingPitCrewWheels._dot(row, p));
    }

    static _dot(a, b) {
        return ((a[0] * b[0]) + (a[1] * b[1]) + (a[2] * b[2]));
    }

    static _cross(a, b) {
        return [((a[1] * b[2]) - (a[2] * b[1])), ((a[2] * b[0]) - (a[0] * b[2])), ((a[0] * b[1]) - (a[1] * b[0]))];
    }

    static _minus(a, b) {
        return [(a[0] - b[0]), (a[1] - b[1]), (a[2] - b[2])];
    }

    static _scaled(a, factor) {
        return [(a[0] * factor), (a[1] * factor), (a[2] * factor)];
    }

    static _unit(a) {
        return RacingPitCrewWheels._scaled(a, (1 / Math.hypot(...a)));
    }

    static _distance(a, b) {
        return Math.hypot((a[0] - b[0]), (a[1] - b[1]), (a[2] - b[2]));
    }
}

// Column of the body in a frame of race.json pit.mechanics.
RacingPitCrewWheels.BODY = 0;
// Vertices of the wheel the rear mechanics handle.
RacingPitCrewWheels.WHEEL_VERTICES = 16;
// Half width past which a wheel model is the rear axle (Formula 1070, a front wheel 310).
RacingPitCrewWheels.AXLE_HALF_WIDTH = 600;
// The car's wheels turn about the x axis (heading 0 in the box).
RacingPitCrewWheels.HUB_AXIS = [1, 0, 0];
RacingPitCrewWheels.AXIS_STEPS = 60;
RacingPitCrewWheels.EPSILON    = 1e-9;

/**
 * The wheels of a car, all made from one (project decision, a visual
 * departure from the original): the profile of the car's rear wheel in the
 * ROM (inner flank, tread, outer chamfer, hub cap, their colours), turned on
 * 16 sides instead of 8, then sized to each place: its own radius and width
 * there; the tread's faces one in two a grey lighter, for the wheel to be
 * seen turning. Models are in the ROM's format ({v, f}, car model units).
 */
class RacingWheelModels {
    /**
     * @param {object} cars - cars.json
     * @param {object} car  - entry of cars.json cars
     */
    constructor(cars, car) {
        this._cars    = cars;
        this._profile = RacingWheelModels._profile(cars.models[car.wheels[RacingWheelModels.REAR].model]);
        this._models  = new Map();
    }

    /**
     * The wheels a model of the car holds: one, or the two ends of an axle.
     *
     * @param {string}   code   - model of cars.json models
     * @param {number[]} offset - where the car places the model
     * @returns {{centre: number[], radius: number, width: number, side: number}[]} car units; side -1 left, 1 right
     */
    wheelsOf(code, offset) {
        const v      = this._cars.models[code].v;
        const points = [];
        for (let i = 0; i < v.length; i += 3) {
            points.push([v[i], v[i + 1], v[i + 2]]);
        }
        const reach = Math.max(...points.map((p) => Math.abs(p[0])));
        const ends  = ((reach > RacingWheelModels.AXLE_HALF_WIDTH) ? [-1, 1] : [0]);

        return ends.map((end) => {
            const own    = points.filter((p) => ((end === 0) || ((p[0] * end) > (reach / 2))));
            const wheel  = RacingWheelModels._measure(own);
            wheel.centre = wheel.centre.map((value, k) => (value + offset[k]));
            wheel.side   = Math.sign(wheel.centre[0]);

            return wheel;
        });
    }

    /**
     * A wheel model of the car replaced in place: each of its wheels made at its size, the outer face outside.
     *
     * @param {string}   code
     * @param {number[]} offset - where the car places the model
     * @returns {{v: number[], f: object[]}}
     */
    replace(code, offset) {
        const key = (code + '@' + offset.join(','));
        if (!this._models.has(key)) {
            const model = {v: [], f: []};
            for (const wheel of this.wheelsOf(code, offset)) {
                const at = wheel.centre.map((value, k) => (value - offset[k]));
                this._add(model, wheel.radius, wheel.width, at, wheel.side);
            }
            this._models.set(key, model);
        }

        return this._models.get(key);
    }

    /**
     * A wheel at a size, centred on its hub, the outer face towards +x: the one a mechanic handles.
     *
     * @param {number} radius - car units
     * @param {number} width  - car units
     * @returns {{v: number[], f: object[]}}
     */
    centred(radius, width) {
        const model = {v: [], f: []};
        this._add(model, radius, width, [0, 0, 0], 1);

        return model;
    }

    // One wheel added to a model: the profile's rings turned around x at `at`; a left wheel (side -1) is the right one
    // turned half round the vertical.
    _add(model, radius, width, at, side) {
        const first  = (model.v.length / 3);
        const sides  = RacingWheelModels.SIDES;
        for (const ring of this._profile.rings) {
            const x = ((ring.across - 0.5) * width);
            for (let j = 0; j < sides; j++) {
                const angle = (((j + 0.5) * 2 * Math.PI) / sides);
                const y     = (ring.out * radius * Math.sin(angle));
                const z     = (ring.out * radius * Math.cos(angle));
                model.v.push((at[0] + (x * side)), (at[1] + y), (at[2] + (z * side)));
            }
        }
        const corner = (ring, j) => (first + (ring * sides) + (j % sides));
        for (const part of this._profile.parts) {
            // The tread: the band between two rings at the full radius (not a flank on one).
            const tread = ((part.rings.length === 2) && part.rings.every((ring) => (this._profile.rings[ring].out === 1)));
            const faces = ((part.rings.length === 2)
                ? [...Array(sides).keys()].map((j) => [corner(part.rings[0], j), corner(part.rings[0], (j + 1)), corner(part.rings[1], (j + 1)), corner(part.rings[1], j)])
                : RacingWheelModels._cap(sides).map((face) => face.map((j) => corner(part.rings[0], j))));
            faces.forEach((indices, j) => {
                const color = ((tread && ((j % 2) === 1)) ? (part.color + RacingWheelModels.TREAD_STRIPE) : part.color);
                model.f.push({c: color, i: RacingWheelModels._turned(model.v, indices, at)});
            });
        }
    }

    // A face's corners in the ROM's turn: its Newell normal away from its visible side, here towards the wheel's
    // centre `at`.
    static _turned(v, indices, at) {
        const corners = indices.map((index) => [v[index * 3], v[(index * 3) + 1], v[(index * 3) + 2]]);
        const normal  = [0, 0, 0];
        const middle  = [0, 0, 0];
        corners.forEach((a, i) => {
            const b = corners[(i + 1) % corners.length];
            normal[0] += ((a[1] - b[1]) * (a[2] + b[2]));
            normal[1] += ((a[2] - b[2]) * (a[0] + b[0]));
            normal[2] += ((a[0] - b[0]) * (a[1] + b[1]));
            [0, 1, 2].forEach((k) => { middle[k] += (a[k] / corners.length); });
        });
        const outward = ((normal[0] * (middle[0] - at[0])) + (normal[1] * (middle[1] - at[1])) + (normal[2] * (middle[2] - at[2])));

        return ((outward > 0) ? indices.slice().reverse() : indices);
    }

    // A ring closed by quads across it: (0, 1, n-2, n-1), (1, 2, n-3, n-2), ...
    static _cap(sides) {
        const faces = [];
        for (let k = 0; k < ((sides / 2) - 1); k++) {
            faces.push([k, (k + 1), (sides - 2 - k), (sides - 1 - k)]);
        }

        return faces;
    }

    /**
     * The profile of a rear axle's right wheel: its rings (across: 0 inner face to 1 outer, out: 0 axis to 1 rim)
     * and its parts (a band between two rings, a cap on one) with their colours. A cap the ROM draws lifted over
     * the face behind it (the Formula's hub cap) has its ring moved out by the lift: drawn there, as the game does.
     */
    static _profile(axle) {
        const points = [];
        for (let i = 0; i < axle.v.length; i += 3) {
            points.push([axle.v[i], axle.v[i + 1], axle.v[i + 2]]);
        }
        const own    = points.map((p, index) => ({p, index})).filter((point) => (point.p[0] > 0));
        const wheel  = RacingWheelModels._measure(own.map((point) => point.p));
        const inner  = (wheel.centre[0] - (wheel.width / 2));
        const rings  = [];
        const ringOf = new Map();
        for (const {p, index} of own) {
            const across = (p[0] - inner);
            const out    = Math.hypot((p[1] - wheel.centre[1]), (p[2] - wheel.centre[2]));
            let ring     = rings.findIndex((r) => ((Math.abs(r.x - across) <= RacingWheelModels.RING_TOLERANCE) && (Math.abs(r.r - out) <= RacingWheelModels.RING_TOLERANCE)));
            if (ring < 0) {
                ring = (rings.push({x: across, r: out}) - 1);
            }
            ringOf.set(index, ring);
        }

        const parts = new Map();
        for (const face of axle.f) {
            if (!face.i.every((index) => ringOf.has(index))) {
                continue;
            }
            const used = [...new Set(face.i.map((index) => ringOf.get(index)))].sort((a, b) => (a - b));
            const key  = used.join('-');
            if (!parts.has(key)) {
                parts.set(key, {rings: used, color: face.c});
                if ((face.l !== undefined) && (used.length === 1)) {
                    rings[used[0]].x += (Math.sign(rings[used[0]].x - (wheel.width / 2)) * face.l);
                }
            }
        }

        return {
            rings: rings.map((r) => ({across: (r.x / wheel.width), out: (r.r / wheel.radius)})),
            parts: [...parts.values()],
        };
    }

    // Centre of the bounding box, radius around x, width along x.
    static _measure(points) {
        const centre = [0, 1, 2].map((k) => ((Math.min(...points.map((p) => p[k])) + Math.max(...points.map((p) => p[k]))) / 2));

        return {
            centre: centre,
            radius: Math.max(...points.map((p) => Math.hypot((p[1] - centre[1]), (p[2] - centre[2])))),
            width:  (Math.max(...points.map((p) => p[0])) - Math.min(...points.map((p) => p[0]))),
        };
    }
}

// Index of the rear axle in a car's wheels.
RacingWheelModels.REAR = 2;
// A wheel model reaching further than this from the car's axis is the rear axle: its wheels are its two ends.
RacingWheelModels.AXLE_HALF_WIDTH = 600;
// Sides of a wheel turned around its axle (8 in the ROM).
RacingWheelModels.SIDES = 16;
// Palette step from the tread's grey to its stripes': the next grey of the courses' ramp (indices 0-15, 8 apart).
RacingWheelModels.TREAD_STRIPE = 1;
// Car units within which two vertices of the profile are on one ring (the ROM rounds them).
RacingWheelModels.RING_TOLERANCE = 3;

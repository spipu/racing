/**
 * The car as the original assembles it, every part one engine instance at the
 * car position, its offset and turn given as animation deltas:
 *   - outside: the body, the two front wheels and the rear axle at their
 *     offsets (cars.json wheels), and the flat shadow darkening the ground;
 *   - cockpit view: the cockpit shell, its front wheels at the same offsets,
 *     and the steering wheel with the driver's arms (the rear axle is not drawn).
 * The wheels spin with the speed ($859A), the front wheels steer by the turn
 * rate (+$90, $2984), the steering wheel follows the steering ($C088). The
 * shadow, a part of the body (its descriptor relative to the body, angles 0),
 * is hidden while the car recovers from a crash ($2A86). The original paints
 * the car over the road it dips into: its parts carry a depth bias. Outside, the
 * effect models of the common bank play at their render slots ($3F86): tyre
 * smoke, grass and sand behind each rear wheel (the left ones mirrored),
 * sparks under the tail, exhaust flames.
 */
class RacingCarView {
    /**
     * @param {RacingModelConverter} converter
     * @param {object}  cars   - cars.json
     * @param {object}  car    - entry of cars.json cars
     * @param {number}  scale  - metres per model unit
     * @param {boolean} mirror
     */
    constructor(converter, cars, car, scale, mirror) {
        this._side      = (mirror ? -1 : 1);
        this._outside   = [];
        this._cockpit   = [];
        this._effects   = [];
        this._shown     = [];
        this._instances = [];
        this._inCockpit = false;
        this._wheelSpin = 0;
        this._steering  = 0;
        this._wheelTurn = 0;
        this._frames    = null;
        this._shadowOn  = true;
        this._body      = new Matrix();
        this._axis      = new Matrix();
        this._rotation  = [0, 0, 0];

        const model  = (code, mirrored) => converter.toObjectData(cars.models[code], scale, mirrored);
        const offset = (units) => [(units[0] * scale * this._side), (units[1] * scale), (units[2] * scale)];
        this._outside.push(this._addPart(model(car.body, mirror), [0, 0, 0], null));
        car.wheels.forEach((wheel, i) => {
            this._outside.push(this._addPart(model(wheel.model, mirror), offset(wheel.offset), ((i < 2) ? 'front' : 'spin')));
        });
        this._shadow = this._addPart(RacingCarView._screened(model(car.shadow, mirror)), [0, RacingCarView.SHADOW_LIFT, 0], null);
        this._outside.push(this._shadow);

        // One part per frame of each effect: kind (physics effectFrames), side (index in it, null: one for both).
        const rear      = RacingCarView.EFFECT_REAR_WHEEL;
        const leftRear  = [-rear[0], rear[1], rear[2]];
        const addEffect = (kind, side, frames, units, mirrored, screened) => {
            frames.forEach((code, frame) => {
                const data = model(code, (mirror !== mirrored));
                this._effects.push({kind, side, frame, part: this._addPart((screened ? RacingCarView._screened(data) : data), offset(units), null)});
            });
        };
        addEffect('smoke', null, cars.effects.tyre_smoke, leftRear, true, true);
        addEffect('smoke', null, cars.effects.tyre_smoke, rear, false, true);
        addEffect('sparks', null, cars.effects.sparks, RacingCarView.EFFECT_SPARKS, false, false);
        addEffect('flames', null, cars.effects.exhaust_flames, RacingCarView.EFFECT_FLAMES, false, false);
        addEffect('grass', 0, cars.effects.grass, leftRear, true, false);
        addEffect('grass', 1, cars.effects.grass, rear, false, false);
        addEffect('sand', 0, cars.effects.dirt, leftRear, true, false);
        addEffect('sand', 1, cars.effects.dirt, rear, false, false);

        const [shell, left, right] = car.cockpit;
        this._cockpit.push(this._addPart(model(shell, mirror), [0, 0, 0], null));
        [left, right].forEach((code, i) => this._cockpit.push(this._addPart(model(code, mirror), offset(car.wheels[i].offset), 'front')));
        this._cockpit.push(this._addPart(model(cars.steeringWheel, mirror), offset(car.steeringWheelOffset), 'steer'));
    }

    /**
     * Instances are created by the loader: the parts are bound once it has loaded them.
     */
    bind() {
        for (const part of [...this._outside, ...this._cockpit, ...this._effects.map((effect) => effect.part)]) {
            part.instance = loader.instances().get(part.instanceId);
            part.instance.setRenderDepthBias(RacingCarView.DEPTH_BIAS);
        }

        return this;
    }

    /**
     * @param {boolean} cockpit - the cockpit view, inside the car
     */
    setCockpit(cockpit) {
        this._inCockpit = cockpit;

        return this;
    }

    /**
     * @param {object}  frames - RacingCarPhysics.effectFrames, read when the car is placed
     * @param {boolean} shadow - the shadow shown
     */
    setEffects(frames, shadow) {
        this._frames   = frames;
        this._shadowOn = shadow;

        return this;
    }

    /**
     * The wheels turn by the speed, the steering wheel goes halfway to the steering each tick.
     *
     * @param {number} ticks        - time elapsed, in original ticks
     * @param {number} displaySpeed - km/h (+$04)
     * @param {number} steer        - +$8E
     * @param {number} turnRate     - +$90, the front wheels' angle in 1/65536 turn
     */
    animate(ticks, displaySpeed, steer, turnRate) {
        this._wheelTurn = turnRate;
        let spin = (Math.max(0, displaySpeed) * RacingCarView.SPIN_PER_KMH);
        if (spin >= RacingCarView.SPIN_FAST) {
            spin *= RacingCarView.SPIN_FAST_FACTOR;
            if (spin >= RacingCarView.SPIN_LIMIT) {
                spin = RacingCarView.SPIN_MAX;
            }
        }
        this._wheelSpin = ((this._wheelSpin - (spin * ticks)) % RacingCarView.TURN);
        this._steering += ((steer - this._steering) * (1 - Math.pow(0.5, ticks)));

        return this;
    }

    /**
     * Places the parts of the current view: they turn with the body's roll, then its pitch, then the yaw; their
     * offsets tilt the same way.
     *
     * @param {number[]} position - metres
     * @param {number}   yaw      - degrees
     * @param {number}   pitch    - degrees, the engine's rotation about x
     * @param {number}   roll     - degrees, the engine's rotation about z
     * @param {{lift: number, yaw: number, pitch: number, roll: number}} pose - the body's own pose (metres, degrees):
     *        a crash lifts and tumbles it
     */
    place(position, yaw, pitch, roll, pose) {
        // +$BC goes down as the car goes forward; the engine's x rotation rolls a wheel forward going up.
        const spin   = ((-this._wheelSpin * 360) / RacingCarView.TURN);
        // rot = ((-s >> 6) + (-s >> 7)) x 2 in 1/8192 turn (descriptor $FF6174), the engine's roll turning the other way.
        const steer  = ((((this._steering * 3) / 64) * 360) / RacingCarView.STEERING_TURN) * this._side;
        // A left turn (positive) points the front wheels left: the engine's y rotation turns them right.
        const front  = (-((this._wheelTurn * 360) / RacingCarView.TURN) * this._side);
        const tilt   = [(pitch + pose.pitch), 0, (roll + pose.roll)];
        const raised = [position[0], (position[1] + pose.lift), position[2]];
        this._body.identity();
        this._axis.rotationX(tilt[0] * Math.PI / 180);
        this._body.multiply(this._axis);
        this._axis.rotationZ(tilt[2] * Math.PI / 180);
        this._body.multiply(this._axis);
        this._rotation[1] = (yaw + pose.yaw);

        this._showParts();
        for (const part of this._shown) {
            const [x, y, z] = this._body.multiplyPosition([part.offset[0], part.offset[1], part.offset[2], 1]);
            part.instance.setPreRotate(this._ownTurn(part.turns, spin, front, steer))
                .setRotation(this._rotation)
                .setPose(raised, [x, y, z], tilt);
        }

        return this;
    }

    /**
     * @returns {Instance[]} the parts shown, as placed last
     */
    getInstances() {
        return this._instances;
    }

    /**
     * @returns {Instance[]} the parts of both views
     */
    getAllInstances() {
        return [...this._outside, ...this._cockpit, ...this._effects.map((effect) => effect.part)].map((part) => part.instance);
    }

    // The parts of the current view, the shadow unless hidden, the effects at their current frame outside.
    _showParts() {
        this._shown.length = 0;
        for (const part of (this._inCockpit ? this._cockpit : this._outside)) {
            if ((part !== this._shadow) || this._shadowOn) {
                this._shown.push(part);
            }
        }
        if (!this._inCockpit && (this._frames !== null)) {
            for (const effect of this._effects) {
                const frame = ((effect.side === null) ? this._frames[effect.kind] : this._frames[effect.kind][effect.side]);
                if (frame === effect.frame) {
                    this._shown.push(effect.part);
                }
            }
        }
        this._instances.length = 0;
        for (const part of this._shown) {
            this._instances.push(part.instance);
        }
    }

    // A wheel rolls, then steers; the steering wheel turns on its column.
    _ownTurn(turns, spin, front, steer) {
        switch (turns) {
            case 'front':
                return [spin, front, 0];
            case 'spin':
                return [spin, 0, 0];
            case 'steer':
                return [0, 0, steer];
            default:
                return null;
        }
    }

    _addPart(data, offset, turns) {
        const objectId   = loader.objects().loadFromData(null, data);
        const instanceId = loader.instances().loadFromData(null, RacingCarView.instanceData(objectId));

        return {instanceId, instance: null, offset, turns};
    }

    /**
     * Loader data of a still instance of an object, placed by the game.
     *
     * @param {int} objectId
     * @returns {object}
     */
    static instanceData(objectId) {
        return {object: objectId, position: [0, 0, 0], rotation: [0, 0, 0], trigger: 'none', keyframes: [], collisionShape: 'none'};
    }

    // The original screens the shadow and the tyre smoke with a 50 % dither (its captures); here as a 50 % blend
    // of their own colours.
    static _screened(data) {
        for (const face of data.faces) {
            face.color = [face.color[0], face.color[1], face.color[2], RacingCarView.SCREEN_ALPHA];
        }

        return data;
    }
}

RacingCarView.SCREEN_ALPHA     = 0.5;
// Metres: deeper than the car ever dips into the road (painter's order of the original), short of the walls beside it.
RacingCarView.DEPTH_BIAS       = 1.5;
// Above the road, against z-fighting.
RacingCarView.SHADOW_LIFT      = 0.02;
// Wheel spin of a tick in 1/65536 turn: speed x 64, x 4 from $1900, at most $7080.
RacingCarView.TURN             = 65536;
RacingCarView.SPIN_PER_KMH     = 64;
RacingCarView.SPIN_FAST        = 0x1900;
RacingCarView.SPIN_FAST_FACTOR = 4;
RacingCarView.SPIN_LIMIT       = 0x7000;
RacingCarView.SPIN_MAX         = 0x7080;
RacingCarView.STEERING_TURN    = 8192;
// Render slots of the effects ($FF6178...), model units: behind the rear wheels, under the tail, at the exhaust.
RacingCarView.EFFECT_REAR_WHEEL = [(215 * 4), 0, (-768 * 4)];
RacingCarView.EFFECT_SPARKS     = [0, 0, (-778 * 4)];
RacingCarView.EFFECT_FLAMES     = [0, 0, (-758 * 4)];

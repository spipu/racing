/**
 * The car as the original assembles it, every part one engine instance at the
 * car position, its offset and turn given as animation deltas:
 *   - outside: the body, the two front wheels and the rear axle at their
 *     offsets (cars.json wheels), and the flat shadow darkening the ground;
 *   - cockpit view: the cockpit shell, its front wheels at the same offsets
 *     when the car shows them (cars.json cockpitWheels: the Formula only), and
 *     the steering wheel with the driver's arms (the rear axle is not drawn).
 * The wheels spin with the speed ($859A), the front wheels steer by the turn
 * rate (+$90, $2984), the steering wheel follows the steering ($C088). The
 * shadow, a part of the body (its descriptor relative to the body, angles 0),
 * is hidden while the car recovers from a crash ($2A86). The original paints
 * the car over the road it dips into: its outside parts carry a depth bias. Outside, the
 * effect models of the common bank play at the car's render slots ($3F86,
 * cars.json effectOffsets): tyre smoke, grass and sand behind each rear wheel
 * (the left ones mirrored), sparks under the tail, exhaust flames; the Stock
 * moves its smoke towards the side it slides to.
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
        this._side      = ((mirror) ? -1 : 1);
        this._scale     = scale;
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

        // One part per frame of each effect at the car's render slot: kind (physics effectFrames), side (index in it,
        // null: one frame for both), wheel (0 left, mirrored, 1 right, null: centre).
        const slots     = car.effectOffsets;
        const addEffect = (kind, side, wheel, frames, screened) => {
            const units = slots[kind];
            const left  = (wheel === RacingCarView.LEFT);
            frames.forEach((code, frame) => {
                const data = model(code, (mirror !== left));
                const part = this._addPart(((screened) ? RacingCarView._screened(data) : data), offset([((left) ? -units[0] : units[0]), units[1], units[2]]), null);
                this._effects.push({kind, side, wheel, frame, part});
            });
        };
        addEffect('smoke', null, RacingCarView.LEFT, cars.effects.tyre_smoke, true);
        addEffect('smoke', null, RacingCarView.RIGHT, cars.effects.tyre_smoke, true);
        addEffect('sparks', null, null, cars.effects.sparks, false);
        addEffect('flames', null, null, cars.effects.exhaust_flames, false);
        addEffect('grass', RacingCarView.LEFT, RacingCarView.LEFT, cars.effects.grass, false);
        addEffect('grass', RacingCarView.RIGHT, RacingCarView.RIGHT, cars.effects.grass, false);
        addEffect('sand', RacingCarView.LEFT, RacingCarView.LEFT, cars.effects.dirt, false);
        addEffect('sand', RacingCarView.RIGHT, RacingCarView.RIGHT, cars.effects.dirt, false);

        const [shell, left, right] = car.cockpit;
        this._cockpit.push(this._addPart(model(shell, mirror), [0, 0, 0], null));
        if (car.cockpitWheels) {
            [left, right].forEach((code, i) => this._cockpit.push(this._addPart(model(code, mirror), offset(car.wheels[i].offset), 'front')));
        }
        this._cockpit.push(this._addPart(model(cars.steeringWheel, mirror), offset(car.steeringWheelOffset), 'steer'));
    }

    /**
     * Instances are created by the loader: the parts are bound once it has loaded them.
     */
    bind() {
        const outside = [...this._outside, ...this._effects.map((effect) => effect.part)];
        for (const part of [...outside, ...this._cockpit]) {
            part.instance = loader.instances().get(part.instanceId);
        }
        // Not the cockpit: within the bias of the eye, its parts would all share the near plane depth.
        for (const part of outside) {
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
     * @param {object}        frames - RacingCarPhysics.effectFrames, read when the car is placed
     * @param {boolean}       shadow - the shadow shown
     * @param {number[]|null} smokeX - RacingCarPhysics.smokeX: x of the left and right tyre smoke, model units / 4
     */
    setEffects(frames, shadow, smokeX) {
        this._frames   = frames;
        this._shadowOn = shadow;
        if (smokeX !== null) {
            for (const effect of this._effects) {
                if (effect.kind === 'smoke') {
                    const x = ((effect.wheel === RacingCarView.LEFT) ? -smokeX[RacingCarView.LEFT] : smokeX[RacingCarView.RIGHT]);
                    effect.part.offset[0] = (x * RacingCarView.SLOT_UNITS * this._scale * this._side);
                }
            }
        }

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
// Wheel of an effect pair; the left one is mirrored.
RacingCarView.LEFT             = 0;
RacingCarView.RIGHT            = 1;
// Model units per unit of the render slots.
RacingCarView.SLOT_UNITS       = 4;

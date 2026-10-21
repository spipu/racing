/**
 * The 4 mechanics of a pit box (race.json pit), animated by skeleton
 * (models/pit_mechanic.gltf, converted once from the original's frames): each
 * stands at its place around the box ($3C7E: base of the box, the course's for
 * the first place, x + dx and z - dz by car, angles 0) and plays its own clip. By the
 * clip's events it handles its wheel gun and the car's wheel of its place
 * (RacingWheelModels): the wheel it takes off leaves the car's hub as the car
 * hides its own, the new one goes back onto the hub as the car shows its own
 * again. Its first pose is held until the crew starts; the game hears of the
 * wheels, the gun bursts, the repair and the end through callbacks.
 */
class RacingPitCrew {
    /**
     * Loads the mechanic and its wheel gun with the scene (pit_mechanic.gltf, pit_wrench.gltf).
     *
     * @param {string}               assets    - url of the game's data (RacingGame.ASSETS)
     * @param {RacingModelConverter} converter
     * @param {RacingWheelModels}    wheels    - the car's wheels
     * @param {object}  pit      - race.json pit
     * @param {object}  car      - entry of cars.json cars
     * @param {int[]}   base     - [x, height, z] of the box, entity units (RacingPitBoxes)
     * @param {number}  carScale - metres per car model unit
     * @param {boolean} mirror
     */
    constructor(assets, converter, wheels, pit, car, base, carScale, mirror) {
        this._converter  = converter;
        this._wheels     = wheels;
        this._pit        = pit;
        this._car        = car;
        this._base       = base;
        this._carScale   = carScale;
        this._mirror     = mirror;
        this._mechanics  = [];
        this._shown      = false;
        this._started    = false;
        this._instances  = [];
        this._events     = [];
        this._onWheel    = () => {};
        this._onWrench   = () => {};
        this._onRepaired = () => {};
        this._onFinished = () => {};
        this._modelId    = loader.animatedModels().load(assets + RacingPitCrew.MECHANIC_FILE);
        this._wrenchId   = loader.staticModels().load(assets + RacingPitCrew.WRENCH_FILE);
    }

    /**
     * Once the loader has loaded the models: the mechanics, each with its gun and the car's wheel of its place, in
     * their first pose.
     */
    bind() {
        const converter     = this._converter;
        const carScale      = this._carScale;
        const mirror        = this._mirror;
        const side          = ((mirror) ? -1 : 1);
        const model         = loader.animatedModels().get(this._modelId);
        const materialColor = (material) => converter.materialColor(material);
        const wrenchData    = loader.staticModels().get(this._wrenchId).toObjectData(materialColor, mirror);
        const hubs          = this._car.wheels.flatMap((wheel) => this._wheels.wheelsOf(wheel.model, wheel.offset));
        const [x, y, z]     = this._base;
        this._mechanics = RacingPitCrew.CLIPS.map((name, n) => {
            const [dx, dz] = this._pit.mechanicOffsets[this._car.code][n];
            const wheel    = RacingPitCrew.WHEEL_OF[n];
            const hub      = hubs[wheel];
            const held     = this._wheels.centred(hub.radius, hub.width);
            const position = [((x + dx) * RacingGame.METRES_PER_ENTITY_UNIT * side), (y * RacingGame.METRES_PER_HEIGHT_UNIT), ((z - dz) * RacingGame.METRES_PER_ENTITY_UNIT)];
            const points   = [];
            for (let i = 0; i < held.v.length; i += 3) {
                points.push([(held.v[i] * carScale), (held.v[i + 1] * carScale), (held.v[i + 2] * carScale)]);
            }

            return {
                clip:        model.getClip(name),
                wheel:       wheel,
                animated:    new AnimatedInstance(model, {mirror: mirror, materialColor: materialColor, position: position}).bind(),
                objects:     {
                    wrench:       RacingPitCrew._instance(wrenchData),
                    removedWheel: RacingPitCrew._instance(converter.toObjectData(held, carScale, mirror)),
                    newWheel:     RacingPitCrew._instance(converter.toObjectData(held, carScale, mirror)),
                },
                // The wheel as it is handled (not mirrored, metres): it rests on the ground on its lowest point.
                wheelPoints: points,
                hub:         Mat4.create(),
                world:       Mat4.create(),
                matrix:      new Matrix().identity(),
                carWheelOn:  true,
                taken:       false,
                mounted:     false,
            };
        });

        return this.reset();
    }

    /**
     * @param {function(int, boolean)} callback - (car wheel as RacingCarView.setWheelOff, taken off)
     */
    setOnWheel(callback) {
        this._onWheel = callback;

        return this;
    }

    /**
     * @param {function(int)} callback - (mechanic): a burst of its wheel gun ($BA)
     */
    setOnWrench(callback) {
        this._onWrench = callback;

        return this;
    }

    /**
     * @param {function(int)} callback - (mechanic): its work repairs the car (frame 20 of the original)
     */
    setOnRepaired(callback) {
        this._onRepaired = callback;

        return this;
    }

    /**
     * @param {function(int)} callback - (mechanic): its clip is over (frame 27 of the original)
     */
    setOnFinished(callback) {
        this._onFinished = callback;

        return this;
    }

    isStarted() {
        return this._started;
    }

    /**
     * @param {boolean} shown - the crew stands at the box ($C026 not -1)
     */
    show(shown) {
        this._shown = shown;

        return this;
    }

    /**
     * Back to the first pose, held: the gun in hand, the new wheel on the ground, the car's wheels on the car.
     */
    reset() {
        this._started = false;
        for (const mechanic of this._mechanics) {
            for (const object of Object.values(mechanic.objects)) {
                mechanic.animated.detach(object);
            }
            mechanic.carWheelOn = true;
            mechanic.taken      = false;
            mechanic.mounted    = false;
            mechanic.animated.getPlayer().play(mechanic.clip, {time: 0, speed: 0});
            this._update(mechanic, 0);
        }

        return this;
    }

    /**
     * The mechanics start their clips as scheduled, working on the car's wheels where they are now.
     *
     * @param {RacingPitCrewSchedule} schedule
     * @param {Float32Array[]}        hubs     - the car's wheels in the world (RacingCarView.hubMatrix), by car wheel
     */
    start(schedule, hubs) {
        this._started = true;
        this._mechanics.forEach((mechanic, n) => {
            const speed = schedule.getSpeed(n);
            mechanic.animated.toLocal(mechanic.hub, hubs[mechanic.wheel]);
            mechanic.animated.getPlayer().play(mechanic.clip, {time: -(schedule.getDelay(n) * speed), speed: speed});
        });

        return this;
    }

    /**
     * @param {number} ticks - time elapsed, in original ticks (0 under the pause)
     */
    update(ticks) {
        const seconds = ((ticks * RacingGame.TICK_MS) / RacingGame.MS_PER_SECOND);
        for (const mechanic of this._mechanics) {
            this._update(mechanic, seconds);
        }

        return this;
    }

    /**
     * @returns {Instance[]} the mechanics and the objects they show, none when the crew is away
     */
    getInstances() {
        this._instances.length = 0;
        if (this._shown) {
            for (const mechanic of this._mechanics) {
                this._instances.push(mechanic.animated.getInstance(), mechanic.objects.wrench);
                if (mechanic.taken) {
                    this._instances.push(mechanic.objects.removedWheel);
                }
                if (!(mechanic.mounted && mechanic.carWheelOn)) {
                    this._instances.push(mechanic.objects.newWheel);
                }
            }
        }

        return this._instances;
    }

    /**
     * @returns {Instance[]} every instance of the crew
     */
    getAllInstances() {
        return this._mechanics.flatMap((mechanic) => [mechanic.animated.getInstance(), ...Object.values(mechanic.objects)]);
    }

    _update(mechanic, seconds) {
        mechanic.animated.update(seconds, this._events);
        for (const event of this._events) {
            this._handle(mechanic, event);
        }
    }

    _handle(mechanic, event) {
        const data   = event.getData();
        const object = mechanic.objects[data.object];
        const n      = this._mechanics.indexOf(mechanic);
        switch (event.getName()) {
            case 'pickUp':
                mechanic.animated.attach(object, data.socket, data.transition);
                break;
            case 'putDown':
                mechanic.animated.detach(object, this._placeOf(mechanic, data), data.transition);
                mechanic.mounted = (mechanic.mounted || (data.to === RacingPitCrew.HUB));
                break;
            case 'wheelOff':
                // The car's wheel, now the mechanic's, exactly where the car had it.
                mechanic.carWheelOn = false;
                mechanic.taken      = true;
                mechanic.objects.removedWheel.setWorldMatrix(Mat4.toMatrix(mechanic.matrix, mechanic.animated.toWorld(mechanic.world, mechanic.hub)));
                this._onWheel(mechanic.wheel, true);
                break;
            case 'wheelOn':
                mechanic.carWheelOn = true;
                this._onWheel(mechanic.wheel, false);
                break;
            case 'wrench':
                this._onWrench(n);
                break;
            case 'repaired':
                this._onRepaired(n);
                break;
            case 'finished':
                this._onFinished(n);
                break;
        }
    }

    // Where an object is laid, in the mechanic's space: the hub; or the event's place, a wheel resting on the ground
    // on its lowest point as it lies there.
    _placeOf(mechanic, data) {
        if (data.to === RacingPitCrew.HUB) {
            return mechanic.hub;
        }
        const place = Mat4.fromTranslationRotationScale(Mat4.create(), data.translation, 0, data.rotation, 0, RacingCarView.UNIT_SCALE, 0);
        if (data.object !== RacingPitCrew.WRENCH) {
            const [x, y, z] = RacingPitCrew.HEIGHT_COLUMN;
            place[RacingPitCrew.HEIGHT] = -Math.min(...mechanic.wheelPoints.map((p) => ((p[0] * place[x]) + (p[1] * place[y]) + (p[2] * place[z]))));
        }

        return place;
    }

    // An instance of an object of the scene, placed by the mechanic.
    static _instance(data) {
        return loader.instances().get(loader.instances().loadFromData(null, RacingCarView.instanceData(loader.objects().loadFromData(null, data))));
    }
}

// The clips of pit_mechanic.gltf, in the order of race.json pit (mechanicOffsets), and the car wheel each works on
// (RacingCarView.setWheelOff).
RacingPitCrew.CLIPS         = ['rearRight', 'frontRight', 'rearLeft', 'frontLeft'];
RacingPitCrew.WHEEL_OF      = [3, 1, 2, 0];
RacingPitCrew.MECHANIC_FILE = 'models/pit_mechanic.gltf';
RacingPitCrew.WRENCH_FILE   = 'models/pit_wrench.gltf';
RacingPitCrew.HUB           = 'hub';
// The wheel gun, as the clips' events name it.
RacingPitCrew.WRENCH        = 'wrench';
// Where a Mat4 holds the height of its translation, and what each of a point's x, y and z adds to it.
RacingPitCrew.HEIGHT        = 13;
RacingPitCrew.HEIGHT_COLUMN = [1, 5, 9];

/**
 * One mechanic of the viewer: its clip played by an AnimatedInstance, the objects it handles moved by its events as
 * the game will (the wheel gun, the car's wheel it takes off, the new one it puts on), the car's wheel hidden from
 * "wheel off" to "wheel on".
 */
class PitCrewMember {
    /**
     * @param {string}        name   - its clip, and the car's wheel it works on (PitCrewCar.WHEELS)
     * @param {AnimatedModel} model
     * @param {Instance}      wrench
     */
    constructor(name, model, wrench) {
        this._name       = name;
        this._clip       = model.getClip(name);
        this._mechanic   = new AnimatedInstance(model).bind();
        this._objects    = {wrench: wrench, removedWheel: null, newWheel: null};
        this._wheelsBy   = new Map();
        this._origin     = [0, 0, 0];
        this._hub        = Mat4.create();
        this._world      = Mat4.create();
        this._matrix     = new Matrix().identity();
        this._events     = [];
        this._log        = [];
        this._carWheelOn = true;
        this._mounted    = false;
    }

    getName() {
        return this._name;
    }

    /**
     * @returns {boolean} whether the car shows its own wheel at this mechanic's place
     */
    isCarWheelOn() {
        return this._carWheelOn;
    }

    /**
     * @returns {string[]} the events crossed since the clip started, newest last
     */
    getLog() {
        return this._log;
    }

    getTime() {
        return this._mechanic.getPlayer().getTime();
    }

    /**
     * At its place around a car (race.json pit.mechanicOffsets, entity units: x right, z back), working on its hub
     * with its own wheels.
     *
     * @param {PitCrewCar} car
     * @param {number[]}   offset
     */
    placeAround(car, offset) {
        const hub = car.getHub(this._name);
        this._origin = [(offset[0] * PitCrewMember.ENTITY_METRES), 0, (-offset[1] * PitCrewMember.ENTITY_METRES)];
        this._mechanic.place(this._origin, [0, 0, 0]);
        // In the mechanic's space; a left wheel is the right one turned half round the vertical.
        const centre = hub.centre.map((value, k) => ((value * PitCrewCar.METRES) - this._origin[k]));
        Mat4.fromTranslationRotationScale(this._hub, centre, 0, ((hub.side === PitCrewCar.LEFT) ? PitCrewMember.HALF_TURN : PitCrewMember.NO_TURN), 0, PitCrewMember.UNIT_SCALE, 0);
        if (!this._wheelsBy.has(car)) {
            this._wheelsBy.set(car, {removedWheel: car.makeHandledWheel(this._name), newWheel: car.makeHandledWheel(this._name)});
        }
        for (const object of ['removedWheel', 'newWheel']) {
            if (this._objects[object] !== null) {
                this._mechanic.detach(this._objects[object]);
            }
            this._objects[object] = this._wheelsBy.get(car)[object];
        }
    }

    /**
     * The clip from its start to a time, the objects handled on the way.
     *
     * @param {number} time - seconds
     * @param {number} step - seconds between two updates on the way
     */
    restart(time, step) {
        for (const instance of Object.values(this._objects)) {
            this._mechanic.detach(instance);
        }
        this._carWheelOn = true;
        this._mounted    = false;
        this._objects.removedWheel.hidden = true;
        this._objects.newWheel.hidden     = false;
        this._log.length = 0;
        this._mechanic.getPlayer().play(this._clip, {time: 0});
        this.update(0);
        for (let t = 0; t < time; t += step) {
            this.update(Math.min(step, (time - t)));
        }
    }

    /**
     * @param {number} dt - seconds
     */
    update(dt) {
        this._mechanic.update(dt, this._events);
        for (const event of this._events) {
            this._handle(event);
        }
        // The new wheel on the hub once the car shows its own there again.
        if (this._mounted && this._carWheelOn) {
            this._objects.newWheel.hidden = true;
        }
    }

    /**
     * @returns {Instance[]} the mechanic and the objects seen
     */
    getInstances() {
        return [this._mechanic.getInstance(), ...Object.values(this._objects).filter((instance) => !instance.hidden)];
    }

    _handle(event) {
        const data   = event.getData();
        const object = this._objects[data.object];
        this._log.push([event.getTime().toFixed(2), event.getName(), data.object, (data.from && ('from ' + data.from)), (data.to && ('to ' + data.to))].filter(Boolean).join(' '));
        switch (event.getName()) {
            case 'wheelOff':
                // The car's wheel, now the mechanic's, exactly where the car had it.
                this._carWheelOn = false;
                this._objects.removedWheel.hidden = false;
                this._objects.removedWheel.setWorldMatrix(Mat4.toMatrix(this._matrix, this._mechanic.toWorld(this._world, this._hub)));
                break;
            case 'wheelOn':
                this._carWheelOn = true;
                break;
            case 'pickUp':
                this._mechanic.attach(object, data.socket, data.transition);
                break;
            case 'putDown':
                this._mechanic.detach(object, this._placeOf(data, object), data.transition);
                this._mounted = (this._mounted || (data.to === 'hub'));
                break;
        }
    }

    // Where an object is laid, in the mechanic's space: the hub; or the event's place, a wheel resting there on its lowest point.
    _placeOf(data, object) {
        if (data.to === 'hub') {
            return this._hub;
        }
        const place = Mat4.fromTranslationRotationScale(Mat4.create(), data.translation, 0, data.rotation, 0, PitCrewMember.UNIT_SCALE, 0);
        if (data.object !== 'wrench') {
            const [x, y, z] = PitCrewMember.HEIGHT_COLUMN;
            place[PitCrewMember.HEIGHT] = -Math.min(...object.getObject().ptOrigin.map((p) => ((p[0] * place[x]) + (p[1] * place[y]) + (p[2] * place[z]))));
        }

        return place;
    }
}

// Metres per entity unit of race.json (64 car model units of 1/1024 m).
PitCrewMember.ENTITY_METRES = (64 / 1024);
PitCrewMember.HALF_TURN     = [0, 1, 0, 0];
PitCrewMember.NO_TURN       = [0, 0, 0, 1];
PitCrewMember.UNIT_SCALE    = [1, 1, 1];
// Where a Mat4 holds the height of its translation, and what each of a point's x, y and z adds to it.
PitCrewMember.HEIGHT        = 13;
PitCrewMember.HEIGHT_COLUMN = [1, 5, 9];

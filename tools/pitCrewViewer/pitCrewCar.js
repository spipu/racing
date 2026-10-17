/**
 * A car of the viewer, at the origin heading +z: its body and its four wheels (the rear axle cut in two by the sign
 * of x), every wheel made by the game (RacingWheelModels), and the wheels the mechanics handle: the car's own at each
 * place, centred on its hub.
 */
class PitCrewCar {
    /**
     * @param {object} cars     - cars.json
     * @param {object} palettes - palettes.json
     * @param {object} car      - entry of cars.json cars
     */
    constructor(cars, palettes, car) {
        const converter = new RacingModelConverter(new RacingPalette(palettes, PitCrewCar.COURSE, car.code));
        const wheels    = new RacingWheelModels(cars, car);
        const placed    = (model, offset) => ({...model, v: model.v.map((value, i) => (value + offset[i % 3]))});
        const side      = (model, sign) => ({...model, f: model.f.filter((face) => face.i.every((i) => (Math.sign(model.v[i * 3]) === sign)))});
        const [left, right, axle] = car.wheels.map((wheel) => placed(wheels.replace(wheel.model, wheel.offset), wheel.offset));
        const found     = car.wheels.flatMap((wheel) => wheels.wheelsOf(wheel.model, wheel.offset));

        this._converter = converter;
        this._models    = wheels;
        this._body      = this._instance(cars.models[car.body]);
        this._wheels    = {
            frontLeft:  this._instance(left),
            frontRight: this._instance(right),
            rearLeft:   this._instance(side(axle, PitCrewCar.LEFT)),
            rearRight:  this._instance(side(axle, PitCrewCar.RIGHT)),
        };
        this._hubs      = Object.fromEntries(PitCrewCar.WHEELS.map((name, i) => [name, found[i]]));
    }

    /**
     * @returns {Instance}
     */
    getBody() {
        return this._body;
    }

    /**
     * @param {string} name - one of PitCrewCar.WHEELS
     * @returns {Instance} the car's wheel there
     */
    getWheel(name) {
        return this._wheels[name];
    }

    /**
     * @param {string} name - one of PitCrewCar.WHEELS
     * @returns {{centre: number[], radius: number, width: number, side: number}} car units (RacingWheelModels.wheelsOf)
     */
    getHub(name) {
        return this._hubs[name];
    }

    /**
     * @param {string} name - one of PitCrewCar.WHEELS
     * @returns {Instance} a new wheel as the mechanic at that place handles it: centred, its outer face towards +x
     */
    makeHandledWheel(name) {
        const hub = this._hubs[name];

        return this._instance(this._models.centred(hub.radius, hub.width));
    }

    _instance(model) {
        const objectId = loader.objects().loadFromData(null, this._converter.toObjectData(model, PitCrewCar.METRES, false));

        return loader.instances().get(loader.instances().loadFromData(null, RacingCarView.instanceData(objectId)));
    }
}

// The car's wheels in the order RacingWheelModels.wheelsOf finds them: each front model, then the rear axle's ends.
PitCrewCar.WHEELS = ['frontLeft', 'frontRight', 'rearLeft', 'rearRight'];
PitCrewCar.LEFT   = -1;
PitCrewCar.RIGHT  = 1;
// Metres per car model unit.
PitCrewCar.METRES = (1 / 1024);
// Course palette of the car's colours (the cars' own are copied over it).
PitCrewCar.COURSE = 'big_forest';

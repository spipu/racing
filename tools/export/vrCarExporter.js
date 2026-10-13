const {VrCarScene}     = require('./vrCarScene');
const {VrModelEncoder} = require('./vrModelEncoder');
const {VrRom}          = require('./vrRom');

/**
 * cars.json: the models of the 3 car banks, of the opponents' bank and of the common bank (effects), and how the
 * game assembles each car outside and in the cockpit view.
 */
class VrCarExporter {
    /**
     * @param {VrRom}          rom
     * @param {VrModelReader}  reader
     * @param {VrModelEncoder} encoder
     * @param {object}         map - VR_ROM_MAP
     */
    constructor(rom, reader, encoder, map) {
        this._rom     = rom;
        this._reader  = reader;
        this._encoder = encoder;
        this._map     = map;
        this._models  = {};
    }

    export(format) {
        const map  = this._map;
        const id   = VrModelEncoder.id;
        const cars = map.cars.map((car, index) => {
            const scene = new VrCarScene(this._rom, map.carScene, index);
            return {
                code:                car.code,
                name:                car.name,
                body:                id(car.body),
                shadow:              id(car.shadow),
                cockpit:             car.cockpit.map((offset) => id(offset)),
                cockpitWheels:       car.cockpitWheels,
                pitHidesShadow:      car.pitHidesShadow,
                wheels:              this._wheels(car, scene),
                steeringWheelOffset: this._offsets(scene, map.carScene.steeringOffset, 1)[0],
                damaged:             map.carScene.damagedModels.map((variable) => this._bankModel(car, scene.value(variable))),
                damagedCockpit:      this._bankModel(car, scene.value(map.carScene.damagedCockpit)),
                effectOffsets:       this._effectOffsets(index),
                bank:                this._bank(car.bank),
            };
        });
        for (const car of cars) {
            for (const model of [...car.damaged, car.damagedCockpit]) {
                if (this._models[model] === undefined) {
                    throw new Error(car.code + ': damaged model ' + model + ' outside the car bank');
                }
            }
        }
        return {
            format:        format,
            vertexShift:   map.carVertexShift,
            cars:          cars,
            steeringWheel: id(map.steeringWheel),
            effects:       Object.fromEntries(Object.entries(map.effects).map(([name, effect]) => [name, this._effectFrames(effect)])),
            opponentBank:  this._bank(map.opponentBank),
            commonBank:    this._bank(map.commonBank),
            models:        this._models,
        };
    }

    // The models of a bank, encoded once, by identifier.
    _bank(bank) {
        return this._reader.readSequence(bank.start, bank.end).map((model) => {
            const key = VrModelEncoder.id(model.offset);
            this._models[key] = this._encoder.encode(model);
            return key;
        });
    }

    // Exterior wheels as the car scene block places them: {model, offset} with the offset in model units.
    _wheels(car, scene) {
        const map    = this._map.carScene;
        const shadow = this._bankModel(car, scene.value(map.shadowModel));
        if (shadow !== VrModelEncoder.id(car.shadow)) {
            throw new Error(car.code + ': shadow model ' + shadow + ' in the car scene block');
        }
        const offsets = this._offsets(scene, map.wheelOffsets, map.wheelModels.length);

        return map.wheelModels.map((variable, wheel) => ({model: this._bankModel(car, scene.value(variable)), offset: offsets[wheel]}));
    }

    // Offsets {x, y, z} in model units.
    _offsets(scene, variable, count) {
        const words = scene.words(variable, (count * VrCarExporter.AXES));
        return Array.from({length: count}, (unused, i) => words.slice((i * VrCarExporter.AXES), ((i + 1) * VrCarExporter.AXES)).map((word) => (word * this._map.carScene.offsetScale)));
    }

    // {smoke, sparks, flames, grass, sand}: offset of each effect in model units, the right one of a pair.
    _effectOffsets(car) {
        const map     = this._map.effectSlots;
        const slots   = this._rom.pointer68k(map.table, car);
        const offsets = {};
        map.slots.forEach((kind, slot) => {
            offsets[kind] = this._rom.words((slots + (slot * VrCarExporter.AXES * 2)), VrCarExporter.AXES, true).map((word) => (word * this._map.carScene.offsetScale));
        });

        return offsets;
    }

    _bankModel(car, sdram) {
        return VrModelEncoder.id(car.bank.start + (sdram - this._map.carScene.bankSdram));
    }

    _effectFrames(effect) {
        return Array.from({length: effect.frames}, (unused, frame) => {
            const pointer = this._rom.u32(effect.table + (frame * VrRom.POINTER_SIZE));
            return VrModelEncoder.id(this._map.commonBank.start + (pointer - this._map.commonBankSdram));
        });
    }
}

VrCarExporter.AXES = 3;

module.exports = {VrCarExporter};

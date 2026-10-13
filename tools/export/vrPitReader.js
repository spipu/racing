const {VrModelEncoder} = require('./vrModelEncoder');
const {VrRom}          = require('./vrRom');

/**
 * Pit stops of the original (VR_ROM_MAP.pit): the 4 mechanics and their animation, where they stand, the pit boxes.
 *
 *   mechanics:       [{frames: [[body, tool, removed wheel, new wheel] model ids or null, ...]}] (frame = ticks x 7 / 30)
 *   mechanicBases:   {course: [x, y, z]} - the pit box of place 0 (x / z in entity units, y in 1/256 m)
 *   mechanicOffsets: {car: [[dx, dz] x 4]} - entity units, the mechanic at (x + dx, z - dz)
 *   pitBoxes:        {course: [[x, z] x 4]} - the box of each place
 *   approachX:       {course: dx} - x offset of the automatic approach to the box
 */
class VrPitReader {
    /**
     * @param {VrRom}         rom
     * @param {VrModelReader} reader
     * @param {object}        map - VR_ROM_MAP
     */
    constructor(rom, reader, map) {
        this._rom    = rom;
        this._reader = reader;
        this._map    = map;
    }

    /**
     * @param {Map<string, object>} models - filled with the models of the mechanics, by identifier
     */
    read(models) {
        const map    = this._map;
        const pit    = map.pit;
        const byCode = (list, read) => Object.fromEntries(list.map((entry, i) => [entry.code, read(i)]));
        const table  = (entry, i) => this._rom.words((this._rom.fileFrom68k(entry.address) + (i * entry.words * VrPitReader.WORD_SIZE)), entry.words, true);
        const pairs  = (words) => Array.from({length: (words.length / 2)}, (unused, i) => words.slice((i * 2), ((i + 1) * 2)));

        return {
            mechanics:       Array.from({length: pit.mechanicCount}, (unused, n) => this._mechanic(n, models)),
            mechanicBases:   byCode(map.courses, (i) => table(pit.mechanicBases, i)),
            mechanicOffsets: byCode(map.cars, (i) => pairs(table(pit.mechanicOffsets, i))),
            pitBoxes:        byCode(map.courses, (i) => pairs(table(pit.pitBoxes, i))),
            approachX:       byCode(map.courses, (i) => this._rom.words((this._rom.fileFrom68k(pit.approachX) + (i * VrPitReader.WORD_SIZE)), 1, true)[0]),
        };
    }

    _mechanic(n, models) {
        const pit   = this._map.pit;
        const table = this._rom.fileFromSh2(this._rom.u32(this._rom.fileFrom68k(pit.mechanics) + (n * VrRom.POINTER_SIZE)));
        const parts = (pit.mechanicRecord / VrRom.POINTER_SIZE);

        return {
            frames: Array.from({length: pit.mechanicFrames}, (unused, frame) => Array.from({length: parts}, (none, part) => {
                const pointer = this._rom.u32(table + (frame * pit.mechanicRecord) + (part * VrRom.POINTER_SIZE));

                return ((pointer === 0) ? null : this._model(pointer, models));
            })),
        };
    }

    _model(pointer, models) {
        const offset = this._rom.fileFromSh2(pointer);
        const id     = VrModelEncoder.id(offset);
        if (!models.has(id)) {
            models.set(id, this._reader.read(offset));
        }

        return id;
    }
}

VrPitReader.WORD_SIZE = 2;

module.exports = {VrPitReader};

/**
 * Pit stops of the original (VR_ROM_MAP.pit): where the 4 mechanics stand, the pit boxes. Their animation is not
 * exported: the game's mechanics (website/assets/virtual_racing/models/) were converted once from it.
 *
 *   mechanicBases:   {course: [x, y, z]} - the pit box of place 0 (x / z in entity units, y in 1/256 m)
 *   mechanicOffsets: {car: [[dx, dz] x 4]} - entity units, the mechanic at (x + dx, z - dz)
 *   pitBoxes:        {course: [[x, z] x 4]} - the box of each place
 *   approachX:       {course: dx} - x offset of the automatic approach to the box
 */
class VrPitReader {
    /**
     * @param {VrRom}  rom
     * @param {object} map - VR_ROM_MAP
     */
    constructor(rom, map) {
        this._rom = rom;
        this._map = map;
    }

    /**
     * @returns {{mechanicBases: object, mechanicOffsets: object, pitBoxes: object, approachX: object}} race.json pit
     */
    read() {
        const map    = this._map;
        const pit    = map.pit;
        const byCode = (list, read) => Object.fromEntries(list.map((entry, i) => [entry.code, read(i)]));
        const table  = (entry, i) => this._rom.words((this._rom.fileFrom68k(entry.address) + (i * entry.words * VrPitReader.WORD_SIZE)), entry.words, true);
        const pairs  = (words) => Array.from({length: (words.length / 2)}, (unused, i) => words.slice((i * 2), ((i + 1) * 2)));

        return {
            mechanicBases:   byCode(map.courses, (i) => table(pit.mechanicBases, i)),
            mechanicOffsets: byCode(map.cars, (i) => pairs(table(pit.mechanicOffsets, i))),
            pitBoxes:        byCode(map.courses, (i) => pairs(table(pit.pitBoxes, i))),
            approachX:       byCode(map.courses, (i) => this._rom.words((this._rom.fileFrom68k(pit.approachX) + (i * VrPitReader.WORD_SIZE)), 1, true)[0]),
        };
    }
}

VrPitReader.WORD_SIZE = 2;

module.exports = {VrPitReader};

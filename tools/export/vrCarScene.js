/**
 * The car scene block of a car: the values the game copies to RAM $C710-$C74B when the race starts (models,
 * offsets of the parts, camera view transitions), read through their RAM addresses (VR_ROM_MAP.carScene).
 */
class VrCarScene {
    /**
     * @param {VrRom}  rom
     * @param {object} map   - VR_ROM_MAP.carScene
     * @param {int}    index - car index
     */
    constructor(rom, map, index) {
        this._rom  = rom;
        this._map  = map;
        this._base = rom.pointer68k(map.table, index);
    }

    /**
     * The long held for a RAM variable.
     */
    value(variable) {
        return this._rom.u32(this._base + (variable - this._map.first));
    }

    /**
     * The file offset a RAM variable points to.
     */
    pointer(variable) {
        return this._rom.fileFrom68k(this.value(variable));
    }

    /**
     * Signed words at the offset a RAM variable points to.
     */
    words(variable, count) {
        return this._rom.words(this.pointer(variable), count, true);
    }
}

module.exports = {VrCarScene};

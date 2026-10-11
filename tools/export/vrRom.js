const crypto = require('crypto');
const fs     = require('fs');

/**
 * Virtua Racing Deluxe (USA) ROM image: big-endian reads and CPU address to file offset mapping.
 */
class VrRom {
    constructor(path) {
        this._data = fs.readFileSync(path);
        const md5  = crypto.createHash('md5').update(this._data).digest('hex');
        if (md5 !== VrRom.MD5) {
            throw new Error('unexpected ROM MD5 ' + md5 + ', expected ' + VrRom.MD5 + ' (Virtua Racing Deluxe USA)');
        }
    }

    getBytes(offset, length) {
        return this._data.subarray(offset, offset + length);
    }

    u8(offset) {
        return this._data.readUInt8(offset);
    }

    u16(offset) {
        return this._data.readUInt16BE(offset);
    }

    s16(offset) {
        return this._data.readInt16BE(offset);
    }

    u32(offset) {
        return this._data.readUInt32BE(offset);
    }

    /**
     * Words from a file offset.
     */
    words(offset, count, signed) {
        return Array.from({length: count}, (unused, i) => ((signed) ? this.s16(offset + (i * 2)) : this.u16(offset + (i * 2))));
    }

    /**
     * The file offset a 68K pointer table entry points to.
     */
    pointer68k(table, index) {
        return this.fileFrom68k(this.u32(this.fileFrom68k(table) + (index * VrRom.POINTER_SIZE)));
    }

    /**
     * SH2 view of the cartridge: $02000000 (cached) or $22000000 (cache-through).
     */
    fileFromSh2(address) {
        const offset = (address & VrRom.SH2_ROM_MASK);
        if (((address & VrRom.SH2_AREA_MASK) !== VrRom.SH2_ROM_CACHED) && ((address & VrRom.SH2_AREA_MASK) !== VrRom.SH2_ROM_THROUGH)) {
            throw new Error('not an SH2 ROM address: ' + address.toString(16));
        }
        return offset;
    }

    /**
     * 68K view: $880000-$8FFFFF is the first 512 KB, $900000-$9FFFFF the bank selected at boot (bank 1).
     */
    fileFrom68k(address) {
        const masked = (address & VrRom.M68K_ADDRESS_MASK);
        if ((masked >= VrRom.M68K_FIXED_START) && (masked < VrRom.M68K_BANK_START)) {
            return (masked - VrRom.M68K_FIXED_START);
        }
        if ((masked >= VrRom.M68K_BANK_START) && (masked < VrRom.M68K_BANK_END)) {
            return (VrRom.M68K_BANK_FILE_OFFSET + (masked - VrRom.M68K_BANK_START));
        }
        throw new Error('not a 68K ROM address: ' + address.toString(16));
    }
}

VrRom.MD5                   = '72b1ad0f949f68da7d0a6339ecd51a3f';
VrRom.POINTER_SIZE          = 4;
VrRom.SH2_ROM_MASK          = 0x003FFFFF;
VrRom.SH2_AREA_MASK         = 0xFFC00000;
VrRom.SH2_ROM_CACHED        = 0x02000000;
VrRom.SH2_ROM_THROUGH       = 0x22000000;
VrRom.M68K_ADDRESS_MASK     = 0x00FFFFFF;
VrRom.M68K_FIXED_START      = 0x880000;
VrRom.M68K_BANK_START       = 0x900000;
VrRom.M68K_BANK_END         = 0xA00000;
VrRom.M68K_BANK_FILE_OFFSET = 0x100000;

module.exports = {VrRom};

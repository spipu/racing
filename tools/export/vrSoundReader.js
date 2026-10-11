/**
 * Sound data of the game:
 *
 * - Z80 DAC samples (driver uploaded from ROM $031688): pointer table at Z80 $0105 to 6-byte entries
 *   {delay, bank, length (LE), pointer (LE)}; data at 68K $800000 + bank x $8000 + (pointer & $7FFF).
 *   4-bit DPCM, high nibble first, each nibble indexes the delta table at Z80 $00F5, accumulator from $80;
 *   2 samples per byte. Playback rate from the Z80 loop timing: 3 579 545 / ((411 + 26 x delay) / 2) Hz (computed, not measured).
 * - The 32X PWM sample: unsigned 8-bit stereo frames (left, right), played at 22 000 Hz by the SH2.
 * - Sound effect scripts (table of 68K pointers at a file offset, by effect id): a DAC command (FF 07 nn) plays sample nn, the end byte stops.
 */
class VrSoundReader {
    constructor(rom) {
        this._rom = rom;
    }

    readDacSamples(driver, count) {
        const rom     = this._rom;
        const deltas  = Array.from(rom.getBytes(driver + VrSoundReader.Z80_DELTA_TABLE, VrSoundReader.DELTA_COUNT));
        const samples = [];
        for (let i = 0; i < count; i++) {
            const pointer = (driver + this._u16le(driver + VrSoundReader.Z80_POINTER_TABLE + (i * 2)));
            const delay   = rom.u8(pointer);
            const bank    = rom.u8(pointer + 1);
            const length  = this._u16le(pointer + 2);
            const address = (VrSoundReader.M68K_BANK_BASE + (bank * VrSoundReader.BANK_SIZE) + (this._u16le(pointer + 4) & VrSoundReader.BANK_MASK));
            const offset  = rom.fileFrom68k(address);
            samples.push({
                id:     (i + 1),
                rate:   Math.round(VrSoundReader.Z80_CLOCK / ((VrSoundReader.LOOP_BASE + (VrSoundReader.LOOP_PER_DELAY * delay)) / 2)),
                pcm:    this._decodeDpcm(offset, length, deltas),
            });
        }
        return samples;
    }

    /**
     * @param {{table: int, first: int, last: int, scriptMaxLength: int, scriptEnd: int, dacCommand: int[]}} effects
     * @returns {{id: int, samples: int[]}[]} the DAC samples each effect plays (none: an FM effect)
     */
    readEffectScripts(effects) {
        const rom     = this._rom;
        const scripts = [];
        for (let id = effects.first; id <= effects.last; id++) {
            const script  = rom.fileFrom68k(rom.u32(effects.table + ((id - effects.first) * VrSoundReader.POINTER_SIZE)));
            const samples = [];
            for (let i = 0; i < effects.scriptMaxLength; i++) {
                const byte = rom.u8(script + i);
                if (byte === effects.scriptEnd) {
                    break;
                }
                if ((byte === effects.dacCommand[0]) && (rom.u8(script + i + 1) === effects.dacCommand[1])) {
                    samples.push(rom.u8(script + i + 2));
                    i += 2;
                }
            }
            scripts.push({id, samples});
        }
        return scripts;
    }

    readPwm(offset, frames) {
        return Buffer.from(this._rom.getBytes(offset, frames * 2));
    }

    _decodeDpcm(offset, length, deltas) {
        const pcm   = Buffer.alloc(length * 2);
        let   value = VrSoundReader.DPCM_START;
        for (let i = 0; i < length; i++) {
            const byte = this._rom.u8(offset + i);
            value = ((value + deltas[byte >> 4]) & 0xFF);
            pcm[i * 2] = value;
            value = ((value + deltas[byte & 0x0F]) & 0xFF);
            pcm[(i * 2) + 1] = value;
        }
        return pcm;
    }

    _u16le(offset) {
        return (this._rom.u8(offset) | (this._rom.u8(offset + 1) << 8));
    }
}

VrSoundReader.Z80_POINTER_TABLE = 0x0105;
VrSoundReader.POINTER_SIZE      = 4;
VrSoundReader.Z80_DELTA_TABLE   = 0x00F5;
VrSoundReader.DELTA_COUNT       = 16;
VrSoundReader.M68K_BANK_BASE    = 0x800000;
VrSoundReader.BANK_SIZE         = 0x8000;
VrSoundReader.BANK_MASK         = 0x7FFF;
VrSoundReader.DPCM_START        = 0x80;
VrSoundReader.Z80_CLOCK         = 3579545;
VrSoundReader.LOOP_BASE         = 411;
VrSoundReader.LOOP_PER_DELAY    = 26;

module.exports = {VrSoundReader};

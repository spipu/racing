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
    /**
     * The effect scripts: their DAC samples, the frame (60 Hz) each one starts at from the first, the frames the
     * effect track lives from the first sample (its priority holds the driver that long) and its priority.
     */
    readEffectScripts(effects) {
        const rom     = this._rom;
        const scripts = [];
        for (let id = effects.first; id <= effects.last; id++) {
            const script   = rom.fileFrom68k(rom.u32(effects.table + ((id - effects.first) * VrSoundReader.POINTER_SIZE)));
            const timeline = [];
            let frame    = 0;
            let duration = 0;
            let at       = script;
            for (let i = 0; i < effects.scriptMaxLength; i++) {
                const byte = rom.u8(at);
                if (byte === effects.scriptEnd) {
                    break;
                }
                if (byte === VrSoundReader.SMPS_SUB_COMMAND) {
                    const command = rom.u8(at + 1);
                    if (command === effects.dacCommand[1]) {
                        timeline.push({frame: frame, sample: rom.u8(at + 2)});
                    }
                    at += (2 + (VrSoundReader.SMPS_SUB_ARGUMENTS[command] ?? 0));
                } else if (byte >= VrSoundReader.SMPS_FIRST_FLAG) {
                    at += (1 + (VrSoundReader.SMPS_FLAG_ARGUMENTS[byte] ?? 0));
                } else if (byte >= VrSoundReader.SMPS_FIRST_NOTE) {
                    at++;
                    if (rom.u8(at) < VrSoundReader.SMPS_FIRST_NOTE) {
                        duration = rom.u8(at);
                        at++;
                    }
                    frame += duration;
                } else {
                    duration = byte;
                    frame   += duration;
                    at++;
                }
            }
            // The header bytes before the first sample count as durations: the times start at the first sample.
            const first = ((timeline.length > 0) ? timeline[0].frame : 0);
            scripts.push({
                id:       id,
                samples:  timeline.map((entry) => entry.sample),
                timeline: timeline.map((entry) => ({frame: (entry.frame - first), sample: entry.sample})),
                frames:   (frame - first),
                priority: rom.u8(effects.priorities + (id - VrSoundReader.FIRST_COMMAND)),
            });
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
// SMPS 68K scripts (Sonic 1 driver): notes $80-$DF (a duration may follow), durations $01-$7F, flags $E0-$FE with
// their argument bytes, FF xx sub-commands (07 nn: DAC sample nn); priorities by command from $81.
VrSoundReader.FIRST_COMMAND       = 0x81;
VrSoundReader.SMPS_FIRST_NOTE     = 0x80;
VrSoundReader.SMPS_FIRST_FLAG     = 0xE0;
VrSoundReader.SMPS_SUB_COMMAND    = 0xFF;
VrSoundReader.SMPS_SUB_ARGUMENTS  = {0x05: 1, 0x06: 2, 0x07: 1, 0x08: 1};
VrSoundReader.SMPS_FLAG_ARGUMENTS = {
    0xE0: 1, 0xE1: 1, 0xE2: 1, 0xE3: 0, 0xE4: 0, 0xE5: 2, 0xE6: 1, 0xE7: 0, 0xE8: 1, 0xE9: 1, 0xEA: 1, 0xEB: 1,
    0xEC: 1, 0xED: 1, 0xEE: 0, 0xEF: 1, 0xF0: 4, 0xF1: 0, 0xF3: 1, 0xF4: 0, 0xF5: 1, 0xF9: 0, 0xFE: 0,
};
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

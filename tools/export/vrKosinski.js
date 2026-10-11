/**
 * Sega "Kosinski" LZSS decompression, ported from the 68K routine at ROM $0013B4:
 *
 *   16-bit flag words (low byte first), consumed from bit 0; the next flag word is read as soon as the
 *   16th bit is taken, before the data it announces.
 *   flag 1: literal byte
 *   flag 0 0 + 2 flag bits (length - 2) + offset byte: copy from -256..-1
 *   flag 0 1 + 2 bytes: 13-bit offset and 3-bit length (copy length + 1 bytes);
 *                       length 0 = an extra byte: 0 ends the stream, 1 is ignored, n copies n + 1 bytes
 */
class VrKosinski {
    constructor(rom) {
        this._rom = rom;
    }

    /**
     * @returns {{data: Buffer, end: number}} the decoded bytes and the offset after the stream
     */
    decode(offset, maxSize = VrKosinski.MAX_SIZE) {
        const rom    = this._rom;
        const output = [];
        let   cursor = offset;
        let   flags  = 0;
        let   left   = 0;

        const reload = () => {
            flags  = (rom.u8(cursor) | (rom.u8(cursor + 1) << 8));
            cursor += 2;
            left   = VrKosinski.FLAG_BITS;
        };
        const nextFlag = () => {
            const bit = (flags & 1);
            flags >>= 1;
            left--;
            if (left === 0) {
                reload();
            }
            return bit;
        };
        const copy = (distance, count) => {
            if (distance > output.length) {
                throw new Error('Kosinski at ' + offset.toString(16) + ': reference before the start near ' + cursor.toString(16));
            }
            for (let i = 0; i < count; i++) {
                output.push(output[output.length - distance]);
            }
        };

        reload();
        for (;;) {
            if (output.length > maxSize) {
                throw new Error('Kosinski at ' + offset.toString(16) + ': output larger than ' + maxSize);
            }
            if (nextFlag() === 1) {
                output.push(rom.u8(cursor++));
                continue;
            }
            if (nextFlag() === 0) {
                const length = (((nextFlag() << 1) | nextFlag()) + 2);
                const low    = rom.u8(cursor++);
                copy((VrKosinski.SHORT_WINDOW - low), length);
                continue;
            }
            const low      = rom.u8(cursor++);
            const high     = rom.u8(cursor++);
            const distance = (VrKosinski.LONG_WINDOW - ((((high & VrKosinski.HIGH_OFFSET_MASK) << 5) | low)));
            const length   = (high & VrKosinski.LENGTH_MASK);
            if (length !== 0) {
                copy(distance, length + 2);
                continue;
            }
            const extra = rom.u8(cursor++);
            if (extra === VrKosinski.END_MARK) {
                break;
            }
            if (extra === VrKosinski.SKIP_MARK) {
                continue;
            }
            copy(distance, extra + 1);
        }
        return {data: Buffer.from(output), end: cursor};
    }
}

VrKosinski.FLAG_BITS        = 16;
VrKosinski.SHORT_WINDOW     = 0x100;
VrKosinski.LONG_WINDOW      = 0x2000;
VrKosinski.HIGH_OFFSET_MASK = 0xF8;
VrKosinski.LENGTH_MASK      = 0x07;
VrKosinski.END_MARK         = 0x00;
VrKosinski.SKIP_MARK        = 0x01;
VrKosinski.MAX_SIZE         = 0x20000;

module.exports = {VrKosinski};

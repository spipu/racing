/**
 * Sega "Enigma" tile map decompression:
 *
 *   u8 inline index bit count, u8 flag mask (bit 4 = priority, 3-2 = palette, 1 = V flip, 0 = H flip),
 *   u16 incrementing value, u16 common value, then an MSB-first bit stream:
 *     00 nnnn: n + 1 copies of the incrementing value (incremented after each copy)
 *     01 nnnn: n + 1 copies of the common value
 *     100 nnnn v: n + 1 copies of v        101 nnnn v: v incremented after each copy
 *     110 nnnn v: v decremented after each   111 nnnn v...: n + 1 inline values; 111 1111 ends the stream
 *   An inline value v is made of the flag bits selected by the mask (from priority down), then the index bits.
 *
 * Output: 16-bit name table words, before the caller adds its tile base.
 */
class VrEnigma {
    constructor(rom) {
        this._rom = rom;
    }

    /**
     * @returns {{words: number[], end: number}}
     */
    decode(offset, maxWords = VrEnigma.MAX_WORDS) {
        const rom        = this._rom;
        const indexBits  = rom.u8(offset);
        const flagMask   = rom.u8(offset + 1);
        let   increment  = rom.u16(offset + 2);
        const common     = rom.u16(offset + 4);
        let   cursor     = offset + 6;
        let   bitBuffer  = 0;
        let   bitCount   = 0;
        const words      = [];

        if ((indexBits === 0) || (indexBits > VrEnigma.MAX_INDEX_BITS) || ((flagMask & ~VrEnigma.FLAG_BITS_MASK) !== 0)) {
            throw new Error('Enigma at ' + offset.toString(16) + ': bad header');
        }
        const readBits = (count) => {
            let value = 0;
            for (let i = 0; i < count; i++) {
                if (bitCount === 0) {
                    bitBuffer = rom.u8(cursor++);
                    bitCount  = 8;
                }
                bitCount--;
                value = ((value << 1) | ((bitBuffer >> bitCount) & 1));
            }
            return value;
        };
        const readInline = () => {
            let value = 0;
            for (let bit = VrEnigma.FLAG_COUNT - 1; bit >= 0; bit--) {
                if ((flagMask & (1 << bit)) !== 0) {
                    value |= (readBits(1) << (VrEnigma.FLAG_SHIFT + bit));
                }
            }
            return ((value | readBits(indexBits)) & VrEnigma.WORD_MASK);
        };
        const push = (value) => {
            if (words.length >= maxWords) {
                throw new Error('Enigma at ' + offset.toString(16) + ': output larger than ' + maxWords);
            }
            words.push(value & VrEnigma.WORD_MASK);
        };

        for (;;) {
            if (readBits(1) === 0) {
                const useCommon = readBits(1);
                const count     = (readBits(4) + 1);
                for (let i = 0; i < count; i++) {
                    if (useCommon === 1) {
                        push(common);
                        continue;
                    }
                    push(increment);
                    increment = ((increment + 1) & VrEnigma.WORD_MASK);
                }
                continue;
            }
            const mode  = readBits(2);
            const count = readBits(4);
            if ((mode === VrEnigma.MODE_LIST) && (count === VrEnigma.END_COUNT)) {
                break;
            }
            if (mode === VrEnigma.MODE_LIST) {
                for (let i = 0; i <= count; i++) {
                    push(readInline());
                }
                continue;
            }
            let value = readInline();
            const step  = (VrEnigma.STEPS[mode] ?? 0);
            for (let i = 0; i <= count; i++) {
                push(value);
                value += step;
            }
        }
        return {words, end: (cursor + ((cursor - offset) & 1))};
    }
}

VrEnigma.MAX_INDEX_BITS = 11;
VrEnigma.FLAG_BITS_MASK = 0x1F;
VrEnigma.FLAG_COUNT     = 5;
VrEnigma.FLAG_SHIFT     = 11;
VrEnigma.WORD_MASK      = 0xFFFF;
VrEnigma.MODE_UP        = 1;
VrEnigma.MODE_DOWN      = 2;
VrEnigma.MODE_LIST      = 3;
// Change of the value between the words of a run.
VrEnigma.STEPS          = {[VrEnigma.MODE_UP]: 1, [VrEnigma.MODE_DOWN]: -1};
VrEnigma.END_COUNT      = 0x0F;
VrEnigma.MAX_WORDS      = 0x4000;

module.exports = {VrEnigma};

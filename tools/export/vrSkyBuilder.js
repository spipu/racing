const {VrEnigma}   = require('./vrEnigma');
const {VrKosinski} = require('./vrKosinski');

/**
 * Builds a course's sky panorama, drawn by the Mega Drive VDP on plane B: Kosinski tiles, Enigma map
 * (columns x rows of 8 x 8 cells, wrapping around 360 degrees) and four 16-colour Mega Drive palette lines.
 * Colour 0 of every line is transparent, as on the VDP.
 */
class VrSkyBuilder {
    constructor(rom) {
        this._rom      = rom;
        this._enigma   = new VrEnigma(rom);
        this._kosinski = new VrKosinski(rom);
    }

    /**
     * @returns {{width: number, height: number, rgba: Buffer}}
     */
    build(sky) {
        const tiles   = this._kosinski.decode(sky.tiles).data;
        const map     = this._enigma.decode(sky.map).words;
        const palette = this._palette(sky.palette);
        const columns = sky.columns;
        const rows    = (map.length / columns);
        if (!Number.isInteger(rows)) {
            throw new Error('sky map at ' + sky.map.toString(16) + ': ' + map.length + ' cells is not a multiple of ' + columns);
        }
        const width  = (columns * VrSkyBuilder.CELL);
        const height = (rows * VrSkyBuilder.CELL);
        const rgba   = Buffer.alloc(width * height * VrSkyBuilder.RGBA);
        map.forEach((word, cell) => {
            this._drawCell(rgba, width, tiles, palette, word, (cell % columns), Math.floor(cell / columns));
        });
        return {width, height, rgba};
    }

    /**
     * Most frequent colour of the top row: the backdrop shown above the panorama.
     *
     * @returns {int[]} [r, g, b]
     */
    backdropColor(sky) {
        const counts = new Map();
        for (let x = 0; x < sky.width; x++) {
            const key = Array.from(sky.rgba.subarray((x * VrSkyBuilder.RGBA), ((x * VrSkyBuilder.RGBA) + 3))).join(',');
            counts.set(key, ((counts.get(key) ?? 0) + 1));
        }
        const [best] = [...counts.entries()].sort((a, b) => (b[1] - a[1]))[0];

        return best.split(',').map(Number);
    }

    _drawCell(rgba, width, tiles, palette, word, column, row) {
        const tile   = (word & VrSkyBuilder.TILE_MASK);
        const line   = ((word >> VrSkyBuilder.PALETTE_SHIFT) & VrSkyBuilder.PALETTE_MASK);
        const flipV  = ((word & VrSkyBuilder.FLIP_V_BIT) !== 0);
        const flipH  = ((word & VrSkyBuilder.FLIP_H_BIT) !== 0);
        const source = (tile * VrSkyBuilder.TILE_BYTES);
        if ((source + VrSkyBuilder.TILE_BYTES) > tiles.length) {
            throw new Error('sky map cell ' + column + ',' + row + ' uses tile ' + tile + ' beyond the ' + (tiles.length / VrSkyBuilder.TILE_BYTES) + ' decoded tiles');
        }
        for (let y = 0; y < VrSkyBuilder.CELL; y++) {
            for (let x = 0; x < VrSkyBuilder.CELL; x++) {
                const sx    = ((flipH) ? (VrSkyBuilder.CELL - 1 - x) : x);
                const sy    = ((flipV) ? (VrSkyBuilder.CELL - 1 - y) : y);
                const byte  = tiles[source + (sy * 4) + (sx >> 1)];
                const index = (((sx & 1) === 0) ? (byte >> 4) : (byte & 0x0F));
                const pixel = (((((row * VrSkyBuilder.CELL) + y) * width) + (column * VrSkyBuilder.CELL) + x) * VrSkyBuilder.RGBA);
                if (index === 0) {
                    continue;
                }
                palette[(line * VrSkyBuilder.LINE_COLORS) + index].copy(rgba, pixel);
            }
        }
    }

    /**
     * Mega Drive colours: 0000 BBB0 GGG0 RRR0.
     */
    _palette(offset) {
        const colors = [];
        for (let i = 0; i < (VrSkyBuilder.LINES * VrSkyBuilder.LINE_COLORS); i++) {
            const word    = this._rom.u16(offset + (i * 2));
            const channel = (shift) => Math.round((((word >> shift) & VrSkyBuilder.CHANNEL_MASK) * 255) / VrSkyBuilder.CHANNEL_MASK);
            colors.push(Buffer.from([channel(1), channel(5), channel(9), 255]));
        }
        return colors;
    }
}

VrSkyBuilder.CELL          = 8;
VrSkyBuilder.RGBA          = 4;
VrSkyBuilder.TILE_BYTES    = 32;
VrSkyBuilder.TILE_MASK     = 0x07FF;
VrSkyBuilder.FLIP_H_BIT    = 0x0800;
VrSkyBuilder.FLIP_V_BIT    = 0x1000;
VrSkyBuilder.PALETTE_SHIFT = 13;
VrSkyBuilder.PALETTE_MASK  = 0x03;
VrSkyBuilder.LINES         = 4;
VrSkyBuilder.LINE_COLORS   = 16;
VrSkyBuilder.CHANNEL_MASK  = 0x07;

module.exports = {VrSkyBuilder};

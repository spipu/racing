/**
 * Colours of the original 256-colour palettes (assets/virtual_racing/palettes.json):
 * a course palette, indices carPaletteStart.. replaced by the car's own colours.
 */
class RacingPalette {
    /**
     * @param {object} palettes - the content of palettes.json
     * @param {string} course   - course code
     * @param {string} car      - car code
     */
    constructor(palettes, course, car) {
        const colors = palettes.courses[course].slice();
        palettes.cars[car].forEach((color, i) => {
            colors[palettes.carPaletteStart + i] = color;
        });
        this._rgb = colors.map((color) => RacingPalette.toRgb(color));
    }

    /**
     * RGB555 word (red bits 0-4, green 5-9, blue 10-14) → [r, g, b] 0..255.
     */
    static toRgb(color) {
        const channel = (shift) => Math.round((((color >> shift) & RacingPalette.CHANNEL_MASK) * 255) / RacingPalette.CHANNEL_MASK);

        return [channel(0), channel(5), channel(10)];
    }

    /**
     * @param {int} index - palette index of a face
     * @returns {int[]} [r, g, b] 0..255
     */
    getRgb(index) {
        return this._rgb[index];
    }
}

RacingPalette.CHANNEL_MASK = 0x1F;

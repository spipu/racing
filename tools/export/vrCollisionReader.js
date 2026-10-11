/**
 * Reads a course's collision layer, used by the 68K for walls, surfaces and heights
 * (track_data_index_calc $0073E8, polygon test $748C, height plane $75C8):
 *
 *   segment map: gridSize x gridSize big-endian words (row-major, z then x); record = base + word x 2
 *   record:      s16 header, negative = no polygon (wall everywhere), else header + 1 polygons of 28 bytes:
 *     +$00 u16    4 edge selectors of 3 bits from bit 15: axis, direct, side
 *     +$02 4 x {s16 v1, s16 v2}
 *     +$12 s16 A, +$14 s16 B, +$16 s16 C   height = (A * lx + B * lz + (C << 5)) >> 6 (>> 5 when flags bit 7)
 *     +$18 u8 surface (low nibble = class), +$19 u8 flags (bit 0 = layer switch), +$1A u8 road direction,
 *     +$1B u8 section
 *   lx, lz = 2 x the position inside the cell (0..1022).
 *
 * Output per polygon: [selector, v1, v2, v1, v2, v1, v2, v1, v2, A, B, C, surface, flags, direction, section].
 */
class VrCollisionReader {
    constructor(rom) {
        this._rom = rom;
    }

    read(segmentMap, base, gridSize) {
        const rom     = this._rom;
        const records = [];
        const byStart = new Map();
        const cells   = [];
        for (let cell = 0; cell < (gridSize * gridSize); cell++) {
            const start = (base + (rom.u16(segmentMap + (cell * 2)) * 2));
            if (!byStart.has(start)) {
                byStart.set(start, records.length);
                records.push(this._readRecord(start));
            }
            cells.push(byStart.get(start));
        }
        return {cells, records};
    }

    _readRecord(start) {
        const rom    = this._rom;
        const header = rom.s16(start);
        if (header < 0) {
            return null;
        }
        if (header >= VrCollisionReader.MAX_POLYGONS) {
            throw new Error('collision record at ' + start.toString(16) + ': ' + (header + 1) + ' polygons');
        }
        const polygons = [];
        for (let i = 0; i <= header; i++) {
            const polygon = start + 2 + (i * VrCollisionReader.POLYGON_SIZE);
            const values  = [rom.u16(polygon)];
            for (let word = 1; word < VrCollisionReader.SIGNED_WORDS; word++) {
                values.push(rom.s16(polygon + (word * 2)));
            }
            for (let byte = VrCollisionReader.BYTES_START; byte < VrCollisionReader.POLYGON_SIZE; byte++) {
                values.push(rom.u8(polygon + byte));
            }
            polygons.push(values);
        }
        return polygons;
    }
}

VrCollisionReader.POLYGON_SIZE = 28;
VrCollisionReader.SIGNED_WORDS = 12;
VrCollisionReader.BYTES_START  = 0x18;
VrCollisionReader.MAX_POLYGONS = 64;

module.exports = {VrCollisionReader};

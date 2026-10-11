/**
 * Reads a 3D model as the SH2 renderer parses it (on-chip copy of ROM $2254C):
 *
 *   u16 vertexCount, u16 aux, vertexCount x {s16, s16, s16}
 *   then polygons until the command word $0C00:
 *     u16 command  (command >> 8) & $0E: 0 = new polygon, 2 / 4 / 6 = reuse vertices of the previous one, $0C = end
 *                  bit $20: a face normal follows, bit $10: backface culling (the SH2 tests the screen winding,
 *                  $22858: drawn when clockwise on screen); without it the face is drawn from both sides
 *     u16 attribute  high byte = palette index, bit 0 = triangle (quad otherwise)
 *     u16 indices    vertex index x 16; 3 (+1 for a quad) for a new polygon, 1 (+1) when reusing
 *     [3 x s16 normal]
 */
class VrModelReader {
    constructor(rom) {
        this._rom = rom;
    }

    read(offset) {
        const rom         = this._rom;
        const vertexCount = rom.u16(offset);
        const vertices    = [];
        let   cursor      = (offset + VrModelReader.HEADER_SIZE);
        for (let i = 0; i < vertexCount; i++) {
            vertices.push([rom.s16(cursor), rom.s16(cursor + 2), rom.s16(cursor + 4)]);
            cursor += VrModelReader.VERTEX_SIZE;
        }

        const faces = [];
        const slots = [0, 0, 0, 0];
        for (;;) {
            if (faces.length > VrModelReader.MAX_FACES) {
                throw new Error('model at ' + offset.toString(16) + ': no end command');
            }
            const command = rom.u16(cursor);
            const mode    = ((command >> 8) & VrModelReader.MODE_MASK);
            cursor += 2;
            if (mode === VrModelReader.MODE_END) {
                break;
            }
            const attribute = rom.u16(cursor);
            const triangle  = ((attribute & VrModelReader.TRIANGLE_BIT) !== 0);
            cursor += 2;

            this._reuseSlots(slots, mode, offset);
            const firstSlot = ((mode === VrModelReader.MODE_NEW) ? 0 : 2);
            const lastSlot  = ((triangle) ? 2 : 3);
            for (let slot = firstSlot; slot <= lastSlot; slot++) {
                slots[slot] = this._readIndex(cursor, vertexCount, offset);
                cursor += 2;
            }
            if (triangle) {
                slots[3] = slots[2];
            }

            const face = {
                indices:     ((triangle) ? slots.slice(0, 3) : slots.slice(0, 4)),
                colorIndex:  (attribute >> 8),
                doubleSided: ((command & VrModelReader.CULL_BIT) === 0),
            };
            if ((command & VrModelReader.NORMAL_BIT) !== 0) {
                face.normal = [rom.s16(cursor), rom.s16(cursor + 2), rom.s16(cursor + 4)];
                cursor += VrModelReader.NORMAL_SIZE;
            }
            faces.push(face);
        }
        return {offset, end: cursor, vertices, faces};
    }

    readSequence(start, end) {
        const models = [];
        let   offset = start;
        while (offset < end) {
            const model = this.read(offset);
            models.push(model);
            offset = model.end;
        }
        if (offset !== end) {
            throw new Error('model sequence ' + start.toString(16) + '-' + end.toString(16) + ' ends at ' + offset.toString(16));
        }
        return models;
    }

    _reuseSlots(slots, mode, offset) {
        const [slot0, slot1, slot2, slot3] = slots;
        switch (mode) {
            case VrModelReader.MODE_NEW:
                return;
            case VrModelReader.MODE_REUSE_3_AS_1:
                slots[1] = slot3;
                return;
            case VrModelReader.MODE_REUSE_3_2:
                slots[0] = slot3;
                slots[1] = slot2;
                return;
            case VrModelReader.MODE_REUSE_2_AS_0:
                slots[0] = slot2;
                return;
            default:
                throw new Error('model at ' + offset.toString(16) + ': unknown polygon mode ' + mode + ' (' + [slot0, slot1].join(',') + ')');
        }
    }

    _readIndex(cursor, vertexCount, offset) {
        const raw = this._rom.u16(cursor);
        if (((raw % VrModelReader.INDEX_STRIDE) !== 0) || ((raw / VrModelReader.INDEX_STRIDE) >= vertexCount)) {
            throw new Error('model at ' + offset.toString(16) + ': bad vertex index ' + raw.toString(16) + ' at ' + cursor.toString(16));
        }
        return (raw / VrModelReader.INDEX_STRIDE);
    }
}

VrModelReader.HEADER_SIZE       = 4;
VrModelReader.VERTEX_SIZE       = 6;
VrModelReader.NORMAL_SIZE       = 6;
VrModelReader.INDEX_STRIDE      = 16;
VrModelReader.MODE_MASK         = 0x0E;
VrModelReader.MODE_NEW          = 0x00;
VrModelReader.MODE_REUSE_3_AS_1 = 0x02;
VrModelReader.MODE_REUSE_3_2    = 0x04;
VrModelReader.MODE_REUSE_2_AS_0 = 0x06;
VrModelReader.MODE_END          = 0x0C;
VrModelReader.TRIANGLE_BIT      = 0x0001;
VrModelReader.NORMAL_BIT        = 0x0020;
VrModelReader.CULL_BIT          = 0x0010;
VrModelReader.MAX_FACES         = 4000;

module.exports = {VrModelReader};

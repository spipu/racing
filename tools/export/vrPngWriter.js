const zlib = require('zlib');

/**
 * Minimal PNG encoder: 8-bit RGBA, no interlacing.
 */
class VrPngWriter {
    encode(width, height, rgba) {
        const row = ((width * VrPngWriter.RGBA) + 1);
        const raw = Buffer.alloc(row * height);
        for (let y = 0; y < height; y++) {
            const rowStart = (y * row);
            raw[rowStart]  = VrPngWriter.FILTER_NONE;
            rgba.copy(raw, (rowStart + 1), (y * width * VrPngWriter.RGBA), ((y + 1) * width * VrPngWriter.RGBA));
        }
        const header = Buffer.alloc(VrPngWriter.IHDR_SIZE);
        header.writeUInt32BE(width, 0);
        header.writeUInt32BE(height, 4);
        header[8]  = VrPngWriter.BIT_DEPTH;
        header[9]  = VrPngWriter.COLOR_TYPE_RGBA;
        header[10] = 0;
        header[11] = 0;
        header[12] = 0;
        return Buffer.concat([
            VrPngWriter.SIGNATURE,
            this._chunk('IHDR', header),
            this._chunk('IDAT', zlib.deflateSync(raw, {level: 9})),
            this._chunk('IEND', Buffer.alloc(0)),
        ]);
    }

    _chunk(type, data) {
        const length = Buffer.alloc(4);
        length.writeUInt32BE(data.length, 0);
        const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
        const crc  = Buffer.alloc(4);
        crc.writeUInt32BE(this._crc32(body), 0);
        return Buffer.concat([length, body, crc]);
    }

    _crc32(data) {
        let crc = 0xFFFFFFFF;
        for (const byte of data) {
            crc ^= byte;
            for (let bit = 0; bit < 8; bit++) {
                crc = (((crc & 1) !== 0) ? ((crc >>> 1) ^ VrPngWriter.CRC_POLYNOMIAL) : (crc >>> 1));
            }
        }
        return ((crc ^ 0xFFFFFFFF) >>> 0);
    }
}

VrPngWriter.SIGNATURE       = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
VrPngWriter.IHDR_SIZE       = 13;
VrPngWriter.BIT_DEPTH       = 8;
VrPngWriter.COLOR_TYPE_RGBA = 6;
VrPngWriter.FILTER_NONE     = 0;
VrPngWriter.RGBA        = 4;
VrPngWriter.CRC_POLYNOMIAL  = 0xEDB88320;

module.exports = {VrPngWriter};

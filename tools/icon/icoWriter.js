/**
 * ICO container holding one PNG image.
 */
class IcoWriter {
    encode(png, size) {
        const header = Buffer.alloc(IcoWriter.HEADER_SIZE);
        header.writeUInt16LE(IcoWriter.RESERVED, 0);
        header.writeUInt16LE(IcoWriter.TYPE_ICON, 2);
        header.writeUInt16LE(IcoWriter.IMAGE_COUNT, 4);
        header[6] = size;
        header[7] = size;
        header[8] = IcoWriter.NO_PALETTE;
        header[9] = IcoWriter.RESERVED;
        header.writeUInt16LE(IcoWriter.COLOR_PLANES, 10);
        header.writeUInt16LE(IcoWriter.BITS_PER_PIXEL, 12);
        header.writeUInt32LE(png.length, 14);
        header.writeUInt32LE(IcoWriter.HEADER_SIZE, 18);

        return Buffer.concat([header, png]);
    }
}

// ICONDIR (6 bytes) then one ICONDIRENTRY (16 bytes), the PNG right after.
IcoWriter.HEADER_SIZE    = 22;
IcoWriter.RESERVED       = 0;
IcoWriter.TYPE_ICON      = 1;
IcoWriter.IMAGE_COUNT    = 1;
IcoWriter.NO_PALETTE     = 0;
IcoWriter.COLOR_PLANES   = 1;
IcoWriter.BITS_PER_PIXEL = 32;

module.exports = {IcoWriter};

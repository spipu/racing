/**
 * Minimal WAV encoder: unsigned 8-bit PCM, interleaved channels.
 */
class VrWavWriter {
    encode(pcm, rate, channels) {
        const header = Buffer.alloc(VrWavWriter.HEADER_SIZE);
        header.write('RIFF', 0, 'ascii');
        header.writeUInt32LE(VrWavWriter.HEADER_SIZE - 8 + pcm.length, 4);
        header.write('WAVE', 8, 'ascii');
        header.write('fmt ', 12, 'ascii');
        header.writeUInt32LE(VrWavWriter.FMT_SIZE, 16);
        header.writeUInt16LE(VrWavWriter.FORMAT_PCM, 20);
        header.writeUInt16LE(channels, 22);
        header.writeUInt32LE(rate, 24);
        header.writeUInt32LE(rate * channels, 28);
        header.writeUInt16LE(channels, 32);
        header.writeUInt16LE(VrWavWriter.BITS, 34);
        header.write('data', 36, 'ascii');
        header.writeUInt32LE(pcm.length, 40);
        return Buffer.concat([header, pcm]);
    }
}

VrWavWriter.HEADER_SIZE = 44;
VrWavWriter.FMT_SIZE    = 16;
VrWavWriter.FORMAT_PCM  = 1;
VrWavWriter.BITS        = 8;

module.exports = {VrWavWriter};

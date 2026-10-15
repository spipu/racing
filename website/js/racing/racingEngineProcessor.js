/**
 * The engine note of the original computed as the YM2612 computes it, in the
 * audio thread (AudioWorklet; loaded by RacingSound, not by the bootstrap). One FM channel per layer (the engine, its tunnel copy), its
 * note held with no envelope (attack 31, no decay): each operator is a phase
 * counter stepped at the chip's rate, read through the chip's log-sine and
 * exponent tables at its total level, modulated by the operators its
 * algorithm wires to it (half their output), the first by its own last two
 * outputs (feedback). Algorithms 0 (S1 > S2 > S3 > S4) and 3 ((S1 > S2) +
 * S3 > S4) only, the engine voices'. The channel outputs its carrier on 9
 * bits; the chip's samples are interpolated to the context's rate.
 *
 * Messages: {words: [main, tunnel]} the frequency words written to the chip
 * (block << 11 | fnum), {tunnel: boolean} the copy keyed on or off.
 */
class RacingEngineProcessor extends AudioWorkletProcessor {
    /**
     * @param {{processorOptions: {voice: object, volumes: number[]}}} options - voice: {algorithm, feedback,
     *   operators: [{mul, dt, tl}] in the order S1..S4}; volumes: the track volume of each layer, added to the carrier's
     *   total level
     */
    constructor(options) {
        super();
        const {voice, volumes} = options.processorOptions;
        if (!RacingEngineProcessor.ALGORITHMS.includes(voice.algorithm)) {
            throw new Error('RacingEngineProcessor - algorithm ' + voice.algorithm + ' not handled');
        }
        this._voice    = voice;
        this._channels = volumes.map((volume) => this._channel(volume));
        this._tunnel   = false;
        this._step     = (RacingEngineProcessor.CHIP_RATE / sampleRate);
        this._clock    = 0;
        this._previous = 0;
        this._current  = 0;
        this.port.onmessage = (event) => this._receive(event.data);
    }

    _channel(volume) {
        return {
            phases:     [0, 0, 0, 0],
            increments: [0, 0, 0, 0],
            // Attenuation of each operator in the log domain.
            levels:     this._voice.operators.map((operator, i) => ((operator.tl + ((i === RacingEngineProcessor.CARRIER) ? volume : 0)) << RacingEngineProcessor.LEVEL_SHIFT)),
            feedback:   [0, 0],
            last2:      0,
            on:         false,
        };
    }

    _receive(data) {
        if (data.words !== undefined) {
            data.words.forEach((word, i) => this._tune(this._channels[i], word));
        }
        if (data.tunnel !== undefined) {
            this._tunnel = data.tunnel;
        }
    }

    // Phase increment of each operator for a frequency word: (fnum << block) / 2, detuned by the key code, times the
    // multiple (a half for 0).
    _tune(channel, word) {
        const block = ((word >> 11) & 7);
        const fnum  = (word & 0x7FF);
        const code  = Math.min(((block << 2) | RacingEngineProcessor.FN_NOTE[fnum >> 7]), RacingEngineProcessor.KCODE_MAX);
        this._voice.operators.forEach((operator, i) => {
            let base = (((fnum << 1) << block) >> 2);
            const dt = (operator.dt & 3);
            if (dt !== 0) {
                const sum    = ((code >> 2) + 9 + (((dt === 3) || ((dt & 2) !== 0)) ? 1 : 0));
                const detune = (RacingEngineProcessor.DETUNE[((sum & 1) << 2) | (code & 3)] >> (9 - (sum >> 1)));
                base += (((operator.dt & 4) !== 0) ? -detune : detune);
            }
            base &= 0x1FFFF;
            const multiple = ((operator.mul === 0) ? 1 : (operator.mul << 1));
            channel.increments[i] = (((base * multiple) >> 1) & RacingEngineProcessor.PHASE_MASK);
        });
        channel.on = true;
    }

    // One operator: its phase plus the modulation, through the log-sine and exponent tables, signed on 14 bits.
    _operator(channel, i, modulation) {
        const phase   = ((modulation + (channel.phases[i] >> 10)) & 0x3FF);
        const quarter = (((phase & 0x100) !== 0) ? ((phase ^ 0xFF) & 0xFF) : (phase & 0xFF));
        const level   = Math.min((RacingEngineProcessor.LOG_SINE[quarter] + channel.levels[i]), RacingEngineProcessor.LEVEL_MAX);
        const value   = (((RacingEngineProcessor.EXPONENT[(level & 0xFF) ^ 0xFF] | 0x400) << 2) >> (level >> 8));

        return (((phase & 0x200) !== 0) ? -value : value);
    }

    // One chip sample of a channel, operators in the chip's order S1, S3, S2, S4; the carrier on 9 bits.
    _sample(channel) {
        for (let i = 0; i < RacingEngineProcessor.OPERATORS; i++) {
            channel.phases[i] = ((channel.phases[i] + channel.increments[i]) & RacingEngineProcessor.PHASE_MASK);
        }
        const feedback = this._voice.feedback;
        const s1 = this._operator(channel, 0, ((feedback === 0) ? 0 : ((channel.feedback[0] + channel.feedback[1]) >> (10 - feedback))));
        channel.feedback[1] = channel.feedback[0];
        channel.feedback[0] = s1;
        let s4;
        if (this._voice.algorithm === 0) {
            const s3 = this._operator(channel, 2, (channel.last2 >> 1));
            const s2 = this._operator(channel, 1, (s1 >> 1));
            s4 = this._operator(channel, RacingEngineProcessor.CARRIER, (s3 >> 1));
            channel.last2 = s2;
        } else {
            const s3 = this._operator(channel, 2, 0);
            const s2 = this._operator(channel, 1, (s1 >> 1));
            s4 = this._operator(channel, RacingEngineProcessor.CARRIER, ((s2 + s3) >> 1));
            channel.last2 = s2;
        }

        return Math.max(RacingEngineProcessor.OUT_MIN, Math.min(RacingEngineProcessor.OUT_MAX, (s4 >> RacingEngineProcessor.OUT_SHIFT)));
    }

    process(inputs, outputs) {
        const out = outputs[0][0];
        const [main, tunnel] = this._channels;
        for (let k = 0; k < out.length; k++) {
            this._clock += this._step;
            while (this._clock >= 1) {
                this._clock   -= 1;
                this._previous = this._current;
                this._current  = ((main.on ? this._sample(main) : 0) + ((this._tunnel && tunnel.on) ? this._sample(tunnel) : 0));
            }
            out[k] = ((this._previous + ((this._current - this._previous) * this._clock)) / RacingEngineProcessor.FULL_SCALE);
        }
        for (let channel = 1; channel < outputs[0].length; channel++) {
            outputs[0][channel].set(out);
        }

        return true;
    }
}

// NTSC clock / 144: one sample of every channel.
RacingEngineProcessor.CHIP_RATE  = (7670453 / 144);
RacingEngineProcessor.ALGORITHMS = [0, 3];
RacingEngineProcessor.OPERATORS  = 4;
RacingEngineProcessor.CARRIER    = 3;
// Phase counters on 20 bits, read on their top 10.
RacingEngineProcessor.PHASE_MASK = 0xFFFFF;
// A total level step is 8 envelope steps, an envelope step 4 log-sine steps (0.75 dB).
RacingEngineProcessor.LEVEL_SHIFT = 5;
RacingEngineProcessor.LEVEL_MAX  = 0x1FFF;
// The channel takes the 14-bit carrier on 9 bits.
RacingEngineProcessor.OUT_SHIFT  = 5;
RacingEngineProcessor.KCODE_MAX  = 0x1C;
RacingEngineProcessor.OUT_MIN    = -256;
RacingEngineProcessor.OUT_MAX    = 255;
RacingEngineProcessor.FULL_SCALE = 256;
// Key code low bits of a block from the top bits of fnum, and the detune steps (chip constants).
RacingEngineProcessor.FN_NOTE  = [0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 3, 3, 3, 3, 3, 3];
RacingEngineProcessor.DETUNE   = [16, 17, 19, 20, 22, 24, 27, 29];
// The chip's quarter sine as -log2 x 256, and 2^x on 10 bits: computed, equal to its ROMs.
RacingEngineProcessor.LOG_SINE = Array.from({length: 256}, (unused, i) => Math.round(-Math.log2(Math.sin(((i + 0.5) * Math.PI) / 512)) * 256));
RacingEngineProcessor.EXPONENT = Array.from({length: 256}, (unused, i) => Math.round((Math.pow(2, (i / 256)) - 1) * 1024));

registerProcessor('racing-engine', RacingEngineProcessor);

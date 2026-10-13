/**
 * The engine note of the original, an FM voice held on the YM2612 (commands
 * $A2 Formula, $A0 Stock, $A1 Prototype), rebuilt with Web Audio oscillators:
 * every 60 Hz frame $232E turns the raw rpm (+$74) into a frequency word
 * T = sum of rpm shifts + $1A5E (by car), smoothed V = (T + V) >> 1, floored at
 * the idle word, capped by car, and trembling by 0-15 when steady; the pitch
 * is (V - detune) x 0.2032 Hz (block 3). The level is constant. In a tunnel
 * (road flag bit 4) a second copy of the voice plays a little lower.
 *
 * Voices (order S1..S4, multiples of the base pitch, modulation indices from
 * the total levels, the strong feedback of S1 as a sawtooth):
 *   - Formula: algorithm 3, (S1 x4 -> S2 x3) + S3 x1 -> carrier x1;
 *   - Stock / Prototype: algorithm 0, S1 -> S2 -> S3 -> carrier x2.
 */
class RacingEngineSound {
    /**
     * @param {SoundEngine} engine
     * @param {string}      car - car code
     */
    constructor(engine, car) {
        this._context = engine.getContext();
        this._law     = RacingEngineSound.LAWS[car];
        this._voice   = RacingEngineSound.VOICES[car];
        this._word    = RacingEngineSound.IDLE;
        this._frames  = 0;
        this._random  = RacingEngineSound.RANDOM_SEED;
        this._output  = this._context.createGain();
        this._output.gain.value = RacingEngineSound.LEVEL;
        this._output.connect(engine.getEffectsBus());
        this._main    = this._build(0);
        this._tunnel  = this._build(this._law.tunnelDetune);
        this._tunnel.output.gain.value = 0;
        this._running = true;
        this._apply();
    }

    /**
     * @param {number}  ticks  - time elapsed, in original ticks (3 frames each)
     * @param {number}  rpm    - +$74
     * @param {boolean} tunnel - road flag bit 4 under the car
     */
    update(ticks, rpm, tunnel) {
        if (!this._running) {
            return this;
        }
        this._frames += (ticks * RacingEngineSound.FRAMES_PER_TICK);
        let changed = false;
        while (this._frames >= 1) {
            this._frames -= 1;
            this._step(rpm);
            changed = true;
        }
        if (changed) {
            this._apply();
        }
        const level = (tunnel ? RacingEngineSound.TUNNEL_LEVEL : 0);
        this._tunnel.output.gain.setTargetAtTime(level, this._context.currentTime, RacingEngineSound.GLIDE_S);

        return this;
    }

    /**
     * Pause, finish ($F3): silent; resumed by setRunning(true).
     */
    setRunning(running) {
        this._running = running;
        this._output.gain.setTargetAtTime((running ? RacingEngineSound.LEVEL : 0), this._context.currentTime, RacingEngineSound.GLIDE_S);

        return this;
    }

    destroy() {
        for (const voice of [this._main, this._tunnel]) {
            for (const oscillator of voice.oscillators) {
                oscillator.stop();
                oscillator.disconnect();
            }
        }
        this._output.disconnect();
    }

    // $232E, one frame.
    _step(rpm) {
        const law  = this._law;
        const r    = Math.max(0, Math.trunc(rpm));
        const goal = Math.min((law.shifts.reduce((sum, shift) => (sum + (r >> shift)), 0) + RacingEngineSound.IDLE), law.max);
        let word   = ((goal + this._word) >>> 1);
        if (word > law.max) {
            word = law.max;
        }
        if (word <= RacingEngineSound.IDLE) {
            word = RacingEngineSound.IDLE;
        } else if (word === this._word) {
            word -= (this._nextRandom() & RacingEngineSound.TREMBLE_MASK);
        }
        this._word = word;
    }

    // $496E-like generator: the steady pitch trembles.
    _nextRandom() {
        this._random = (((this._random * RacingEngineSound.RANDOM_FACTOR) + RacingEngineSound.RANDOM_STEP) & 0xFFFF);

        return (this._random >> 8);
    }

    _apply() {
        const base = (Math.max(0, (this._word - this._law.detune)) * RacingEngineSound.HZ_PER_FNUM);
        const now  = this._context.currentTime;
        for (const voice of [this._main, this._tunnel]) {
            const pitch = Math.max(0, (base + voice.offset));
            voice.operators.forEach((operator) => {
                operator.oscillator.frequency.setTargetAtTime((pitch * operator.mul), now, RacingEngineSound.GLIDE_S);
                if (operator.depth !== null) {
                    // A phase modulation of index i is a frequency deviation of i times the modulator's frequency.
                    operator.depth.gain.setTargetAtTime((pitch * operator.mul * operator.index), now, RacingEngineSound.GLIDE_S);
                }
            });
        }
    }

    // The operators of the voice, wired by its algorithm; offset in Hz below the main voice.
    _build(offset) {
        const context   = this._context;
        const output    = context.createGain();
        const operators = this._voice.operators.map((spec) => {
            const oscillator = context.createOscillator();
            oscillator.type = (spec.wave ?? 'sine');
            const depth = ((spec.to === null) ? null : context.createGain());

            return {oscillator, depth, mul: spec.mul, index: spec.index, to: spec.to};
        });
        for (const operator of operators) {
            if (operator.to === null) {
                operator.oscillator.connect(output);
            } else {
                operator.oscillator.connect(operator.depth);
                operator.depth.connect(operators[operator.to].oscillator.frequency);
            }
            operator.oscillator.start();
        }
        output.gain.value = 1;
        output.connect(this._output);

        return {output, operators, offset: (offset * RacingEngineSound.HZ_PER_FNUM), oscillators: operators.map((operator) => operator.oscillator)};
    }
}

RacingEngineSound.IDLE            = 0x1A5E;
RacingEngineSound.HZ_PER_FNUM     = 0.2032;
RacingEngineSound.FRAMES_PER_TICK = 3;
RacingEngineSound.TREMBLE_MASK    = 15;
RacingEngineSound.RANDOM_SEED     = 0x1234;
RacingEngineSound.RANDOM_FACTOR   = 41;
RacingEngineSound.RANDOM_STEP     = 0x3619;
// The engine about a quarter of the DAC effects (-12 dB), the tunnel copy at volume 14 against 15-16.
RacingEngineSound.LEVEL           = 0.2;
RacingEngineSound.TUNNEL_LEVEL    = 1.1;
RacingEngineSound.GLIDE_S         = 0.008;
// Rpm shifts of the frequency word, its cap, the detune of the voice (fnum = V - detune), the tunnel copy's.
RacingEngineSound.LAWS = {
    formula:   {shifts: [4, 5, 6, 8], max: 0x21D0, detune: 0x1A00, tunnelDetune: -32},
    stock:     {shifts: [5, 7, 8],    max: 0x1E00, detune: 0x19E8, tunnelDetune: -16},
    prototype: {shifts: [4, 5, 6],    max: 0x21A0, detune: 0x19B0, tunnelDetune: -32},
};
// Operators: multiple of the base pitch, modulation index (8 pi x 10^(-0.75 TL / 20)), target operator (null: carrier).
RacingEngineSound.VOICES = {
    formula: {operators: [
        {mul: 4,   index: 4.5, to: 1, wave: 'sawtooth'},
        {mul: 3,   index: 1.7, to: 3},
        {mul: 1,   index: 1.7, to: 3},
        {mul: 1,   index: 0,   to: null},
    ]},
    stock: {operators: [
        {mul: 1,   index: 4.9, to: 1, wave: 'sawtooth'},
        {mul: 0.5, index: 6.3, to: 2},
        {mul: 0.5, index: 3.4, to: 3},
        {mul: 2,   index: 0,   to: null},
    ]},
    prototype: {operators: [
        {mul: 4,   index: 3.9, to: 1, wave: 'sawtooth'},
        {mul: 5,   index: 2.8, to: 2},
        {mul: 0.5, index: 3.4, to: 3},
        {mul: 2,   index: 0,   to: null},
    ]},
};

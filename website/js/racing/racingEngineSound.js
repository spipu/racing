/**
 * The engine note of the original, an FM voice held on the YM2612 (commands
 * $A2 Formula, $A0 Stock, $A1 Prototype, table $4CB8), computed as the chip
 * does by RacingEngineProcessor (AudioWorklet) from its voice in sounds.json:
 * every 60 Hz frame $232E turns the raw rpm (+$74) into a frequency word
 * T = sum of rpm shifts + $1A5E (by car), smoothed V = (T + V) >> 1, floored at
 * the idle word, capped by car, and trembling by 0-15 when steady; the chip
 * plays (V + the voice's detune) & $3FFF. The level is constant (lowered under
 * the results, which play over the race). In a tunnel (road flag bit 4) a
 * second channel plays the copy of the voice a little lower ($AF / $AD / $AE,
 * table $232A). Another player's car (positional) sounds the same, lowered and placed left or right by where it is
 * (setPlacement, user decision: one voice for every car, the echo in a tunnel too).
 */
class RacingEngineSound {
    /**
     * @param {SoundEngine} engine
     * @param {string}      car        - car code
     * @param {boolean}     positional - another player's car, placed by setPlacement
     */
    constructor(engine, car, positional = false) {
        const commands = RacingEngineSound.COMMANDS[car];
        const main     = racingSound.fmVoice(commands.main);
        const tunnel   = racingSound.fmVoice(commands.tunnel);
        this._context = engine.getContext();
        this._law     = RacingEngineSound.LAWS[car];
        this._detunes = [main.detune, tunnel.detune];
        this._word    = RacingEngineSound.IDLE;
        this._frames  = 0;
        this._random  = RacingEngineSound.RANDOM_SEED;
        this._share   = 1;
        this._place   = ((positional) ? 0 : 1);   // share of the level by the car's distance
        this._pan     = 0;
        this._tunnel  = false;
        this._output  = this._context.createGain();
        this._output.gain.value = (RacingEngineSound.LEVEL * this._place);
        this._panner  = ((positional) ? this._context.createStereoPanner() : null);
        if (this._panner !== null) {
            this._output.connect(this._panner);
            this._panner.connect(engine.getEffectsBus());
        } else {
            this._output.connect(engine.getEffectsBus());
        }
        // The tunnel copy has the engine's voice (same bytes in the ROM), at its own track volume.
        this._voice = new AudioWorkletNode(this._context, RacingEngineSound.PROCESSOR, {
            numberOfInputs:     0,
            numberOfOutputs:    1,
            outputChannelCount: [1],
            processorOptions:   {voice: main.voice, volumes: [this._law.volume, RacingEngineSound.TUNNEL_VOLUME]},
        });
        this._voice.connect(this._output);
        this._running = true;
        this._send();
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
            this._send();
        }
        if (tunnel !== this._tunnel) {
            this._tunnel = tunnel;
            this._voice.port.postMessage({tunnel: tunnel});
        }

        return this;
    }

    /**
     * Pause, finish ($F3): silent; resumed by setRunning(true).
     */
    setRunning(running) {
        this._running = running;
        this._applyLevel();

        return this;
    }

    /**
     * @param {number} share - share of the engine's level, 1 in the race
     */
    setLevelShare(share) {
        this._share = share;
        this._applyLevel();

        return this;
    }

    /**
     * Where another player's car is heard from.
     *
     * @param {number} gain - share of the level, 0 silent to 1 close by
     * @param {number} pan  - -1 left to 1 right
     */
    setPlacement(gain, pan) {
        // Set only on a change: an automation event a frame would pile up.
        if (Math.abs(gain - this._place) >= RacingEngineSound.PLACEMENT_STEP) {
            this._place = gain;
            this._applyLevel();
        }
        const side = Math.max(-1, Math.min(1, pan));
        if ((this._panner !== null) && (Math.abs(side - this._pan) >= RacingEngineSound.PLACEMENT_STEP)) {
            this._pan = side;
            this._panner.pan.setTargetAtTime(side, this._context.currentTime, RacingEngineSound.GLIDE_S);
        }

        return this;
    }

    _applyLevel() {
        const level = ((this._running) ? (RacingEngineSound.LEVEL * this._share * this._place) : 0);
        this._output.gain.setTargetAtTime(level, this._context.currentTime, RacingEngineSound.GLIDE_S);
    }

    destroy() {
        this._voice.port.close();
        this._voice.disconnect();
        this._output.disconnect();
        if (this._panner !== null) {
            this._panner.disconnect();
        }
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

    // The words the driver writes to the chip ($3029E): frequency plus detune, on 14 bits.
    _send() {
        this._voice.port.postMessage({words: this._detunes.map((detune) => ((this._word + detune) & RacingEngineSound.WORD_MASK))});
    }
}

RacingEngineSound.PROCESSOR       = 'racing-engine';
RacingEngineSound.IDLE            = 0x1A5E;
RacingEngineSound.WORD_MASK       = 0x3FFF;
RacingEngineSound.FRAMES_PER_TICK = 3;
RacingEngineSound.TREMBLE_MASK    = 15;
RacingEngineSound.RANDOM_SEED     = 0x1234;
RacingEngineSound.RANDOM_FACTOR   = 41;
RacingEngineSound.RANDOM_STEP     = 0x3619;
// The level validated by ear (user, 2026-10-13) with the carrier at full scale, 0.09: the chip plays it 11.25 dB lower
// (track volume 15 added to its total level, 0.75 dB a step).
RacingEngineSound.LEVEL           = (0.09 * Math.pow(10, ((0.75 * 15) / 20)));
RacingEngineSound.TUNNEL_VOLUME   = 14;
RacingEngineSound.GLIDE_S         = 0.008;
// The change of an other car's level or side that is applied: a frame's drift under it is not heard.
RacingEngineSound.PLACEMENT_STEP  = 0.005;
// Sound commands of the engine and of its tunnel copy by car ($4CB8, $232A).
RacingEngineSound.COMMANDS = {
    formula:   {main: 'A2', tunnel: 'AF'},
    stock:     {main: 'A0', tunnel: 'AD'},
    prototype: {main: 'A1', tunnel: 'AE'},
};
// Rpm shifts of the frequency word, its cap, the track volume ($2372 through $8789).
RacingEngineSound.LAWS = {
    formula:   {shifts: [4, 5, 6, 8], max: 0x21D0, volume: 15},
    stock:     {shifts: [5, 7, 8],    max: 0x1E00, volume: 16},
    prototype: {shifts: [4, 5, 6],    max: 0x21A0, volume: 16},
};

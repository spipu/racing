/**
 * Sound effects of the race as the driver of the original plays them
 * (sounds.json, sounds/dac_XX.wav, unsigned 8-bit PCM): a command id (B1
 * skid, C0 voice "3"...) is accepted when its priority is at least the one
 * held, which lasts as long as the effect track of the last accepted command
 * (its frames at 60 Hz); the DAC has one voice, a new sample cuts the one
 * playing. The FM effects are not samples: the two start beeps are
 * synthesised, the jingles left out; the engine is RacingEngineSound.
 *
 * Global `racingSound`: the engine and its AudioContext are born once for the
 * page, the samples are loaded on the first race and kept.
 */
class RacingSound {
    constructor() {
        this._engine   = null;
        this._samples  = null;
        this._player   = null;
        this._effects  = {};      // command id → {timeline: [{ms, id}], ms, priority}
        this._loading  = null;
        this._priority = 0;
        this._heldTo   = 0;       // ms (performance clock) the priority holds to
        this._dac      = null;
        this._timers   = [];
    }

    // Idempotent: the engine is born once, the volume read again every time.
    boot() {
        if (this._engine === null) {
            this._engine  = new SoundEngine().installUnlockListeners();
            this._samples = new SoundSampleLoader(this._engine);
            this._player  = new SoundEffectPlayer(this._engine);
        }

        return this.applyVolume();
    }

    applyVolume() {
        if (this._engine !== null) {
            this._engine.setEffectsVolume(racingSettings.getEffectsVolume());
        }

        return this;
    }

    getEngine() {
        return this._engine;
    }

    /**
     * Loads the samples once; a failure leaves the race silent.
     *
     * @returns {Promise<void>}
     */
    loadAsync() {
        if (this._loading === null) {
            this._loading = this._load().catch((error) => {
                console.warn('RacingSound - sounds unavailable: ' + error.message);
            });
        }

        return this._loading;
    }

    /**
     * @param {string} command - sound command id of the original, in hexadecimal ('B1')
     */
    send(command) {
        const effect = this._effects[command];
        if ((this._player === null) || (effect === undefined)) {
            return this;
        }
        const now = performance.now();
        if (now >= this._heldTo) {
            this._priority = 0;
        }
        if (effect.priority < this._priority) {
            return this;
        }
        this._priority = effect.priority;
        this._heldTo   = (now + effect.ms);
        this._cancelTimers();
        if (effect.timeline.length === 0) {
            return this;
        }
        for (const entry of effect.timeline) {
            const play = () => ((entry.fm) ? this._player.play(this._samples.get(entry.id), {key: command, gain: RacingSound.FM_GAIN}) : this._playDac(entry.id));
            if (entry.ms === 0) {
                play();
            } else {
                this._timers.push(setTimeout(play, entry.ms));
            }
        }

        return this;
    }

    setPaused(paused) {
        if (this._player !== null) {
            this._player.setPaused(paused);
        }

        return this;
    }

    // Leaving a race: every voice stops.
    stopAll() {
        this._cancelTimers();
        if (this._player !== null) {
            this._player.stopAll(false);
        }
        this._dac      = null;
        this._priority = 0;
        this._heldTo   = 0;

        return this;
    }

    _playDac(id) {
        if (this._dac !== null) {
            this._dac.stop();
        }
        this._dac = this._player.play(this._samples.get(id), {key: 'dac', gain: RacingSound.DAC_GAIN});
    }

    _cancelTimers() {
        for (const timer of this._timers) {
            clearTimeout(timer);
        }
        this._timers.length = 0;
    }

    async _load() {
        const base   = RacingSound.ASSETS;
        const sounds = await appBootstrap.fetchJsonAsync(base + 'sounds.json');
        const files  = new Map();
        const sample = (number) => {
            const entry = sounds.samples[number];
            if (!files.has(entry.file)) {
                files.set(entry.file, this._loadWav(base + 'sounds/' + entry.file, entry.rate));
            }

            return files.get(entry.file);
        };
        for (const [command, effect] of Object.entries(sounds.effects)) {
            const synth   = RacingSound.SYNTH[command];
            const ids     = await Promise.all(effect.timeline.map((entry) => sample(entry.sample)));
            const entries = effect.timeline.map((entry, i) => ({ms: (entry.frame * RacingSound.FRAME_MS), id: ids[i]}));
            if (synth !== undefined) {
                // An FM voice of its own: it does not cut the DAC.
                entries.push({ms: 0, id: this._samples.loadFromData('synth/' + command, SoundSynth.tone(synth)), fm: true});
            }
            this._effects[command] = {timeline: entries, ms: (effect.frames * RacingSound.FRAME_MS), priority: effect.priority};
        }
    }

    async _loadWav(url, rate) {
        const response = await fetch(appBootstrap.buildUrl(url));
        if (!response.ok) {
            throw new Error('HTTP ' + response.status + ' on ' + url);
        }
        const bytes   = new Uint8Array(await response.arrayBuffer());
        const pcm     = bytes.subarray(RacingSound.WAV_HEADER_SIZE);
        const samples = new Float32Array(pcm.length);
        for (let i = 0; i < pcm.length; i++) {
            samples[i] = ((pcm[i] - RacingSound.PCM_ZERO) / RacingSound.PCM_ZERO);
        }

        return this._samples.loadFromData(url, {rate: rate, samples: samples});
    }
}

RacingSound.ASSETS          = '/assets/virtual_racing/';
RacingSound.WAV_HEADER_SIZE = 44;
RacingSound.PCM_ZERO        = 128;
RacingSound.FRAME_MS        = (1000 / 60);
RacingSound.DAC_GAIN        = 0.8;
RacingSound.FM_GAIN         = 0.6;
// The FM start beeps ($A6 / $A7): a metallic voice (algorithm 3, carrier x 7) on C4 for 32 frames, C5 for 56 frames.
RacingSound.BEEP_PARTIALS   = [{ratio: 7, gain: 1}, {ratio: 2, gain: 0.45}, {ratio: 12, gain: 0.35, decayMul: 0.6}, {ratio: 1, gain: 0.3}];
RacingSound.SYNTH           = {
    A6: {frequency: 261.7, durationMs: 533, decayMs: 260, gain: 0.55, attackMs: 1, harmonics: RacingSound.BEEP_PARTIALS},
    A7: {frequency: 523.4, durationMs: 933, decayMs: 420, gain: 0.55, attackMs: 1, harmonics: RacingSound.BEEP_PARTIALS},
};

const racingSound = new RacingSound();

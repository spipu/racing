/**
 * Sound effects of the race as the driver of the original plays them
 * (sounds.json, sounds/dac_XX.wav, unsigned 8-bit PCM): a command id (B1
 * skid, C0 voice "3"...) is accepted when its priority is at least the one
 * held, which lasts as long as the effect track of the last accepted command
 * (its frames at 60 Hz); the DAC has one voice, a new sample cuts the one
 * playing. The FM sounds are not samples: the jingles and the start beeps
 * were recorded from the emulated game (jingles.json, jingles/XX.mp3); a music
 * command ($81-$9E) replaces the music playing. The engine is
 * RacingEngineSound, an FM voice of sounds.json computed by an AudioWorklet
 * (RacingEngineProcessor) loaded here.
 *
 * Global `racingSound`: the engine and its AudioContext are born once for the
 * page, the samples are loaded on the first race and kept.
 */
class RacingSound {
    constructor() {
        this._engine   = null;
        this._samples  = null;
        this._player   = null;
        this._musicPlayer = null;
        this._effects  = {};      // command id → {timeline: [{ms, id, fm}], ms, priority}
        this._jingles  = {};      // music command id → {id, loop}
        this._voices   = {};      // FM command id → {voice, detune} (sounds.json)
        this._worklet  = false;   // the engine's AudioWorklet is loaded
        this._music    = null;
        this._loading  = null;
        this.laps      = [];      // music command of the lap done, by laps done ($8989EE)
        this._priority = 0;
        this._heldTo   = 0;       // ms (performance clock) the priority holds to
        this._dacs     = new Map(); // DAC channel by key: the main one, a crew voice's
        this._timers   = [];
        this._sources  = new Map(); // another player's car → {priority, heldTo, timers}: its own queue
    }

    // Idempotent: the engine is born once, the volume read again every time.
    boot() {
        if (this._engine === null) {
            this._engine  = new SoundEngine().installUnlockListeners();
            this._samples = new SoundSampleLoader(this._engine);
            this._player  = new SoundEffectPlayer(this._engine);
            this._musicPlayer = new SoundEffectPlayer(this._engine, this._engine.getMusicBus());
        }

        return this.applyVolume();
    }

    applyVolume() {
        if (this._engine !== null) {
            this._engine.setEffectsVolume(racingSettings.getEffectsVolume());
            this._engine.setMusicVolume(racingSettings.getMusicVolume());
        }

        return this;
    }

    getEngine() {
        return this._engine;
    }

    /**
     * @returns {boolean} the engine note can play (its AudioWorklet loaded)
     */
    hasEngineVoice() {
        return this._worklet;
    }

    /**
     * @param {string} command - FM sound command id of the original ('A2')
     * @returns {{voice: object, detune: number|null}|null}
     */
    fmVoice(command) {
        return (this._voices[command] ?? null);
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
     * A command goes through the original's queue (priority held for its frames). A voice plays its samples on its
     * own DAC channel, beside the main one (the original has one, for one crew animation): each mechanic's wheel gun
     * cuts only its own last burst; a sample of the main channel cuts every channel, as the original's one DAC.
     *
     * @param {string}      command - sound command id of the original, in hexadecimal ('B1')
     * @param {string|null} voice   - a channel of its own ('crew0'), null: the main one
     */
    send(command, voice = null) {
        if (this._player === null) {
            return this;
        }
        const jingle = this._jingles[command];
        if (jingle !== undefined) {
            return this._playMusic(jingle);
        }
        const effect = this._effects[command];
        if (effect === undefined) {
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
            const play = () => ((entry.fm) ? this._player.play(this._samples.get(entry.id), {key: command, gain: RacingSound.FM_GAIN}) : this._playDac(entry.id, voice));
            if (entry.ms === 0) {
                play();
            } else {
                this._timers.push(setTimeout(play, entry.ms));
            }
        }

        return this;
    }

    /**
     * A sound of another player's car (user decision: heard, lowered and placed by where it is), through a queue of
     * its own, as if each car had the driver of the original; its samples cut only its own. Its music is not heard.
     *
     * @param {int}    source  - the player id
     * @param {string} command - sound command id of the original
     * @param {number} gain    - share of the level, 0 to 1
     * @param {number} pan     - -1 left to 1 right
     */
    sendFrom(source, command, gain, pan) {
        const effect = this._effects[command];
        if ((this._player === null) || (effect === undefined) || (this._jingles[command] !== undefined) || (gain <= 0)) {
            return this;
        }
        const queue = (this._sources.get(source) ?? {priority: 0, heldTo: 0, timers: []});
        this._sources.set(source, queue);
        const now = performance.now();
        if (now >= queue.heldTo) {
            queue.priority = 0;
        }
        if (effect.priority < queue.priority) {
            return this;
        }
        queue.priority = effect.priority;
        queue.heldTo   = (now + effect.ms);
        queue.timers.forEach((timer) => clearTimeout(timer));
        queue.timers.length = 0;
        for (const entry of effect.timeline) {
            const options = {
                key:        command,
                gain:       (gain * ((entry.fm) ? RacingSound.FM_GAIN : RacingSound.DAC_GAIN)),
                pan:        pan,
                replaceKey: ((entry.fm) ? null : (RacingSound.CAR_DAC_KEY + source))
            };
            const play = () => this._player.play(this._samples.get(entry.id), options);
            if (entry.ms === 0) {
                play();
            } else {
                queue.timers.push(setTimeout(play, entry.ms));
            }
        }

        return this;
    }

    setPaused(paused) {
        if (this._player !== null) {
            this._player.setPaused(paused);
            this._musicPlayer.setPaused(paused);
        }

        return this;
    }

    // $F3, leaving a race: every voice stops.
    stopAll() {
        this._cancelTimers();
        for (const queue of this._sources.values()) {
            queue.timers.forEach((timer) => clearTimeout(timer));
        }
        this._sources.clear();
        if (this._player !== null) {
            this._player.stopAll(false);
            this._musicPlayer.stopAll(false);
        }
        this._dacs.clear();
        this._music    = null;
        this._priority = 0;
        this._heldTo   = 0;

        return this;
    }

    // A music replaces the one playing, on the music volume; the results loop.
    _playMusic(jingle) {
        if (this._music !== null) {
            this._music.stop();
        }
        this._music = this._musicPlayer.play(this._samples.get(jingle.id), {key: 'music', gain: RacingSound.MUSIC_GAIN, loop: jingle.loop});

        return this;
    }

    _playDac(id, voice) {
        const key = ((voice === null) ? RacingSound.DAC_KEY : (RacingSound.DAC_KEY + ':' + voice));
        for (const [playing, channel] of this._dacs) {
            if ((voice === null) || (playing === key)) {
                channel.stop();
                this._dacs.delete(playing);
            }
        }
        const channel = this._player.play(this._samples.get(id), {key: key, gain: RacingSound.DAC_GAIN});
        // None when the sound engine cannot play yet (locked, sample missing).
        if (channel !== null) {
            this._dacs.set(key, channel);
        }
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
            if (effect.voice !== null) {
                this._voices[command] = {voice: effect.voice, detune: effect.detune};
            }
        }
        await this._loadEngineVoice();
        const recorded = await this._loadJingles(base);
        for (const [command, effect] of Object.entries(sounds.effects)) {
            const ids     = await Promise.all(effect.timeline.map((entry) => sample(entry.sample)));
            const entries = effect.timeline.map((entry, i) => ({ms: (entry.frame * RacingSound.FRAME_MS), id: ids[i], fm: false}));
            if (recorded.has(command)) {
                // An FM voice of its own (the start beeps): it does not cut the DAC.
                entries.push({ms: 0, id: recorded.get(command).id, fm: true});
                recorded.delete(command);
            }
            this._effects[command] = {timeline: entries, ms: (effect.frames * RacingSound.FRAME_MS), priority: effect.priority};
        }
        for (const [command, jingle] of recorded) {
            this._jingles[command] = jingle;
        }
    }

    // A browser without AudioWorklet keeps the race, without its engine note.
    async _loadEngineVoice() {
        try {
            await this._engine.getContext().audioWorklet.addModule(appBootstrap.buildUrl(RacingSound.ENGINE_PROCESSOR));
            this._worklet = true;
        } catch (error) {
            console.warn('RacingSound - engine note unavailable: ' + error.message);
        }
    }

    // The recorded FM sounds, decoded once: command id → {id, loop}.
    async _loadJingles(base) {
        const list    = await appBootstrap.fetchJsonAsync(base + 'jingles.json');
        const context = this._engine.getContext();
        const entries = await Promise.all(Object.entries(list.jingles).map(async ([command, jingle]) => {
            const response = await fetch(appBootstrap.buildUrl(base + 'jingles/' + jingle.file));
            if (!response.ok) {
                throw new Error('HTTP ' + response.status + ' on ' + jingle.file);
            }
            const buffer = await context.decodeAudioData(await response.arrayBuffer());
            const id     = this._samples.loadFromData('jingle/' + command, {rate: buffer.sampleRate, samples: buffer.getChannelData(0)});

            return [command, {id: id, loop: jingle.loop}];
        }));
        this.laps = list.laps;

        return new Map(entries);
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
RacingSound.ENGINE_PROCESSOR = '/js/racing/racingEngineProcessor.js';
RacingSound.WAV_HEADER_SIZE = 44;
RacingSound.PCM_ZERO        = 128;
RacingSound.FRAME_MS        = (1000 / 60);
// The console mix plays a DAC effect 13.4 dB under its exported sample (crash $B0 and voice $C0 recorded from the
// emulated game: -26.1 / -26.6 dB against -12.7 / -13.5 dB); the FM recordings come at that mix: 4 times (12 dB)
// the gain of the samples, their peaks (-4.7 dB) still unclipped.
RacingSound.DAC_GAIN        = 0.4;
RacingSound.DAC_KEY         = 'dac';
// The DAC of another player's car, by its player id.
RacingSound.CAR_DAC_KEY     = 'dac:car';
RacingSound.FM_GAIN         = 1.6;
RacingSound.MUSIC_GAIN      = 1.6;

const racingSound = new RacingSound();

#!/usr/bin/env node
/**
 * Compares the race of the game (RacingRaceControl) with the original, tick by tick, run from the repository root:
 *
 *   node bench/compareRace.js [scenario...]
 *   node bench/compareRace.js scenario --show from-to
 *
 * Without a scenario, every one traced from the race loading ("from load"). Each tick, the exact physics is loaded
 * with the traced state of the tick before, runs the tick, then the race control runs it: what the player sees and
 * hears is compared with the trace — start signs, READY lights, pit crew frame, lap message, split, REVERSE, PIT WORK,
 * blinds (up to the finish: the game keeps them open, user decision), sounds of the race, the value of the split — and
 * the lap times at the finish. The original shows its times
 * through a table of thousandths by frame ($89980C), the game true milliseconds (user decision): the original's times
 * are taken back to true milliseconds from its chrono in frames and the correction it took off. The fields the race control sets in the physics (mode,
 * started flag, start crew) keep the game's values from tick to tick: they are compared.
 *
 * --show prints, for each tick of the range, the traced and computed values, a differing one marked with '!'.
 */
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const {BenchScenario} = require('./benchScenario');
const {BenchTrace}    = require('./benchTrace');

const ROOT_DIR    = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT_DIR, 'website');
const SOURCES     = ['js/racing/game/racingCourseCollision.js', 'js/racing/game/racingCarPhysics.js', 'js/racing/game/racingRaceControl.js'];
// The start with the pit crew (RacingGame.PIT_START_COURSES).
const PIT_START_COURSES = ['big_forest'];
// HUD entries of the original ($FF6800 list, research-race.md § 3): visible when byte 0 is not 0, image at +8.
const HUD = {
    sign:    0x180,
    pit:     0x190,
    top:     0x1C0,
    message: 0x140,
    split:   0x0F0,
    reverse: 0x130,
    pitWork: 0x170,
};
const HUD_IMAGE = 8;
const SIGN_IMAGES = {
    '222F095A': '3',
    '222F038A': '2',
    '222F002C': '1',
    '222EEF3A': 'go',
    '222F0FBE': 'ready',
};
const MESSAGE_IMAGES = {
    '222E070C': 'lapTime',
    '222DFB7C': 'bestLap',
    '222E0508': 'fastestLap',
};
const LIGHT_RED   = '222F1D4A';
const LIGHT_GREEN = '222F1716';
// $FF60D5: 80 open; FF..F8 opening (8 to 1 eighths closed); 01..08 closing; 00 closed.
const BLINDS_OFFSET = 0x15;
const BLINDS_OPEN   = 0x80;
const BLINDS_EIGHTHS = 8;
// Commands of the race: count, lights, wrench, last lap voice, jingles, pits, results. The checkpoint music (85-89 in a
// race of 5 laps) is the game's own (user request): left out.
const RACE_SOUNDS = ['C0', 'C1', 'C2', 'C3', 'A6', 'A7', 'BA', 'BE', '93', '8A', '8B', '8C', '8D', '97', '90', '91', '8E'];
const NO_SOUND    = 0x80;
// Sounds of the driver: $8509 (command played), $850A (queue); the music mailbox $C8A5.
const DRIVER_COMMAND = 0x09;
const DRIVER_QUEUE   = 0x0A;
const MUSIC_MAILBOX  = 0xA5;
// The finish machine $476A ($C07C): 12 = the results.
const FINISH_RESULTS = 0x0C;
// Physics fields the race control sets.
const RACE_OWNED = ['mode', 'raceFlags', 'pitCrewFrame'];
// Crew descriptor $FF66DC: drawn at frame 0 while $C026 is still -1 (the opening).
const CREW_SHOWN = 0x1C;
// The results music of RacingGame, as the race control ends.
const RESULTS_MUSIC = '8E';
const LAP_COUNT    = {block: 'FFC300', offset: 0x10};
const RACE_FLAGS   = {block: 'FFC300', offset: 0x0E};
const RACE_STARTED = 0x10;
// Records $FDAA + course x 36 + car x 12 (lap, checkpoint 1, checkpoint 2); laps of the race $C200 + 4n.
const RECORD_COURSE_BYTES = 36;
const RECORD_CAR_BYTES    = 12;
const LAP_LIST = 0x00;
const BCD_LONG_BYTES = 4;
// Times of the lap at checkpoints 1 and 2 ($C270, $C274), written in the frame the car comes onto a checkpoint polygon
// (bits 6-7 of the surface under it, $C319, research-race.md § 2.4) or the next one, the chrono the same in both.
const CHECKPOINT_TIMES = [0x70, 0x74];
const SURFACE = {block: 'FFC300', offset: 0x19};
const CHECKPOINT_BIT = 0x80;
const CHECKPOINT_2_BIT = 0x40;
const CHECKPOINT_WRITE_FRAMES = 2;
// Chrono of the lap $C806: minutes, $C4 + seconds, $C4 + frame (60 a second).
const CHRONO = 0x06;
const CHRONO_BASE = 0xC4;
const FRAMES_PER_SECOND = 60;
const LAP_DONE = {block: 'FF9000', offset: 0x2D};
// Thousandths shown by frame of the second ($89980C).
const FRAME_THOUSANDTHS = [0, 100, 20, 41, 61, 91, 102, 122, 132, 153, 173, 183, 204, 214, 224, 245, 265, 295, 306, 326, 336, 357, 377,
    387, 408, 418, 428, 449, 469, 499, 500, 520, 530, 551, 571, 581, 602, 612, 622, 643, 663, 693, 704, 724, 734, 755, 775, 785, 806, 816,
    826, 847, 867, 897, 908, 928, 938, 959, 979, 989];

class RaceComparator {
    constructor(args) {
        this._show  = (args.includes('--show') ? args[args.indexOf('--show') + 1].split('-').map(Number) : [-1, -1]);
        this._names = args.filter((arg, i) => (!arg.startsWith('--') && (args[i - 1] !== '--show')));
        this._ctx   = vm.createContext({console, Math});
        for (const file of SOURCES) {
            vm.runInContext(fs.readFileSync(path.join(WEBSITE_DIR, file), 'utf8'), this._ctx, {filename: file});
        }
        this._Control     = vm.runInContext('RacingRaceControl', this._ctx);
        this._physicsData = this._asset('physics.json');
        this._race        = this._asset('race.json');
        this._lapJingles  = this._asset('jingles.json').laps;
    }

    run() {
        const names = ((this._names.length > 0) ? this._names : BenchScenario.names().filter((name) => new BenchScenario(name).fromLoad));
        let failures = 0;
        for (const name of names) {
            failures += this._compare(new BenchScenario(name));
        }
        return failures;
    }

    _compare(scenario) {
        // The tick counter stands still while the race loads: from the last frame before the first tick.
        const all    = scenario.readTrace();
        const frames = all.slice(all.findIndex((frame) => (BenchTrace.word(frame, BenchTrace.TICK_COUNTER.block, BenchTrace.TICK_COUNTER.offset) === 1)) - 1);
        const ticks  = BenchTrace.ticks(frames);
        const Physics = vm.runInContext('RacingCarPhysics', this._ctx);
        const Collision = vm.runInContext('RacingCourseCollision', this._ctx);
        const courseCode = scenario.course;
        const course = {
            index:     BenchScenario.COURSES.indexOf(courseCode),
            collision: new Collision(this._asset('courses/' + courseCode + '.json').collision),
            ...this._race.courses[courseCode],
            pit:       Physics.coursePit(this._race, courseCode),
        };
        const physics = new Physics(this._physicsData, scenario.car, (scenario.transmission === 'manual'), course);
        BenchTrace.load(physics, ticks[1].frame);
        physics.settle();
        BenchTrace.load(physics, ticks[1].frame);
        physics.laps = this._byte(ticks[1].frame, LAP_COUNT.block, LAP_COUNT.offset);
        const pitStart = PIT_START_COURSES.includes(courseCode);
        const sounds   = [];
        let finishTick = null;
        const record   = this._record(ticks[0].frame, scenario);
        const control  = new this._Control(physics, this._race.courses[courseCode], record, pitStart,
            this._lapJingles, this._race.checkpointJingles)
            .setOnSound((command) => sounds.push(command))
            .setOnFinish(() => {
                finishTick = t;
            });
        const mismatches = new Map();
        let t = 0;
        let tracedFinish = null;
        // The original's times in true milliseconds: laps, checkpoints of the lap, checkpoints of the record.
        const times = {laps: [], checkpoints: [null, null], record: record.checkpointsMs.slice(), recordAt: this._recordOffset(scenario)};
        let splitMs     = null;
        let shownSplit  = null;
        for (t = 1; t < ticks.length; t++) {
            // Before the first tick, the frame is still the screen before the race: the race control set the opening.
            if (t > 1) {
                const owned = RACE_OWNED.map((field) => physics[field]);
                BenchTrace.load(physics, ticks[t - 1].frame);
                RACE_OWNED.forEach((field, i) => {
                    physics[field] = owned[i];
                });
            }
            physics.tick(BenchTrace.input(ticks[t]));
            control.update(1);
            sounds.push(...physics.sounds);
            physics.sounds.length = 0;
            if (finishTick === t) {
                sounds.push(RESULTS_MUSIC);
            }
            splitMs = this._times(frames, ticks, t, times) ?? splitMs;
            if ((control.split !== null) && (shownSplit === null)) {
                this._check(mismatches, 'splitMs', t, ticks, control.split.ms, splitMs);
            }
            shownSplit = control.split;
            const traced   = this._traced(frames, ticks, t, pitStart);
            const computed = this._computed(physics, control, sounds, pitStart);
            sounds.length  = 0;
            // After the line, the game keeps the blinds open under its results (user decision).
            if (control.finished) {
                delete traced.blinds;
            }
            if ((tracedFinish === null) && (this._byte(ticks[t].frame, 'FFC000', 0x7D) === FINISH_RESULTS)) {
                tracedFinish = t;
            }
            for (const key of Object.keys(traced)) {
                this._check(mismatches, key, t, ticks, computed[key], traced[key]);
            }
            if ((t >= this._show[0]) && (t <= this._show[1])) {
                process.stdout.write('  tick ' + t + ' (frame ' + ticks[t].frame.frame + ') '
                    + Object.keys(traced).map((key) => key + '=' + traced[key] + ((traced[key] !== computed[key]) ? ('!' + computed[key]) : '')).join(' ') + '\n');
            }
        }
        this._finish(mismatches, control, times.laps, finishTick, tracedFinish);

        process.stdout.write(scenario.name + ' (' + scenario.car + ', ' + courseCode + ', ' + (ticks.length - 1) + ' ticks): '
            + ((mismatches.size === 0) ? 'identical' : (mismatches.size + ' items differ')) + '\n');
        for (const [key, entry] of mismatches) {
            process.stdout.write('  ' + key + ': ' + entry.count + '\n');
            for (const line of entry.first) {
                process.stdout.write('    ' + line + '\n');
            }
        }
        return mismatches.size;
    }

    _check(mismatches, key, t, ticks, computed, traced) {
        if (computed === traced) {
            return;
        }
        const entry = mismatches.get(key) ?? {count: 0, first: []};
        mismatches.set(key, entry);
        entry.count++;
        if (entry.first.length < 4) {
            entry.first.push('tick ' + t + ' (frame ' + ticks[t].frame.frame + '): ' + computed + ' != ' + traced);
        }
    }

    // The times the original keeps during the frames of tick t, in true milliseconds: a lap done ($C200 + 4n); a
    // checkpoint time ($C270 / $C274), which gives back the split against the record (found by the surface: the time
    // may be the same as the lap before's); a new record ($FDAA), which takes the checkpoints of its lap. Returns the
    // split of the tick, null if none.
    _times(frames, ticks, t, times) {
        const end = (((t + 1) < ticks.length) ? ticks[t + 1].start : frames.length);
        let split = null;
        for (let i = Math.max(1, ticks[t].start); i < end; i++) {
            const frame = frames[i];
            const before = frames[i - 1];
            if (this._byte(frame, LAP_DONE.block, LAP_DONE.offset) !== this._byte(before, LAP_DONE.block, LAP_DONE.offset)) {
                times.laps.push(this._trueMs(before, this._bcdMs(frame, 'FFC200', (LAP_LIST + (times.laps.length * BCD_LONG_BYTES)))));
            }
            if (this._bcdMs(frame, 'FFFDAA', times.recordAt) !== this._bcdMs(before, 'FFFDAA', times.recordAt)) {
                times.record = times.checkpoints.slice();
            }
            const surface = this._byte(frame, SURFACE.block, SURFACE.offset);
            if (((surface & CHECKPOINT_BIT) !== 0) && ((this._byte(before, SURFACE.block, SURFACE.offset) & CHECKPOINT_BIT) === 0)) {
                const n = (((surface & CHECKPOINT_2_BIT) !== 0) ? 1 : 0);
                const written = frames[Math.min((i + CHECKPOINT_WRITE_FRAMES), (frames.length - 1))];
                times.checkpoints[n] = this._trueMs(frame, this._bcdMs(written, 'FFC200', CHECKPOINT_TIMES[n]));
                split = (times.checkpoints[n] - times.record[n]);
            }
        }
        return split;
    }

    // A time kept by the original (its thousandths of the frame less the correction) in true milliseconds, from the
    // chrono of the frame it was taken at.
    _trueMs(frame, keptMs) {
        const minutes = this._byte(frame, 'FFC800', CHRONO);
        const seconds = (this._byte(frame, 'FFC800', (CHRONO + 1)) - CHRONO_BASE);
        const index   = (this._byte(frame, 'FFC800', (CHRONO + 2)) - CHRONO_BASE);
        const shownMs = ((((minutes * 60) + seconds) * 1000) + FRAME_THOUSANDTHS[index]);
        const frames  = ((((minutes * 60) + seconds) * FRAMES_PER_SECOND) + index);

        return Math.round(((frames * 1000) / FRAMES_PER_SECOND) - (shownMs - keptMs));
    }

    // The tick the results come, and the lap times.
    _finish(mismatches, control, lapTimes, finishTick, tracedFinish) {
        const add = (key, computed, traced) => {
            if (computed !== traced) {
                mismatches.set(key, {count: 1, first: [computed + ' != ' + traced]});
            }
        };
        add('resultsTick', finishTick, tracedFinish);
        add('lapTimes', control.lapTimes.join(' '), lapTimes.join(' '));
    }

    // What the original shows and plays at the end of tick t.
    _traced(frames, ticks, t, pitStart) {
        const frame = ticks[t].frame;
        const shown = (entry) => (this._byte(frame, 'FF6800', entry) !== 0);
        const image = (entry) => this._hex(frame, 'FF6800', (entry + HUD_IMAGE), 4);
        const flags = this._byte(frame, RACE_FLAGS.block, RACE_FLAGS.offset);
        const lights = (pitStart || !shown(HUD.top)) ? null
            : ((image(HUD.pit) === LIGHT_GREEN) ? 'green' : ((image(HUD.top) === LIGHT_RED) ? 'red' : 'off'));

        return {
            mode:     BenchTrace.word(frame, 'FFC000', 0x7A),
            started:  ((flags & RACE_STARTED) !== 0),
            crew:     this._crew(frame),
            sign:     (shown(HUD.sign) ? (SIGN_IMAGES[image(HUD.sign)] ?? image(HUD.sign)) : null),
            pitStart: (pitStart && shown(HUD.pit)),
            lights:   lights,
            message:  (shown(HUD.message) ? (MESSAGE_IMAGES[image(HUD.message)] ?? image(HUD.message)) : null),
            split:    shown(HUD.split),
            reverse:  shown(HUD.reverse),
            pitWork:  shown(HUD.pitWork),
            blinds:   this._blinds(this._byte(frame, 'FF60C0', BLINDS_OFFSET)),
            sounds:   this._tracedSounds(frames, ticks, t).join(' '),
        };
    }

    // What the game shows (RacingHud) and plays at the end of the tick.
    _computed(physics, control, sounds, pitStart) {
        let sign = control.startSign;
        if ((sign === this._Control.SIGN_GO) && !control.isBlinkOn(true)) {
            sign = null;
        }
        const names = ['off', 'red', 'green'];

        return {
            mode:     physics.mode,
            started:  ((physics.raceFlags & RACE_STARTED) !== 0),
            crew:     physics.pitCrewFrame,
            sign:     ((sign === null) ? null : String(sign)),
            pitStart: (control.pitStartSign && control.isBlinkOn(false)),
            lights:   (((control.lights === null) || pitStart) ? null : names[control.lights]),
            message:  (((control.message !== null) && control.message.shown) ? control.message.kind : null),
            split:    ((control.split !== null) && control.split.shown),
            reverse:  (control.reverse && control.isBlinkOn(false)),
            pitWork:  (control.pitWork && control.isBlinkOn(true)),
            blinds:   (Math.round(control.blinds * BLINDS_EIGHTHS) / BLINDS_EIGHTHS),
            sounds:   sounds.filter((command) => RACE_SOUNDS.includes(command)).join(' '),
        };
    }

    _crew(frame) {
        const crew = BenchTrace.word(frame, 'FFC000', 0x26);
        if (crew >= 0) {
            return crew;
        }
        return ((BenchTrace.word(frame, 'FF66C0', CREW_SHOWN) !== 0) ? 0 : crew);
    }

    // The share of the screen closed.
    _blinds(mask) {
        if (mask === BLINDS_OPEN) {
            return 0;
        }
        if (mask === 0) {
            return 1;
        }
        if (mask > BLINDS_OPEN) {
            return (((mask & (BLINDS_EIGHTHS - 1)) + 1) / BLINDS_EIGHTHS);
        }
        return (mask / BLINDS_EIGHTHS);
    }

    // The race commands the driver takes during the frames of tick t, in order, once each.
    _tracedSounds(frames, ticks, t) {
        const first = ticks[t].start;
        const end   = ((t + 1) < ticks.length) ? ticks[t + 1].start : frames.length;
        const found = [];
        for (let i = first; i < end; i++) {
            for (const [block, offset] of [['FF8500', DRIVER_COMMAND], ['FF8500', DRIVER_QUEUE], ['FFC800', MUSIC_MAILBOX]]) {
                const value = this._byte(frames[i], block, offset);
                const id    = value.toString(16).toUpperCase().padStart(2, '0');
                if ((value !== 0) && (value !== NO_SOUND) && RACE_SOUNDS.includes(id) && (found[found.length - 1] !== id)) {
                    found.push(id);
                }
            }
        }
        return found;
    }

    // The record of the course and car at the start ($FDAA, BCD).
    _record(frame, scenario) {
        const base  = this._recordOffset(scenario);
        const lapMs = this._bcdMs(frame, 'FFFDAA', base);

        return {lapMs: lapMs, checkpointsMs: [this._bcdMs(frame, 'FFFDAA', (base + BCD_LONG_BYTES)), this._bcdMs(frame, 'FFFDAA', (base + (2 * BCD_LONG_BYTES)))]};
    }

    _recordOffset(scenario) {
        return ((BenchScenario.COURSES.indexOf(scenario.course) * RECORD_COURSE_BYTES) + (BenchScenario.CARS.indexOf(scenario.car) * RECORD_CAR_BYTES));
    }

    // [min BCD][s BCD][hundreds][tens-units BCD] -> ms ($B3CE).
    _bcdMs(frame, block, offset) {
        const bcd = (byte) => (((byte >> 4) * 10) + (byte & 0x0F));
        const byte = (n) => this._byte(frame, block, (offset + n));

        return ((bcd(byte(0)) * 60000) + (bcd(byte(1)) * 1000) + (byte(2) * 100) + bcd(byte(3)));
    }

    _byte(frame, block, offset) {
        return parseInt(frame.blocks[block].substr(offset * 2, 2), 16);
    }

    _hex(frame, block, offset, bytes) {
        return frame.blocks[block].substr(offset * 2, bytes * 2).toUpperCase();
    }

    _asset(file) {
        return JSON.parse(fs.readFileSync(path.join(WEBSITE_DIR, 'assets', 'virtual_racing', file), 'utf8'));
    }
}

try {
    process.exitCode = ((new RaceComparator(process.argv.slice(2)).run() > 0) ? 1 : 0);
} catch (error) {
    process.stderr.write(String(error.stack ?? error) + '\n');
    process.exitCode = 1;
}

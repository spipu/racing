#!/usr/bin/env node
/**
 * Compares RacingCarPhysics with the reference traces of the original game, run from the repository root:
 *
 *   node bench/comparePhysics.js [scenario...] [--ticks n]
 *   node bench/comparePhysics.js [scenario...] --continuous [--rate n]
 *   node bench/comparePhysics.js [scenario...] --resync h [--rate n | --step s]
 *   node bench/comparePhysics.js scenario --watch field,field --show from-to
 *
 * Without a scenario, every one but the camera references (NOT_PHYSICS).
 *
 * A tick of the original is found by its counter ($C0A4). The ticks are chained from the first traced state, the
 * state the trace does not hold (polygons under the probes) carried along; a field that differs is reported, then
 * set back to the trace so that one error does not hide the next ones.
 *
 * --continuous runs the variable step physics of the game instead, n steps per original tick (default 1), never set
 * back to the trace: it reports how far each field drifts from the original, and the distance between the cars.
 *
 * --resync runs the variable step physics from every traced tick in turn (set back to the trace), h original ticks at n
 * steps a tick, and measures where it ends against the exact physics run from the same state (the trace does not hold
 * the polygons kept under the probes, which both runs rebuild alike): position, heading, speed. Walls, spins and
 * carryings back are covered, a divergence being cut short by the next start. --step s runs steps of s ticks instead
 * (0.139 for 144 frames a second), across the tick boundaries as the game's frames do; each step takes the input of
 * the tick it starts in.
 *
 * --watch / --show print, for each tick of the range, the input and the traced and computed values of the fields
 * (computed before being set back to the trace), a differing value marked with '!'; with --resync, for the run from
 * the first tick of the range: traced / exact physics / variable step at 1 / at n steps a tick (or by --step).
 */
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const {BenchScenario} = require('./benchScenario');

const ROOT_DIR     = path.resolve(__dirname, '..');
const WEBSITE_DIR  = path.join(ROOT_DIR, 'website');
// Recorded for the camera transitions (project notes race.md): the car waits on the grid.
const NOT_PHYSICS  = ['views', 'views_3button'];
const SOURCES      = ['js/racing/game/racingCourseCollision.js', 'js/racing/game/racingCarPhysics.js', 'js/racing/game/racingCarContinuousPhysics.js'];
const TICK_COUNTER = {block: 'FFC000', offset: 0xA4};
const MAX_TICK_FRAMES = 5;

// Physics field (index for an array) -> traced RAM: block, offset, bytes.
const FIELDS = [
    ['flags',          'FF9000', 0x02, 2],
    ['displaySpeed',   'FF9000', 0x04, 2],
    ['speed',          'FF9000', 0x06, 2],
    ['maxSpeed',       'FF9000', 0x0A, 2],
    ['acceleration',   'FF9000', 0x0C, 2],
    ['throttle',       'FF9000', 0x0E, 2],
    ['brake',          'FF9000', 0x10, 2],
    ['crashTimer',     'FF9000', 0x14, 2],
    ['resistance',     'FF9000', 0x16, 2],
    ['section',        'FF9000', 0x1D, 1],
    ['roadHeading',    'FF9000', 0x1E, 2],
    ['roadPoint.0',    'FF9000', 0x20, 2],
    ['progress',       'FF9000', 0x24, 2],
    ['roadPoint.1',    'FF9000', 0x22, 2],
    ['x',              'FF9000', 0x30, 2],
    ['height',         'FF9000', 0x32, 2],
    ['z',              'FF9000', 0x34, 2],
    ['prevX',          'FF9000', 0x36, 2],
    ['prevZ',          'FF9000', 0x38, 2],
    ['pitch',          'FF9000', 0x3A, 2],
    ['heading',        'FF9000', 0x3C, 2],
    ['roll',           'FF9000', 0x3E, 2],
    ['shownHeading',   'FF9000', 0x40, 2],
    ['prevShownHeading', 'FF9000', 0x42, 2],
    ['bodyPitch',      'FF9000', 0x44, 2],
    ['bodyYaw',        'FF9000', 0x46, 2],
    ['bodyRoll',       'FF9000', 0x4A, 2],
    ['slipInput',      'FF9000', 0x4C, 2],
    ['respawnStep.0',  'FF9000', 0x4E, 2],
    ['respawnStep.1',  'FF9000', 0x50, 2],
    ['respawnStep.2',  'FF9000', 0x52, 2],
    ['probeFlags',     'FF9000', 0x55, 1],
    ['probeCodes.0',   'FF9000', 0x56, 1],
    ['probeCodes.1',   'FF9000', 0x57, 1],
    ['probeCodes.2',   'FF9000', 0x58, 1],
    ['probeCodes.3',   'FF9000', 0x59, 1],
    ['probeHeights.0', 'FF9000', 0x5A, 2],
    ['probeHeights.1', 'FF9000', 0x5C, 2],
    ['probeHeights.2', 'FF9000', 0x5E, 2],
    ['wallTimer',      'FF9000', 0x62, 2],
    ['wallHeading',    'FF9000', 0x64, 2],
    ['wallTurn',       'FF9000', 0x66, 2],
    ['wallSide',       'FF9000', 0x68, 2],
    ['shakeTimer',     'FF9000', 0x6A, 2],
    ['shake',          'FF9000', 0x6C, 2],
    ['shakeYaw',       'FF9000', 0x6E, 2],
    ['roadOffset',     'FF9000', 0x72, 2],
    ['rpm',            'FF9000', 0x74, 2],
    ['yawGain',        'FF9000', 0x76, 2],
    ['grip',           'FF9000', 0x78, 2],
    ['gear',           'FF9000', 0x7A, 2],
    ['smoothRpm',      'FF9000', 0x7E, 2],
    ['skidTimer',      'FF9000', 0x80, 2],
    ['spinTimer',      'FF9000', 0x82, 2],
    ['overrevTimer',   'FF9000', 0x84, 2],
    ['crashRecovery',  'FF9000', 0x8C, 2],
    ['steer',          'FF9000', 0x8E, 2],
    ['yawRate',        'FF9000', 0x90, 2],
    ['backOnTrack',    'FF9000', 0x92, 2],
    ['slip',           'FF9000', 0x94, 2],
    ['shownSlip',      'FF9000', 0x96, 2],
    ['crashPose.0',    'FF9000', 0x9C, 2],
    ['crashPose.1',    'FF9000', 0x9E, 2],
    ['crashPose.2',    'FF9000', 0xA0, 2],
    ['crashPose.3',    'FF9000', 0xA2, 2],
    ['sparksTimer',    'FF9000', 0x86, 2],
    ['grassLeftTimer', 'FF9000', 0x98, 2],
    ['grassRightTimer', 'FF9000', 0x9A, 2],
    ['speedState',     'FF9000', 0xA8, 2],
    ['sparksFast',     'FF9000', 0xBE, 2],
    ['sandLeftTimer',  'FF9000', 0xE6, 2],
    ['sandRightTimer', 'FF9000', 0xE8, 2],
    ['effectFrames.smoke',  'FFC000', 0x0C, 2],
    ['effectFrames.sparks', 'FFC000', 0x12, 2],
    ['effectFrames.flames', 'FFC000', 0x18, 2],
    ['effectFrames.grass.0', 'FFC000', 0x1E, 2],
    ['effectFrames.grass.1', 'FFC000', 0x24, 2],
    ['effectFrames.sand.0',  'FFC000', 0x0E, 2],
    ['effectFrames.sand.1',  'FFC000', 0x10, 2],
    ['wrongWay',       'FFC300', 0x12, 1],
    ['centerSurface',  'FFC300', 0x19, 1],
    ['steerLoad',      'FF9000', 0xAA, 2],
    ['layer',          'FF9000', 0xE4, 1],
    ['roadFlags',      'FF9000', 0xE5, 1],
    ['steerSpeed',     'FFC000', 0x00, 2],
    ['roadAlignTicks', 'FFC000', 0x02, 2],
    ['steerSense',     'FFC000', 0x06, 2],
    ['offTrackTicks',  'FFC000', 0x2A, 2],
    ['respawnTicks',   'FFC000', 0x2C, 2],
    ['mode',           'FFC000', 0x7A, 2],
    ['damage',         'FF9000', 0x8A, 2],
    ['pitTicks',       'FF9000', 0xB0, 2, 'pit'],
    ['pitState',       'FFC000', 0x5C, 2],
    ['pitCrewFrame',   'FFC000', 0x26, 2, 'pit'],
    ['lap',            'FF9000', 0x2C, 2],
    ['lapLine',        'FF9000', 0x2E, 2],
    ['lapProgress',    'FF9000', 0x28, 2],
    ['prevProgress',   'FF9000', 0x26, 2],
    ['roadAlong',      'FF9000', 0xE2, 2],
    ['raceFlags',      'FFC300', 0x0E, 1],
    ['throttleGate',   'FFC000', 0xAC, 2],
    ['offRoadWheels',  'FFC300', 0x1A, 1],
    ['sliding',        'FFC300', 0x1B, 1],
];
// Fields set from the trace but not compared (driven by systems not ported).
const INPUT_ONLY = ['maxSpeed', 'speedState', 'raceFlags'];
// Variant of the pit stop ($C07A).
const MODE_PIT   = 4;
// Bits of the pad copy $C300.
const PAD_LEFT       = 2;
const PAD_RIGHT      = 3;
const PAD_ACCELERATE = 4;
const PAD_BRAKE      = 6;
// Collision units: 1 = 2 scenery units = 1/16 m.
const UNITS_PER_METRE = 16;
// The new input acts on the last step of a tick, up to a tick later than in the original: in a long turn the
// heading lags half a tick of turning, about a metre at the wall of the 'wall' scenario.
const PATH_TOLERANCE_METRES = 1.5;
const PATH_WINDOW = 3;
const SPEED_TOLERANCE = 0.02;
// Below it the relative speed gap means nothing (start).
const DRIFT_SPEED_FLOOR = 100;

class PhysicsComparator {
    constructor(args) {
        this._ticks      = this._option(args, '--ticks', Infinity);
        this._rate       = this._option(args, '--rate', 1);
        this._continuous = args.includes('--continuous');
        this._resync     = ((args.includes('--resync')) ? this._option(args, '--resync', 1) : 0);
        this._step       = Number(this._text(args, '--step', '0'));
        this._watch      = this._text(args, '--watch', '').split(',').filter((name) => (name !== ''));
        this._show       = this._text(args, '--show', '0-0').split('-').map(Number);
        this._names   = args.filter((arg, i) => (!arg.startsWith('--') && !['--ticks', '--rate', '--watch', '--show', '--resync', '--step'].includes(args[i - 1])));
        this._ctx     = vm.createContext({console, Math});
        for (const file of SOURCES) {
            vm.runInContext(fs.readFileSync(path.join(WEBSITE_DIR, file), 'utf8'), this._ctx, {filename: file});
        }
        this._physics = this._asset('physics.json');
        this._race    = this._asset('race.json');
    }

    run() {
        const names = ((this._names.length > 0) ? this._names : BenchScenario.names().filter((name) => !NOT_PHYSICS.includes(name)));
        let failures = 0;
        for (const name of names) {
            failures += this._compare(new BenchScenario(name));
        }
        return failures;
    }

    _text(args, option, byDefault) {
        const index = args.indexOf(option);

        return ((index < 0) ? byDefault : args[index + 1]);
    }

    // A positive whole number after an option, its default without the option.
    _option(args, option, byDefault) {
        const index = args.indexOf(option);
        if (index < 0) {
            return byDefault;
        }
        const value = Number(args[index + 1]);
        if (!Number.isInteger(value) || (value < 1)) {
            throw new Error(option + ' expects a positive whole number, not ' + args[index + 1]);
        }

        return value;
    }

    // Chains the ticks from the first traced state; a differing field is reported, then set back to the trace.
    _compare(scenario) {
        const name       = scenario.name;
        const car        = scenario.car;
        const gearbox    = scenario.transmission;
        const courseCode = scenario.course;
        // The trace may end in the middle of its last tick.
        const all    = this._tickFrames(scenario.readTrace());
        const ticks  = all.slice(0, -1).slice(0, this._ticks + 1);

        const Physics   = vm.runInContext('RacingCarPhysics', this._ctx);
        const Collision = vm.runInContext('RacingCourseCollision', this._ctx);
        const course    = {
            index:        BenchScenario.COURSES.indexOf(courseCode),
            collision:    new Collision(this._asset('courses/' + courseCode + '.json').collision),
            ...this._race.courses[courseCode],
            pit:          Physics.coursePit(this._race, courseCode),
        };
        if (this._continuous) {
            return this._drift(name, car, gearbox, courseCode, course, ticks);
        }
        if (this._resync > 0) {
            return this._resynced(name, car, gearbox, courseCode, course, ticks);
        }
        const physics = new Physics(this._physics, car, (gearbox === 'manual'), course);
        this._load(physics, ticks[0].frame);
        physics.settle();
        this._load(physics, ticks[0].frame);
        const mismatches = new Map();
        for (let t = 1; t < ticks.length; t++) {
            // A car placed by the scenario (poke): the run starts again from the traced state.
            if (ticks[t].poked || ticks[t - 1].poked) {
                this._load(physics, ticks[t].frame);
                physics.settle();
                this._load(physics, ticks[t].frame);
                continue;
            }
            physics.tick(this._input(ticks[t]));
            if ((t >= this._show[0]) && (t <= this._show[1])) {
                this._printWatch(physics, ticks[t], t);
            }
            for (const field of FIELDS) {
                const expected = this._read(ticks[t].frame, field);
                if (!INPUT_ONLY.includes(field[0]) && this._compared(field, physics, ticks, t) && (this._get(physics, field[0]) !== expected)) {
                    const entry = mismatches.get(field[0]) ?? {count: 0, first: []};
                    mismatches.set(field[0], entry);
                    entry.count++;
                    if (entry.first.length < 3) {
                        entry.first.push('tick ' + t + ' (frame ' + ticks[t].frame.frame + ', ' + ticks[t].buttons + '): ' + this._get(physics, field[0]) + ' != ' + expected);
                    }
                }
                this._set(physics, field[0], expected);
            }
        }

        process.stdout.write(name + ' (' + car + ', ' + gearbox + ', ' + courseCode + ', ' + (ticks.length - 1) + ' ticks): '
            + ((mismatches.size === 0) ? 'identical' : (mismatches.size + ' fields differ'))
            + ((all.lost !== undefined) ? (' (tick counter frozen from frame ' + all.lost + ')') : '') + '\n');
        for (const [field, entry] of mismatches) {
            process.stdout.write('  ' + field + ': ' + entry.count + '\n');
            for (const line of entry.first) {
                process.stdout.write('    ' + line + '\n');
            }
        }
        return mismatches.size;
    }

    // The pit fields are the race start's too (the crew of the Big Forest start, RacingRaceControl): compared during
    // a pit stop and while its crew leaves.
    _compared(field, physics, ticks, t) {
        if (field[4] !== 'pit') {
            return true;
        }
        const state = FIELDS.find((f) => (f[0] === 'pitState'));

        return ((this._read(ticks[t].frame, state) !== 0) || (this._read(ticks[t - 1].frame, state) !== 0) || (physics.pitCrewAway > 0));
    }

    _printWatch(physics, tick, t) {
        const values = this._watch.map((name) => {
            const field    = FIELDS.find((f) => (f[0] === name));
            const computed = this._get(physics, name);
            const traced   = ((field === undefined) ? '?' : this._read(tick.frame, field));

            return name + '=' + traced + ((computed !== traced) ? ('!' + computed) : '');
        });
        process.stdout.write('  tick ' + t + ' (' + tick.buttons + ') ' + values.join(' ') + '\n');
    }

    // The variable step physics run h ticks from each traced tick: gaps at the end of the run.
    _resynced(name, car, gearbox, courseCode, course, ticks) {
        const Physics   = vm.runInContext('RacingCarContinuousPhysics', this._ctx);
        const Reference = vm.runInContext('RacingCarPhysics', this._ctx);
        const gaps    = {path: [], heading: [], speed: []};
        let worst     = {path: 0, at: 0};
        let worstTurn = {heading: 0, at: 0};
        for (let t = 0; (t + this._resync) < ticks.length; t++) {
            const physics   = new Physics(this._physics, car, (gearbox === 'manual'), course);
            const reference = new Reference(this._physics, car, (gearbox === 'manual'), course);
            for (const run of [physics, reference]) {
                this._load(run, ticks[t].frame);
                run.settle();
                this._load(run, ticks[t].frame);
            }
            // The input of a tick drives the whole tick, as the original reads the pad before computing it; a press
            // acts on its first step.
            for (let k = 1; k <= this._resync; k++) {
                reference.tick(this._input(ticks[t + k]));
            }
            this._runSteps(physics, ticks, t);
            if ((this._watch.length > 0) && (t === this._show[0])) {
                this._traceRun(Physics, car, gearbox, course, ticks, t);
            }
            const path    = (Math.hypot((physics.x - reference.x), (physics.z - reference.z)) / UNITS_PER_METRE);
            const turn    = (((physics.heading - reference.heading) % 65536) + 98304) % 65536 - 32768;
            const traced  = reference.speed;
            gaps.path.push(path);
            gaps.heading.push(Math.abs((turn * 360) / 65536));
            gaps.speed.push(Math.abs(physics.speed - traced) / Math.max(traced, DRIFT_SPEED_FLOOR));
            if (path > worst.path) {
                worst = {path, at: t};
            }
            if (Math.abs(turn) > worstTurn.heading) {
                worstTurn = {heading: Math.abs(turn), at: t};
            }
        }
        const stat = (values, scale, unit) => {
            const sorted = values.slice().sort((a, b) => (a - b));
            const at     = (share) => (sorted[Math.min((sorted.length - 1), Math.floor(share * sorted.length))] * scale);

            return 'median ' + at(0.5).toFixed(2) + ', 95 % ' + at(0.95).toFixed(2) + ', max ' + at(1).toFixed(2) + ' ' + unit;
        };
        process.stdout.write(name + ' (' + car + ', ' + gearbox + ', ' + courseCode + ', ' + this._resync + ' ticks at ' + this._rate + ' steps a tick, '
            + gaps.path.length + ' starts)\n'
            + '  path:    ' + stat(gaps.path, 1, 'm') + ' (worst from tick ' + worst.at + ')\n'
            + '  heading: ' + stat(gaps.heading, 1, '°') + ' (worst from tick ' + worstTurn.at + ')\n'
            + '  speed:   ' + stat(gaps.speed, 100, '%') + '\n');

        return 0;
    }

    // The variable step physics over the h ticks after t: n steps a tick, or steps of s ticks across the boundaries.
    _runSteps(physics, ticks, t) {
        if (this._step <= 0) {
            for (let k = 1; k <= this._resync; k++) {
                const input = this._input(ticks[t + k]);
                for (let r = 0; r < this._rate; r++) {
                    physics.step(((r === 0) ? input : {...input, gearUp: false, gearDown: false}), (1 / this._rate));
                }
            }
            return;
        }
        let time    = 0;
        let pressed = 0;
        while (time < (this._resync - 1e-9)) {
            const k     = Math.min((Math.floor(time + 1e-9) + 1), this._resync);
            const input = this._input(ticks[t + k]);
            const dt    = Math.min(this._step, (this._resync - time));
            physics.step(((k !== pressed) ? input : {...input, gearUp: false, gearDown: false}), dt);
            pressed = k;
            time   += dt;
        }
    }

    // The watched fields of a run from the traced tick t, at 1 and at n steps a tick, next to the trace.
    _traceRun(Physics, car, gearbox, course, ticks, t) {
        const Reference = vm.runInContext('RacingCarPhysics', this._ctx);
        const runs = [0, 1, ((this._step > 0) ? PhysicsComparator.BY_STEP : this._rate)].map((rate) => {
            const physics = new (((rate === 0) ? Reference : Physics))(this._physics, car, (gearbox === 'manual'), course);
            this._load(physics, ticks[t].frame);
            physics.settle();
            this._load(physics, ticks[t].frame);
            const rows = [];
            // The last run takes the steps of --step when given, its rows read at the end of each tick.
            if (rate === PhysicsComparator.BY_STEP) {
                const saved = this._resync;
                for (let k = 1; k <= saved; k++) {
                    this._resync = k;
                    const run = new Physics(this._physics, car, (gearbox === 'manual'), course);
                    this._load(run, ticks[t].frame);
                    run.settle();
                    this._load(run, ticks[t].frame);
                    this._runSteps(run, ticks, t);
                    rows.push(this._watch.map((name) => this._get(run, name)));
                }
                this._resync = saved;
                return rows;
            }
            for (let k = 1; k <= this._resync; k++) {
                const input = this._input(ticks[t + k]);
                if (rate === 0) {
                    physics.tick(input);
                }
                for (let r = 0; r < rate; r++) {
                    physics.step(((r === 0) ? input : {...input, gearUp: false, gearDown: false}), (1 / rate));
                    if ((rate > 1) && (k === 1)) {
                        process.stdout.write('    step ' + (r + 1) + ': ' + this._watch.map((name) => name + ' ' + Math.round(this._get(physics, name))).join(', ') + '\n');
                    }
                }
                rows.push(this._watch.map((name) => this._get(physics, name)));
            }
            return rows;
        });
        for (let k = 1; k <= this._resync; k++) {
            const traced = this._watch.map((name) => this._read(ticks[t + k].frame, FIELDS.find((f) => (f[0] === name))));
            process.stdout.write('  +' + k + ' (' + ticks[t + k].buttons + ') ' + this._watch.map((name, i) => name + ' ' + traced[i] + ' / '
                + runs.map((rows) => Math.round(rows[k - 1][i])).join(' / ')).join(', ') + '\n');
        }
    }

    // Free run of the variable step physics. Its integration runs up to a tick ahead of the original's sampling,
    // a few metres at speed: the path is measured as the distance to the traced path (a few ticks around), the
    // speed as a relative gap to the range of the traced speeds of the tick and its neighbours.
    _drift(name, car, gearbox, courseCode, course, ticks) {
        const Physics = vm.runInContext('RacingCarContinuousPhysics', this._ctx);
        const start   = (frame) => {
            const run = new Physics(this._physics, car, (gearbox === 'manual'), course);
            this._load(run, frame);
            run.settle();
            this._load(run, frame);
            return run;
        };
        let physics = start(ticks[0].frame);
        const field = (n) => FIELDS.find((f) => (f[0] === n));
        const traced = ticks.map((tick) => [this._read(tick.frame, field('x')), this._read(tick.frame, field('z'))]);
        let event   = null;
        let gap     = 0;
        let speed   = 0;
        // The original reads the pad at its tick: the new input acts on the last step before it.
        let previous = {accelerate: false, brake: false, steer: 0, gearUp: false, gearDown: false};
        for (let t = 1; t < ticks.length; t++) {
            const input = this._input(ticks[t]);
            // A car placed by the scenario (poke): the run starts again from the traced state.
            if (ticks[t].poked || ticks[t - 1].poked) {
                physics  = start(ticks[t].frame);
                previous = input;
                continue;
            }
            for (let r = 0; r < this._rate; r++) {
                physics.step(((r === (this._rate - 1)) ? input : {...previous, gearUp: false, gearDown: false}), (1 / this._rate));
            }
            previous = input;
            if ((event === null) && this._eventAt(ticks[t].frame)) {
                event = t;
            }
            if (event !== null) {
                continue;
            }
            gap = Math.max(gap, (this._pathDistance(traced, t, physics.x, physics.z) / UNITS_PER_METRE));
            const expected = this._read(ticks[t].frame, field('speed'));
            if (expected > DRIFT_SPEED_FLOOR) {
                const near = ticks.slice(Math.max(0, (t - 1)), (t + 2)).map((tick) => this._read(tick.frame, field('speed')));
                const low  = Math.min(...near);
                const high = Math.max(...near);
                const off  = ((physics.speed < low) ? (low - physics.speed) : ((physics.speed > high) ? (physics.speed - high) : 0));
                speed = Math.max(speed, (off / expected));
            }
        }
        // After a wall or a carrying back, a slightly different arrival makes another path: measured until then.
        const failed = ((gap > PATH_TOLERANCE_METRES) || (speed > SPEED_TOLERANCE));
        process.stdout.write(name + ' (' + car + ', ' + gearbox + ', ' + courseCode + ', ' + this._rate + ' steps a tick'
            + ((event !== null) ? ', until the wall at tick ' + event : '') + '): path ' + gap.toFixed(2) + ' m, speed '
            + (speed * 100).toFixed(1) + ' %' + (failed ? ' — over ' + PATH_TOLERANCE_METRES + ' m / ' + (SPEED_TOLERANCE * 100) + ' %' : '') + '\n');

        return (failed ? 1 : 0);
    }

    // Distance to the traced path, its segments a few ticks around the given one.
    _pathDistance(path, t, x, z) {
        let best = Infinity;
        for (let i = Math.max(0, (t - PATH_WINDOW)); i < Math.min((path.length - 1), (t + PATH_WINDOW)); i++) {
            const [ax, az] = path[i];
            const [bx, bz] = path[i + 1];
            const length   = (((bx - ax) * (bx - ax)) + ((bz - az) * (bz - az)));
            const share    = ((length === 0) ? 0 : Math.min(1, Math.max(0, ((((x - ax) * (bx - ax)) + ((z - az) * (bz - az))) / length))));
            best = Math.min(best, Math.hypot((x - (ax + ((bx - ax) * share))), (z - (az + ((bz - az) * share)))));
        }
        return best;
    }

    // A wall touched, a deflection, a getting back or a carrying back in the trace.
    _eventAt(frame) {
        const value = (name) => this._read(frame, FIELDS.find((field) => (field[0] === name)));

        // A pit stop drives the car by its own rules: measured too.
        const mode = value('mode');

        return (((value('probeFlags') & 1) !== 0) || (value('wallTimer') !== 0) || (value('backOnTrack') !== 0) || ((mode !== 0) && (mode !== MODE_PIT))
            || (value('crashRecovery') !== 0));
    }

    _asset(file) {
        return JSON.parse(fs.readFileSync(path.join(WEBSITE_DIR, 'assets', 'virtual_racing', file), 'utf8'));
    }

    _get(physics, field) {
        return field.split('.').reduce((object, key) => object[key], physics);
    }

    _set(physics, field, value) {
        const keys = field.split('.');
        const last = keys.pop();
        keys.reduce((object, key) => object[key], physics)[last] = value;
    }

    // A tick may be caught half done by the frame dump: its state is the last frame before the counter moves
    // again. A press counts when the button went down since the first frame of the previous tick.
    // The counter stops during the camera transitions while the ticks go on: the comparison ends there.
    _tickFrames(frames) {
        const ticks = [];
        let current = null;
        for (let index = 0; index < frames.length; index++) {
            const frame   = frames[index];
            const counter = this._word(frame, TICK_COUNTER.block, TICK_COUNTER.offset);
            if ((current !== null) && (counter === current.counter) && ((index - current.start) > MAX_TICK_FRAMES)) {
                ticks.lost = frame.frame;
                ticks.pop();
                break;
            }
            if ((current === null) || (counter !== current.counter)) {
                const since = ((current === null) ? index : (current.start + 1));
                current = {counter, frame, start: index, buttons: frame.buttons, presses: this._presses(frames, since, index), poked: false};
                ticks.push(current);
            }
            current.frame  = frame;
            current.poked ||= (frame.poked === true);
        }
        return ticks;
    }

    _presses(frames, from, to) {
        const presses = new Set();
        for (let i = Math.max(from, 1); i <= to; i++) {
            const before = frames[i - 1].buttons.split('+');
            for (const button of frames[i].buttons.split('+')) {
                if (!before.includes(button)) {
                    presses.add(button);
                }
            }
        }
        return presses;
    }

    // Held buttons: the copy of the pad the steering makes for the tick ($C300); presses: since the previous tick.
    _input(tick) {
        const held = parseInt(tick.frame.blocks.FFC300.substr(0, 2), 16);
        const bit  = (n) => ((held & (1 << n)) !== 0);
        return {
            accelerate: bit(PAD_ACCELERATE),
            brake:      bit(PAD_BRAKE),
            gearUp:     tick.presses.has('DOWN'),
            gearDown:   tick.presses.has('UP'),
            steer:      ((bit(PAD_LEFT) ? 1 : 0) - (bit(PAD_RIGHT) ? 1 : 0)),
        };
    }

    _load(physics, frame) {
        for (const field of FIELDS) {
            this._set(physics, field[0], this._read(frame, field));
        }
    }

    _read(frame, [, block, offset, bytes]) {
        if (bytes === 1) {
            return parseInt(frame.blocks[block].substr(offset * 2, 2), 16);
        }
        return this._word(frame, block, offset);
    }

    _word(frame, block, offset) {
        const value = parseInt(frame.blocks[block].substr(offset * 2, 4), 16);
        return ((value << 16) >> 16);
    }
}

// Run of the detailed view taking the steps of --step.
PhysicsComparator.BY_STEP = -1;

try {
    process.exitCode = ((new PhysicsComparator(process.argv.slice(2)).run() > 0) ? 1 : 0);
} catch (error) {
    process.stderr.write(String(error.stack ?? error) + '\n');
    process.exitCode = 1;
}

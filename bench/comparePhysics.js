#!/usr/bin/env node
/**
 * Compares RacingCarPhysics with the reference traces of the original game, run from the repository root:
 *
 *   node bench/comparePhysics.js [scenario...] [--ticks n]
 *   node bench/comparePhysics.js [scenario...] --continuous [--rate n]
 *   node bench/comparePhysics.js [scenario...] --resync h [--rate n | --step s]
 *   node bench/comparePhysics.js scenario --watch field,field --show from-to
 *
 * Without a scenario, every one but the camera references (NOT_PHYSICS) and the races traced from their loading
 * (bench/compareRace.js).
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
const {BenchTrace}    = require('./benchTrace');

const ROOT_DIR     = path.resolve(__dirname, '..');
const WEBSITE_DIR  = path.join(ROOT_DIR, 'website');
// Recorded for the camera transitions (project notes race.md): the car waits on the grid.
const NOT_PHYSICS  = ['views', 'views_3button'];
const SOURCES      = ['js/racing/game/racingCourseCollision.js', 'js/racing/game/racingCarPhysics.js', 'js/racing/game/racingCarContinuousPhysics.js'];
// Fields set from the trace but not compared (driven by systems not ported).
const INPUT_ONLY = ['maxSpeed', 'speedState', 'raceFlags'];
// Variant of the pit stop ($C07A).
const MODE_PIT   = 4;
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
        const names = ((this._names.length > 0) ? this._names
            : BenchScenario.names().filter((name) => (!NOT_PHYSICS.includes(name) && !new BenchScenario(name).fromLoad)));
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
        const all    = BenchTrace.ticks(scenario.readTrace());
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
        BenchTrace.load(physics, ticks[0].frame);
        physics.settle();
        BenchTrace.load(physics, ticks[0].frame);
        const mismatches = new Map();
        for (let t = 1; t < ticks.length; t++) {
            // A car placed by the scenario (poke): the run starts again from the traced state.
            if (ticks[t].poked || ticks[t - 1].poked) {
                BenchTrace.load(physics, ticks[t].frame);
                physics.settle();
                BenchTrace.load(physics, ticks[t].frame);
                continue;
            }
            physics.tick(BenchTrace.input(ticks[t]));
            if ((t >= this._show[0]) && (t <= this._show[1])) {
                this._printWatch(physics, ticks[t], t);
            }
            for (const field of BenchTrace.FIELDS) {
                const expected = BenchTrace.read(ticks[t].frame, field);
                if (!INPUT_ONLY.includes(field[0]) && this._compared(field, physics, ticks, t) && (BenchTrace.get(physics, field[0]) !== expected)) {
                    const entry = mismatches.get(field[0]) ?? {count: 0, first: []};
                    mismatches.set(field[0], entry);
                    entry.count++;
                    if (entry.first.length < 3) {
                        entry.first.push('tick ' + t + ' (frame ' + ticks[t].frame.frame + ', ' + ticks[t].buttons + '): ' + BenchTrace.get(physics, field[0]) + ' != ' + expected);
                    }
                }
                BenchTrace.set(physics, field[0], expected);
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
        const state = BenchTrace.field('pitState');

        return ((BenchTrace.read(ticks[t].frame, state) !== 0) || (BenchTrace.read(ticks[t - 1].frame, state) !== 0) || (physics.pitCrewAway > 0));
    }

    _printWatch(physics, tick, t) {
        const values = this._watch.map((name) => {
            const field    = BenchTrace.field(name);
            const computed = BenchTrace.get(physics, name);
            const traced   = ((field === undefined) ? '?' : BenchTrace.read(tick.frame, field));

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
                BenchTrace.load(run, ticks[t].frame);
                run.settle();
                BenchTrace.load(run, ticks[t].frame);
            }
            // The input of a tick drives the whole tick, as the original reads the pad before computing it; a press
            // acts on its first step.
            for (let k = 1; k <= this._resync; k++) {
                reference.tick(BenchTrace.input(ticks[t + k]));
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
                const input = BenchTrace.input(ticks[t + k]);
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
            const input = BenchTrace.input(ticks[t + k]);
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
            BenchTrace.load(physics, ticks[t].frame);
            physics.settle();
            BenchTrace.load(physics, ticks[t].frame);
            const rows = [];
            // The last run takes the steps of --step when given, its rows read at the end of each tick.
            if (rate === PhysicsComparator.BY_STEP) {
                const saved = this._resync;
                for (let k = 1; k <= saved; k++) {
                    this._resync = k;
                    const run = new Physics(this._physics, car, (gearbox === 'manual'), course);
                    BenchTrace.load(run, ticks[t].frame);
                    run.settle();
                    BenchTrace.load(run, ticks[t].frame);
                    this._runSteps(run, ticks, t);
                    rows.push(this._watch.map((name) => BenchTrace.get(run, name)));
                }
                this._resync = saved;
                return rows;
            }
            for (let k = 1; k <= this._resync; k++) {
                const input = BenchTrace.input(ticks[t + k]);
                if (rate === 0) {
                    physics.tick(input);
                }
                for (let r = 0; r < rate; r++) {
                    physics.step(((r === 0) ? input : {...input, gearUp: false, gearDown: false}), (1 / rate));
                    if ((rate > 1) && (k === 1)) {
                        process.stdout.write('    step ' + (r + 1) + ': ' + this._watch.map((name) => name + ' ' + Math.round(BenchTrace.get(physics, name))).join(', ') + '\n');
                    }
                }
                rows.push(this._watch.map((name) => BenchTrace.get(physics, name)));
            }
            return rows;
        });
        for (let k = 1; k <= this._resync; k++) {
            const traced = this._watch.map((name) => BenchTrace.read(ticks[t + k].frame, BenchTrace.field(name)));
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
            BenchTrace.load(run, frame);
            run.settle();
            BenchTrace.load(run, frame);
            return run;
        };
        let physics = start(ticks[0].frame);
        const field = (n) => BenchTrace.field(n);
        const traced = ticks.map((tick) => [BenchTrace.read(tick.frame, field('x')), BenchTrace.read(tick.frame, field('z'))]);
        let event   = null;
        let gap     = 0;
        let speed   = 0;
        // The original reads the pad at its tick: the new input acts on the last step before it.
        let previous = {accelerate: false, brake: false, steer: 0, gearUp: false, gearDown: false};
        for (let t = 1; t < ticks.length; t++) {
            const input = BenchTrace.input(ticks[t]);
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
            const expected = BenchTrace.read(ticks[t].frame, field('speed'));
            if (expected > DRIFT_SPEED_FLOOR) {
                const near = ticks.slice(Math.max(0, (t - 1)), (t + 2)).map((tick) => BenchTrace.read(tick.frame, field('speed')));
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
        const value = (name) => BenchTrace.read(frame, BenchTrace.field(name));

        // A pit stop drives the car by its own rules: measured too.
        const mode = value('mode');

        return (((value('probeFlags') & 1) !== 0) || (value('wallTimer') !== 0) || (value('backOnTrack') !== 0) || ((mode !== 0) && (mode !== MODE_PIT))
            || (value('crashRecovery') !== 0));
    }

    _asset(file) {
        return JSON.parse(fs.readFileSync(path.join(WEBSITE_DIR, 'assets', 'virtual_racing', file), 'utf8'));
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

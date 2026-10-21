#!/usr/bin/env node
/**
 * Compares the cars of the 2 players VS mode with the original, tick by tick, run from the repository root:
 *
 *   node bench/compareCars.js [scenario...]
 *   node bench/compareCars.js scenario --show from-to
 *   node bench/compareCars.js --rate n
 *   node bench/compareCars.js --ranked
 *
 * Without a scenario, every two-player one ("setup two_players"). The original runs each player in its own phase of
 * the 3-frame cycle ($C87E: phase 4 the first car, $FF9000; phase 8 the second, $FF9F00, then the contact test $AF18)
 * and swaps the page of globals $C000-$C3FF between them. A tick starts at the end of the frame before its own: the
 * only frame that holds both cars whole is the one after the second car's tick and the contact ($C87E = 0 at its
 * end), with the first player's page. Each cycle both cars are loaded from that frame — the second car keeps the
 * globals the bench computed for it, never traced whole —, run the first car's tick, the second's, then
 * RacingCarPhysics.collide, and are compared, bit for bit, with the same frame of the next cycle. Pads: the first
 * player's copy ($C300) in its page at the end of the cycle, the second's from the buttons traced in the frame before
 * the first car's.
 *
 * --show prints the fields that differ, traced and computed, for the ticks ending in the range of frames.
 *
 * --rate n also runs each cycle with the variable step physics of the game (RacingCarContinuousPhysics), n steps a
 * tick for each car, the contact test at the end of the tick, and measures both cars against the exact ones: path,
 * heading, speed, and the ticks whose contact corners differ.
 *
 * --ranked runs the contacts of each cycle as the race of the game does (RacingSimulation.collideCars: the cars
 * ranked, the pairs within reach, the car ahead first): identical while the first player leads; the cycles where the
 * second leads, the original still testing it as the second car, are counted apart.
 */
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const {BenchScenario} = require('./benchScenario');
const {BenchTrace}    = require('./benchTrace');

const ROOT_DIR    = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT_DIR, 'website');
const SOURCES     = ['js/racing/game/racingCourseCollision.js', 'js/racing/game/racingCarPhysics.js', 'js/racing/game/racingCarContinuousPhysics.js',
    'js/racing/game/racingCommand.js', 'js/racing/game/racingSimulation.js'];
// Collision units: 1/16 m. Below the floor the relative speed gap means nothing (as comparePhysics).
const UNITS_PER_METRE   = 16;
const DRIFT_SPEED_FLOOR = 100;
const ENTITY     = 'FF9000';
const SECOND_CAR = 'FF9F00';
// $C87E at the end of a frame: the phase that runs next; 0 after the second car's tick, the frame holding both cars whole.
const PHASE = {block: 'FFC800', offset: 0x7E};
const WHOLE = 0;
// The second player's pad as its tick reads it: the buttons held in the frame before the first car's (its copy in its
// page is not traced whole: the tick starts at the end of the first car's frame, its steering run there or not).
const SECOND_PAD_FRAME = 1;
const SECOND_PAD       = '2.';
const CYCLE_FRAMES = 3;
// Fields set from the trace but not compared, as comparePhysics (driven by systems not ported).
const INPUT_ONLY = ['maxSpeed', 'speedState', 'raceFlags'];
// The contact corners (+$88), besides the fields of BenchTrace.
const CONTACT = ['contact', ENTITY, 0x88, 2];

class CarsComparator {
    constructor(args) {
        this._show   = (args.includes('--show') ? args[args.indexOf('--show') + 1].split('-').map(Number) : null);
        this._rate   = (args.includes('--rate') ? Number(args[args.indexOf('--rate') + 1]) : 0);
        this._ranked = args.includes('--ranked');
        this._names  = args.filter((arg, i) => (!arg.startsWith('--') && !['--show', '--rate'].includes(args[i - 1])));
        this._ctx    = vm.createContext({console, Math});
        for (const file of SOURCES) {
            vm.runInContext(fs.readFileSync(path.join(WEBSITE_DIR, file), 'utf8'), this._ctx, {filename: file});
        }
        this._Physics    = vm.runInContext('RacingCarPhysics', this._ctx);
        this._Continuous = vm.runInContext('RacingCarContinuousPhysics', this._ctx);
        this._Collision  = vm.runInContext('RacingCourseCollision', this._ctx);
        this._Simulation = vm.runInContext('RacingSimulation', this._ctx);
        this._physics    = this._asset('physics.json');
        this._race       = this._asset('race.json');
        this._fields     = [...BenchTrace.FIELDS.filter((field) => !INPUT_ONLY.includes(field[0])), CONTACT];
    }

    run() {
        const names = ((this._names.length > 0) ? this._names : BenchScenario.names().filter((name) => (new BenchScenario(name).players === 2)));
        let failures = 0;
        for (const name of names) {
            failures += this._compare(new BenchScenario(name));
        }
        return failures;
    }

    _compare(scenario) {
        const frames = scenario.readTrace();
        const course = {
            index:     BenchScenario.COURSES.indexOf(scenario.course),
            collision: new this._Collision(this._asset('courses/' + scenario.course + '.json').collision),
            ...this._race.courses[scenario.course],
            pit:       this._Physics.coursePit(this._race, scenario.course),
        };
        const whole = frames.map((frame, i) => i).filter((i) => (BenchTrace.word(frames[i], PHASE.block, PHASE.offset) === WHOLE));
        const differences = new Map();   // field → [count, first frame]
        const gaps        = {path: [], heading: [], speed: [], contacts: 0};
        let second = null;
        let ticks  = 0;
        let led    = 0;     // cycles of contact the second car leads (--ranked)
        for (let k = 0; (k + 1) < whole.length; k++) {
            const from = whole[k];
            // A cycle with a poke (cars placed by the scenario) starts again from the traced state.
            const poked = frames.slice(from + 1, (from + CYCLE_FRAMES + 1)).some((frame) => (frame.poked === true));
            if (((whole[k + 1] - from) !== CYCLE_FRAMES) || poked) {
                second = null;
                continue;
            }
            const first = this._load(this._Physics, scenario.car, scenario.transmission, course, frames[from], ENTITY);
            second      = ((second === null) ? this._load(this._Physics, scenario.car, scenario.transmission2, course, frames[from], SECOND_CAR)
                : this._reloadEntity(second, frames[from]));
            const inputs = [BenchTrace.input({frame: frames[from + CYCLE_FRAMES], presses: new Set()}), CarsComparator._secondInput(frames[from + SECOND_PAD_FRAME])];
            const steps  = ((this._rate > 0) ? this._stepped(scenario, course, frames[from], second, inputs) : null);
            first.tick(inputs[0]);
            second.tick(inputs[1]);
            if (this._ranked) {
                const secondAhead = (this._Simulation.rankOrder(first, second) > 0);
                this._Simulation.collideCars([first, second]);
                if (secondAhead && ((first.contact !== 0) || (second.contact !== 0))) {
                    led++;
                }
            } else {
                this._Physics.collide(first, second);
            }
            if (steps !== null) {
                this._measure(gaps, steps, [first, second]);
            }
            ticks++;
            const to    = frames[from + CYCLE_FRAMES];
            const found = [
                ...this._differences(first, to, ENTITY, true).map(([field, ...values]) => ['first.' + field, ...values]),
                ...this._differences(second, to, SECOND_CAR, false).map(([field, ...values]) => ['second.' + field, ...values]),
            ];
            for (const [field, traced, computed] of found) {
                const entry = (differences.get(field) ?? [0, to.frame]);
                entry[0]++;
                differences.set(field, entry);
                if ((this._show !== null) && (to.frame >= this._show[0]) && (to.frame <= this._show[1])) {
                    process.stdout.write('  frame ' + to.frame + ' ' + field + ': ' + traced + ' / ' + computed + '\n');
                }
            }
        }
        if (this._rate > 0) {
            this._report(scenario, gaps);
        }
        const head = scenario.name + ' (' + scenario.car + ', ' + scenario.course + ', ' + ticks + ' ticks'
            + ((this._ranked) ? (', ' + led + ' with the second car leading in contact') : '') + '): ';
        if (differences.size === 0) {
            process.stdout.write(head + 'identical\n');
            return 0;
        }
        process.stdout.write(head + Array.from(differences, ([field, [count, first]]) => field + ' ' + count + ' (first frame ' + first + ')').join(', ') + '\n');
        return 1;
    }

    // Both cars of the cycle with the variable step physics: n steps a tick each, then the contact test; the second
    // car's globals those of the exact one before its tick.
    _stepped(scenario, course, frame, exactSecond, inputs) {
        const cars = [
            this._load(this._Continuous, scenario.car, scenario.transmission, course, frame, ENTITY),
            this._load(this._Continuous, scenario.car, scenario.transmission2, course, frame, SECOND_CAR),
        ];
        for (const field of this._fields.filter((candidate) => (candidate[1] !== ENTITY))) {
            BenchTrace.set(cars[1], field[0], BenchTrace.get(exactSecond, field[0]));
        }
        cars.forEach((car, i) => {
            for (let r = 0; r < this._rate; r++) {
                car.step(((r === 0) ? inputs[i] : {...inputs[i], gearUp: false, gearDown: false}), (1 / this._rate));
            }
        });
        this._Physics.collide(cars[0], cars[1]);

        return cars;
    }

    _measure(gaps, stepped, exact) {
        stepped.forEach((car, i) => {
            gaps.path.push(Math.hypot((car.x - exact[i].x), (car.z - exact[i].z)) / UNITS_PER_METRE);
            gaps.heading.push(BenchTrace.headingGap(car.heading, exact[i].heading));
            gaps.speed.push(Math.abs(car.speed - exact[i].speed) / Math.max(exact[i].speed, DRIFT_SPEED_FLOOR));
            if (car.contact !== exact[i].contact) {
                gaps.contacts++;
            }
        });
    }

    _report(scenario, gaps) {
        process.stdout.write(scenario.name + ' at ' + this._rate + ' steps a tick, both cars: path ' + BenchTrace.spread(gaps.path, 1, 'm')
            + '; heading ' + BenchTrace.spread(gaps.heading, 1, '°') + '; speed ' + BenchTrace.spread(gaps.speed, 100, '%')
            + '; contacts differing ' + gaps.contacts + '\n');
    }

    // A car loaded from a frame: its entity block, the page of globals of the frame (the first player's).
    _load(Physics, car, transmission, course, frame, block) {
        const physics = new Physics(this._physics, car, (transmission === 'manual'), course);
        const view    = CarsComparator._view(frame, block);
        BenchTrace.load(physics, view);
        physics.settle();
        BenchTrace.load(physics, view);
        physics.contact = BenchTrace.read(view, CONTACT);

        return physics;
    }

    // The second car's entity from the frame, its globals and the polygons under its probes kept from its last tick, as
    // the original keeps them.
    _reloadEntity(physics, frame) {
        const view    = CarsComparator._view(frame, SECOND_CAR);
        const globals = this._fields.filter((field) => (field[1] !== ENTITY)).map((field) => [field[0], BenchTrace.get(physics, field[0])]);
        BenchTrace.load(physics, view);
        physics.contact = BenchTrace.read(view, CONTACT);
        for (const [name, value] of globals) {
            BenchTrace.set(physics, name, value);
        }

        return physics;
    }

    /**
     * @param {boolean} withGlobals - the frame's page of globals is this car's
     * @returns {Array} [field, traced, computed] of each field that differs
     */
    _differences(physics, frame, block, withGlobals) {
        const view  = CarsComparator._view(frame, block);
        const found = [];
        for (const field of this._fields) {
            if (!withGlobals && (field[1] !== ENTITY)) {
                continue;
            }
            const traced   = BenchTrace.read(view, field);
            const computed = BenchTrace.get(physics, field[0]);
            if (traced !== CarsComparator._traced(computed, field[3])) {
                found.push([field[0], traced, computed]);
            }
        }

        return found;
    }

    // The second player's buttons ('2.' prefixed) of a frame, as the steering reads them (+1 left).
    static _secondInput(frame) {
        const held = new Set(frame.buttons.split('+').filter((button) => button.startsWith(SECOND_PAD)).map((button) => button.substring(SECOND_PAD.length)));

        return {
            accelerate: held.has('B'),
            brake:      held.has('A'),
            gearUp:     false,
            gearDown:   false,
            steer:      ((held.has('LEFT') ? 1 : 0) - (held.has('RIGHT') ? 1 : 0)),
        };
    }

    // The traced form of a value: a signed word, or a byte.
    static _traced(value, bytes) {
        return ((bytes === 1) ? (value & 0xFF) : ((value << 16) >> 16));
    }

    // A frame seen as the first car's: the entity block of the car.
    static _view(frame, block) {
        return {...frame, blocks: {...frame.blocks, [ENTITY]: frame.blocks[block]}};
    }

    _asset(file) {
        return JSON.parse(fs.readFileSync(path.join(WEBSITE_DIR, 'assets', 'virtual_racing', file), 'utf8'));
    }
}

if (require.main === module) {
    process.exitCode = ((new CarsComparator(process.argv.slice(2)).run() > 0) ? 1 : 0);
}

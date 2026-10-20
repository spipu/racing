#!/usr/bin/env node
/**
 * Records the reference traces of Virtua Racing Deluxe (USA), run from the repository root:
 *
 *   node bench/recordTraces.js                every scenario of bench/scenarios/
 *   node bench/recordTraces.js wall           one scenario
 *   node bench/recordTraces.js --shots        also writes a screenshot after each setup (.tmp.claude/traces/)
 *
 * The setup line of a scenario (BenchScenario) is expanded into the Time Attack menu navigation, or the 2 players VS
 * one; the rest is passed as is to bench/recorder/vrTraceRecorder (frame count + buttons).
 * Each trace is written to bench/traces/<scenario>.jsonl.gz: one JSON line per frame from the race start.
 */
const childProcess = require('child_process');
const crypto       = require('crypto');
const fs           = require('fs');
const path         = require('path');
const zlib         = require('zlib');

const {BenchScenario} = require('./benchScenario');

const ROOT_DIR      = path.resolve(__dirname, '..');
const ROM_PATH      = path.join(ROOT_DIR, '.source', 'Virtua Racing Deluxe (USA).32x');
const ROM_MD5       = '72b1ad0f949f68da7d0a6339ecd51a3f';
const CORE_PATH     = path.join(ROOT_DIR, '.source', 'picodrive', 'picodrive_libretro.so');
const RECORDER_DIR  = path.join(__dirname, 'recorder');
const RECORDER_PATH = path.join(RECORDER_DIR, 'vrTraceRecorder');
const WORK_DIR      = path.join(ROOT_DIR, '.tmp.claude', 'traces');

const RAM_BLOCKS   = ['block FF9000 256', 'block FFC000 256', 'block FFC300 64'];
// Two players: the second car's entity, and the race variables ($C87E: the phase of the frame cycle that runs next).
const TWO_PLAYERS_BLOCKS = ['block FF9F00 256', 'block FFC800 256'];

const PRESS_FRAMES  = 5;
const SCREEN_WAIT   = 120;
const CURSOR_WAIT   = 40;
const BOOT_WAIT     = 600;
const GRID_WAIT     = 600;
// The 2 players VS entry of MODE SELECT, after Virtua Racing and Time Attack.
const TWO_PLAYERS_MODE = 2;
const BOTH_PADS_START  = 'START+2.START';

class TraceRecorder {
    constructor(args) {
        this._shots = args.includes('--shots');
        this._names = args.filter((arg) => !arg.startsWith('--'));
    }

    run() {
        this.checkRom();
        childProcess.execFileSync(path.join(RECORDER_DIR, 'build.sh'), {stdio: 'inherit'});
        fs.mkdirSync(BenchScenario.TRACE_DIR, {recursive: true});
        fs.mkdirSync(WORK_DIR, {recursive: true});

        const names = ((this._names.length > 0) ? this._names : BenchScenario.names());
        for (const name of names) {
            this._record(new BenchScenario(name));
        }
    }

    checkRom() {
        if (!fs.existsSync(ROM_PATH)) {
            throw new Error('missing ROM: ' + ROM_PATH);
        }
        const md5 = crypto.createHash('md5').update(fs.readFileSync(ROM_PATH)).digest('hex');
        if (md5 !== ROM_MD5) {
            throw new Error('unexpected ROM MD5 ' + md5 + ', expected ' + ROM_MD5);
        }
    }

    _record(scenario) {
        const name      = scenario.name;
        const blocks    = [...RAM_BLOCKS, ...((scenario.players === 2) ? TWO_PLAYERS_BLOCKS : [])];
        const input     = [...blocks, ...scenario.recorderLines(this._setupLines(scenario))].join('\n') + '\n';
        const workTrace = path.join(WORK_DIR, name + '.jsonl');
        const args      = [CORE_PATH, ROM_PATH, '-', workTrace];
        if (this._shots) {
            args.push(WORK_DIR);
        }
        const env = {...process.env, VR_RECORDER_PAD: scenario.pad};
        childProcess.execFileSync(RECORDER_PATH, args, {input, env, stdio: ['pipe', 'ignore', 'pipe']});

        const trace = fs.readFileSync(workTrace);
        fs.writeFileSync(scenario.getTracePath(), zlib.gzipSync(trace, {level: 9}));
        fs.unlinkSync(workTrace);
        const frames = trace.toString('utf8').split('\n').filter((line) => (line !== '')).length;
        process.stdout.write(name + ': ' + frames + ' frames\n');
    }

    // The Time Attack menu navigation to the car, transmission and course, then the recording: from the grid after the
    // start, or as the race loads.
    _setupLines(scenario) {
        const menu = this.menuInputs(scenario);
        if (scenario.fromLoad) {
            menu.pop();
        }
        if (this._shots) {
            menu.push('shot ' + scenario.name);
        }

        return [...menu, 'record'];
    }

    // Time Attack menu navigation of a setup ({car, transmission, course}), up to the start grid.
    menuInputs(scenario) {
        if (scenario.players === 2) {
            return this._twoPlayersInputs(scenario);
        }
        const press  = TraceRecorder._press;
        const inputs = TraceRecorder._titleInputs();
        inputs.push(...press('RIGHT', CURSOR_WAIT), ...press('START', SCREEN_WAIT), SCREEN_WAIT + ' -');
        inputs.push(...TraceRecorder._rights(BenchScenario.CARS.indexOf(scenario.car)));
        if (scenario.transmission === 'manual') {
            inputs.push(...press('DOWN', CURSOR_WAIT), ...press('RIGHT', CURSOR_WAIT));
        }
        inputs.push(...press('START', SCREEN_WAIT), SCREEN_WAIT + ' -');
        inputs.push(...TraceRecorder._rights(BenchScenario.COURSES.indexOf(scenario.course)));
        inputs.push(...press('START', GRID_WAIT));
        return inputs;
    }

    // 2 players VS menu navigation, each screen validated by both pads, up to the start grid: validating the course
    // starts the race. The transmission and handicap lines stay at their defaults (automatic, 3).
    _twoPlayersInputs(scenario) {
        if ((scenario.transmission !== 'automatic') || (scenario.transmission2 !== 'automatic')) {
            throw new Error(scenario.name + ': the 2 players menu navigation only sets the automatic transmissions');
        }
        const press  = TraceRecorder._press;
        const inputs = TraceRecorder._titleInputs();
        inputs.push(...TraceRecorder._rights(TWO_PLAYERS_MODE), ...press(BOTH_PADS_START, SCREEN_WAIT), SCREEN_WAIT + ' -');
        inputs.push(...TraceRecorder._rights(BenchScenario.CARS.indexOf(scenario.car)), ...press(BOTH_PADS_START, SCREEN_WAIT), SCREEN_WAIT + ' -');
        inputs.push(...TraceRecorder._rights(BenchScenario.COURSES.indexOf(scenario.course)), ...press(BOTH_PADS_START, GRID_WAIT));
        return inputs;
    }

    // From the boot to MODE SELECT.
    static _titleInputs() {
        const press = TraceRecorder._press;
        return [BOOT_WAIT + ' -', ...press('START', SCREEN_WAIT), ...press('START', SCREEN_WAIT), ...press('START', SCREEN_WAIT)];
    }

    static _press(button, wait) {
        return [PRESS_FRAMES + ' ' + button, wait + ' -'];
    }

    static _rights(count) {
        return Array.from({length: count}, () => TraceRecorder._press('RIGHT', CURSOR_WAIT)).flat();
    }
}

if (require.main === module) {
    try {
        new TraceRecorder(process.argv.slice(2)).run();
    } catch (error) {
        process.stderr.write(String(error.stack ?? error) + '\n');
        process.exitCode = 1;
    }
}

module.exports = {TraceRecorder, RECORDER_PATH, RECORDER_DIR, CORE_PATH, ROM_PATH};

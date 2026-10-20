const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

/**
 * A scenario of bench/scenarios/ and its trace in bench/traces/. The source starts with
 * "setup <car> <transmission> <course>" (Time Attack), or "setup two_players <car> <transmission> <transmission> <course>"
 * (the 2 players VS mode, a transmission by player, the second player's buttons prefixed "2."), and may hold:
 *   - "pad 3": a 3-button pad instead of the 6-button one;
 *   - "from load": the trace starts as the race loads, before its opening, instead of on the grid after the start;
 *   - "block <address> <bytes>": a RAM block traced besides the recorder's usual ones;
 *   - "autopilot <frames>": the car driven by the original's carrying back on track ($A470, +$92 and $C0AC poked every
 *     tick) at full throttle, along the racing line.
 * The other lines are the recorder's (frame count + buttons).
 */
class BenchScenario {
    /**
     * @param {string} name - file name without .txt
     */
    constructor(name) {
        const file = path.join(BenchScenario.SCENARIO_DIR, name + '.txt');
        if (!fs.existsSync(file)) {
            throw new Error('unknown scenario ' + name + ' (' + BenchScenario.names().join(', ') + ')');
        }
        this.name   = name;
        this.source = fs.readFileSync(file, 'utf8');
        const setup = this.source.match(/^\s*setup\s+(\S+)\s+(\S+)\s+(\S+)\s*$/m);
        const two   = this.source.match(/^\s*setup\s+two_players\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s*$/m);
        if ((setup === null) && (two === null)) {
            throw new Error(name + ': missing "setup <car> <transmission> <course>" or "setup two_players <car> <transmission> <transmission> <course>" line');
        }
        this.players = ((two !== null) ? 2 : 1);
        if (two !== null) {
            [, this.car, this.transmission, this.transmission2, this.course] = two;
        } else {
            [, this.car, this.transmission, this.course] = setup;
            this.transmission2 = null;
        }
        const transmissions = [this.transmission, this.transmission2].filter((transmission) => (transmission !== null));
        if (!BenchScenario.CARS.includes(this.car) || !transmissions.every((t) => BenchScenario.TRANSMISSIONS.includes(t)) || !BenchScenario.COURSES.includes(this.course)) {
            throw new Error(name + ': unknown setup ' + [this.car, ...transmissions, this.course].join(' '));
        }
        const pad = this.source.match(/^\s*pad\s+(\d+)\s*$/m);
        this.pad  = ((pad !== null) ? pad[1] : BenchScenario.DEFAULT_PAD);
        this.fromLoad = /^\s*from\s+load\s*$/m.test(this.source);
        this.blocks   = [...this.source.matchAll(/^\s*block\s+\S+\s+\S+\s*$/gm)].map((match) => match[0].trim());
    }

    /**
     * @returns {string[]} every scenario, sorted
     */
    static names() {
        return fs.readdirSync(BenchScenario.SCENARIO_DIR)
            .filter((file) => file.endsWith('.txt'))
            .map((file) => path.basename(file, '.txt'))
            .sort();
    }

    /**
     * @param {string[]} setupLines - recorder lines that replace the setup line
     * @returns {string[]} the recorder lines, the scenario's blocks first, the pad and from lines left out
     */
    recorderLines(setupLines) {
        const lines = this.source.split('\n')
            .filter((line) => !/^\s*(pad|from|block)\s/.test(line))
            .flatMap((line) => ((/^\s*setup\s/.test(line)) ? setupLines : this._expand(line)));

        return [...this.blocks, ...lines];
    }

    _expand(line) {
        const autopilot = line.match(/^\s*autopilot\s+(\d+)\s*$/);
        if (autopilot === null) {
            return [line];
        }
        const lines = [];
        for (let frames = 0; frames < Number(autopilot[1]); frames += BenchScenario.TICK_FRAMES) {
            lines.push(...BenchScenario.AUTOPILOT_POKES, BenchScenario.TICK_FRAMES + ' B');
        }

        return lines;
    }

    getTracePath() {
        return path.join(BenchScenario.TRACE_DIR, this.name + '.jsonl.gz');
    }

    /**
     * @returns {object[]} one object per traced frame
     */
    readTrace() {
        return zlib.gunzipSync(fs.readFileSync(this.getTracePath())).toString('utf8')
            .split('\n').filter((line) => (line !== '')).map((line) => JSON.parse(line));
    }
}

BenchScenario.SCENARIO_DIR  = path.join(__dirname, 'scenarios');
BenchScenario.TRACE_DIR     = path.join(__dirname, 'traces');
BenchScenario.CARS          = ['formula', 'stock', 'prototype'];
BenchScenario.TRANSMISSIONS = ['automatic', 'manual'];
// In the order of the original's course tables.
BenchScenario.COURSES       = ['big_forest', 'bay_bridge', 'acropolis', 'highland', 'sand_park'];
BenchScenario.DEFAULT_PAD   = '6';
BenchScenario.TICK_FRAMES   = 3;
// The carrying back on track for 40 ticks, the throttle gate open.
BenchScenario.AUTOPILOT_POKES = ['poke FF9092 0028', 'poke FFC0AC 0100'];

module.exports = {BenchScenario};

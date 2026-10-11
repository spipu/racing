const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

/**
 * A scenario of bench/scenarios/ and its trace in bench/traces/. The source starts with
 * "setup <car> <transmission> <course>" and may hold a "pad 3" line (3-button pad instead of the 6-button one);
 * the other lines are the recorder's (frame count + buttons).
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
        if (setup === null) {
            throw new Error(name + ': missing "setup <car> <transmission> <course>" line');
        }
        [, this.car, this.transmission, this.course] = setup;
        if (!BenchScenario.CARS.includes(this.car) || !BenchScenario.TRANSMISSIONS.includes(this.transmission) || !BenchScenario.COURSES.includes(this.course)) {
            throw new Error(name + ': unknown setup ' + [this.car, this.transmission, this.course].join(' '));
        }
        const pad = this.source.match(/^\s*pad\s+(\d+)\s*$/m);
        this.pad  = ((pad !== null) ? pad[1] : BenchScenario.DEFAULT_PAD);
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
     * @returns {string[]} the recorder lines, the pad line left out
     */
    recorderLines(setupLines) {
        return this.source.split('\n')
            .filter((line) => !/^\s*pad\s/.test(line))
            .flatMap((line) => ((/^\s*setup\s/.test(line)) ? setupLines : [line]));
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

module.exports = {BenchScenario};

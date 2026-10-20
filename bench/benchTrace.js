/**
 * A reference trace read tick by tick: the frames of each tick of the original, its pad input, and the RAM fields
 * of the car's physics (RacingCarPhysics) read from it or loaded into it.
 */
class BenchTrace {
    /**
     * A tick may be caught half done by the frame dump: its state is the last frame before the counter moves
     * again. A press counts when the button went down since the first frame of the previous tick.
     * The counter stops during the camera transitions while the ticks go on: the ticks end there (ticks.lost).
     *
     * @param {object[]} frames - the traced frames
     * @returns {object[]} {counter, frame, start, buttons, presses, poked} by tick
     */
    static ticks(frames) {
        const ticks = [];
        let current = null;
        for (let index = 0; index < frames.length; index++) {
            const frame   = frames[index];
            const counter = BenchTrace.word(frame, BenchTrace.TICK_COUNTER.block, BenchTrace.TICK_COUNTER.offset);
            if ((current !== null) && (counter === current.counter) && ((index - current.start) > BenchTrace.MAX_TICK_FRAMES)) {
                ticks.lost = frame.frame;
                ticks.pop();
                break;
            }
            if ((current === null) || (counter !== current.counter)) {
                const since = ((current === null) ? index : (current.start + 1));
                current = {counter, frame, start: index, buttons: frame.buttons, presses: BenchTrace._presses(frames, since, index), poked: false};
                ticks.push(current);
            }
            current.frame  = frame;
            current.poked ||= (frame.poked === true);
        }
        return ticks;
    }

    static _presses(frames, from, to) {
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
    static input(tick) {
        const held = parseInt(tick.frame.blocks.FFC300.substr(0, 2), 16);
        const bit  = (n) => ((held & (1 << n)) !== 0);
        return {
            accelerate: bit(BenchTrace.PAD_ACCELERATE),
            brake:      bit(BenchTrace.PAD_BRAKE),
            gearUp:     tick.presses.has('DOWN'),
            gearDown:   tick.presses.has('UP'),
            steer:      ((bit(BenchTrace.PAD_LEFT) ? 1 : 0) - (bit(BenchTrace.PAD_RIGHT) ? 1 : 0)),
        };
    }

    static field(name) {
        return BenchTrace.FIELDS.find((field) => (field[0] === name));
    }

    static load(physics, frame) {
        for (const field of BenchTrace.FIELDS) {
            BenchTrace.set(physics, field[0], BenchTrace.read(frame, field));
        }
    }

    static read(frame, [, block, offset, bytes]) {
        if (bytes === 1) {
            return parseInt(frame.blocks[block].substr(offset * 2, 2), 16);
        }
        return BenchTrace.word(frame, block, offset);
    }

    // A signed word of a block.
    static word(frame, block, offset) {
        const value = parseInt(frame.blocks[block].substr(offset * 2, 4), 16);
        return ((value << 16) >> 16);
    }

    static get(object, field) {
        return field.split('.').reduce((value, key) => value[key], object);
    }

    static set(object, field, value) {
        const keys = field.split('.');
        const last = keys.pop();
        keys.reduce((parent, key) => parent[key], object)[last] = value;
    }

    /**
     * @returns {number} the turn from one heading to the other, in degrees, the shorter way
     */
    static headingGap(heading, reference) {
        const turns = BenchTrace.ANGLE_UNITS;
        const turn  = ((((heading - reference) % turns) + (turns * 1.5)) % turns) - (turns / 2);

        return Math.abs((turn * 360) / turns);
    }

    /**
     * @returns {string} the median, 95th percentile and worst of the gaps measured, scaled, in the unit
     */
    static spread(values, scale, unit) {
        const sorted = values.slice().sort((a, b) => (a - b));
        const at     = (share) => (sorted[Math.min((sorted.length - 1), Math.floor(share * sorted.length))] * scale);

        return 'median ' + at(0.5).toFixed(2) + ', 95 % ' + at(0.95).toFixed(2) + ', max ' + at(1).toFixed(2) + ' ' + unit;
    }
}

BenchTrace.TICK_COUNTER    = {block: 'FFC000', offset: 0xA4};
BenchTrace.MAX_TICK_FRAMES = 5;
// Heading units in a turn.
BenchTrace.ANGLE_UNITS     = 65536;
// Bits of the pad copy $C300.
BenchTrace.PAD_LEFT        = 2;
BenchTrace.PAD_RIGHT       = 3;
BenchTrace.PAD_ACCELERATE  = 4;
BenchTrace.PAD_BRAKE       = 6;
// Physics field (index for an array) -> traced RAM: block, offset, bytes.
BenchTrace.FIELDS = [
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

module.exports = {BenchTrace};

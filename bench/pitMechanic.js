#!/usr/bin/env node
/**
 * Measures the speed jumps of the pit mechanic's clips against their goldens, run from the repository root:
 *
 *   node bench/pitMechanic.js [--update]
 *
 * Reads website/assets/virtual_racing/models/pit_mechanic.gltf with the engine's GltfParser (vm context, as the
 * browser loads it), then samples each clip every 0.1 ms in double precision (a pose stores float32, whose rounding
 * alone would look like jumps at this step): every joint and every socket (where the objects are held) in the model's
 * space, by the engine's own Mat4. For each, the speed of its position (m/s) and of its axes (rad/s), and the largest
 * change of these speeds from one sample to the next; an object laid stands still, and the transitions that take and
 * lay one are checked by the engine's bench (3d-engine, bench/animation.js).
 *
 * A clip passes when its largest changes stay within its goldens (bench/goldens/pit_mechanic.json, the values seen
 * smooth on screen when the model was made) and below the smoothness bound of the engine's bench. --update writes the
 * goldens again: only for a wanted change of the model, explained. Exits with 1 on a failure.
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT_DIR    = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT_DIR, 'website');
const MODEL_FILE  = path.join(WEBSITE_DIR, 'assets/virtual_racing/models/pit_mechanic.gltf');
const GOLDEN_FILE = path.join(__dirname, 'goldens/pit_mechanic.json');
const SOURCES     = [
    'js/engine/entity/abstractLoadedEntity.js',
    'js/engine/matrix.js',
    'js/engine/animation/mat4.js',
    'js/engine/animation/quaternion.js',
    'js/engine/animation/skeleton.js',
    'js/engine/animation/skeletonPose.js',
    'js/engine/animation/animationSampler.js',
    'js/engine/animation/animationChannel.js',
    'js/engine/animation/animationEvent.js',
    'js/engine/animation/animationClip.js',
    'js/engine/animation/skeletonSocket.js',
    'js/engine/model/modelMesh.js',
    'js/engine/animation/skinnedMesh.js',
    'js/engine/entity/animatedModel.js',
    'js/engine/entity/staticModel.js',
    'js/engine/loader/gltfParser.js',
];
const SAMPLE_STEP       = 0.0001;
// Speed change from one sample to the next, against the fastest speed: a smooth curve stays near acceleration × step,
// a jump does not shrink with the step (bound of the engine's bench).
const SMOOTH_JUMP_RATIO = 0.01;
// Relative margin over a golden: the samples are exact, only the order of the sums may differ between machines.
const GOLDEN_MARGIN     = 1e-6;
const UNIT_SCALE        = [1, 1, 1];
// Where a Mat4 holds its translation, and its three axes (the rows before it, without their fourth column).
const TRANSLATION_ROW   = 12;
const AXES              = [0, 1, 2, 4, 5, 6, 8, 9, 10];

class PitMechanicBench {
    constructor() {
        const ctx = vm.createContext({console, Math, Float32Array, Uint16Array, Uint8Array, Map, Object, Error, Number, Set, Array});
        for (const file of SOURCES) {
            vm.runInContext(fs.readFileSync(path.join(WEBSITE_DIR, file), 'utf8'), ctx, {filename: file});
        }
        for (const name of ['GltfParser', 'Mat4', 'Skeleton', 'AnimationSampler', 'AnimationChannel']) {
            this[name] = vm.runInContext(name, ctx);
        }
        const gltf   = JSON.parse(fs.readFileSync(MODEL_FILE, 'utf8'));
        const binary = fs.readFileSync(path.join(path.dirname(MODEL_FILE), gltf.buffers[0].uri));
        this._model    = this.GltfParser.parse(gltf, binary.buffer.slice(binary.byteOffset, (binary.byteOffset + binary.byteLength)));
        this._failures = 0;
    }

    run(update) {
        const measures = {};
        for (const clip of this._model.clips) {
            measures[clip.getName()] = this._measure(clip);
        }
        if (update) {
            fs.mkdirSync(path.dirname(GOLDEN_FILE), {recursive: true});
            fs.writeFileSync(GOLDEN_FILE, JSON.stringify(measures, null, 4) + '\n');
            console.log('pit mechanic: goldens written (' + path.relative(ROOT_DIR, GOLDEN_FILE) + ')');

            return 0;
        }
        const goldens = JSON.parse(fs.readFileSync(GOLDEN_FILE, 'utf8'));
        for (const [name, measure] of Object.entries(measures)) {
            for (const kind of ['position', 'axes']) {
                const own    = measure[kind];
                const golden = goldens[name][kind];
                this._check(name + ' ' + kind + ': largest speed change ' + own.change.toFixed(4) + ' at ' + own.time.toFixed(4) + ' s (' + own.node + '), ratio ' + own.ratio.toFixed(4) + ' (golden ' + golden.change.toFixed(4) + ')',
                    ((own.change <= (golden.change * (1 + GOLDEN_MARGIN))) && (own.ratio < SMOOTH_JUMP_RATIO)));
            }
        }
        console.log((this._failures === 0) ? 'pit mechanic: all checks passed' : ('pit mechanic: ' + this._failures + ' check(s) failed'));

        return this._failures;
    }

    /**
     * The largest change of speed of the joints' and sockets' positions (m/s) and axes (rad/s) over a clip.
     *
     * @returns {{position: object, axes: object}} each {change, ratio, time, node}
     */
    _measure(clip) {
        const skeleton = this._model.skeleton;
        const nodes    = [...Array(skeleton.getJointCount()).keys()].map((joint) => skeleton.getJointName(joint));
        nodes.push(...this._model.sockets.map((socket) => ('socket ' + socket.getName())));
        const steps    = Math.floor(clip.getDuration() / SAMPLE_STEP);
        const cursors  = clip.getChannels().map(() => this.AnimationSampler.createCursor());
        const position = {previous: null, speeds: null, fastest: 0, change: 0, time: 0, node: ''};
        const axes     = {previous: null, speeds: null, fastest: 0, change: 0, time: 0, node: ''};
        for (let i = 0; i <= steps; i++) {
            const matrices = this._matrices(clip, (i * SAMPLE_STEP), cursors);
            PitMechanicBench._follow(position, matrices.map((m) => m.slice(TRANSLATION_ROW, (TRANSLATION_ROW + this.Skeleton.TRANSLATION_SIZE))), (i * SAMPLE_STEP), nodes);
            PitMechanicBench._follow(axes, matrices.map((m) => AXES.map((k) => m[k])), (i * SAMPLE_STEP), nodes);
        }
        const result = (series) => ({change: series.change, ratio: (series.change / series.fastest), time: series.time, node: series.node});

        return {position: result(position), axes: result(axes)};
    }

    // One sample more of every node: their speeds, the fastest, and the largest change of a speed so far.
    static _follow(series, values, time, nodes) {
        if (series.previous !== null) {
            const speeds = values.map((value, n) => value.map((v, k) => ((v - series.previous[n][k]) / SAMPLE_STEP)));
            speeds.forEach((speed, n) => {
                series.fastest = Math.max(series.fastest, Math.hypot(...speed));
                if (series.speeds !== null) {
                    const change = Math.hypot(...speed.map((v, k) => (v - series.speeds[n][k])));
                    if (change > series.change) {
                        Object.assign(series, {change: change, time: time, node: nodes[n]});
                    }
                }
            });
            series.speeds = speeds;
        }
        series.previous = values;
    }

    // Every joint's matrix in the model's space, then every socket's, from the clip sampled in double precision.
    _matrices(clip, t, cursors) {
        const skeleton    = this._model.skeleton;
        const count       = skeleton.getJointCount();
        const translation = Float64Array.from(skeleton.getRestTranslation());
        const rotation    = Float64Array.from(skeleton.getRestRotation());
        clip.getChannels().forEach((channel, c) => {
            const values = ((channel.getPath() === this.AnimationChannel.TRANSLATION) ? translation : rotation);
            channel.getSampler().sample(t, cursors[c], values, (channel.getJoint() * channel.getSampler().getComponents()));
        });
        // A skeleton lists every joint after its parent.
        const worlds = [];
        for (let joint = 0; joint < count; joint++) {
            const local  = this.Mat4.fromTranslationRotationScale(new Float64Array(this.Mat4.SIZE), translation, (joint * this.Skeleton.TRANSLATION_SIZE), rotation, (joint * this.Skeleton.ROTATION_SIZE), UNIT_SCALE, 0);
            const parent = skeleton.getParent(joint);
            worlds.push((parent < 0) ? local : this.Mat4.multiply(local, local, worlds[parent]));
        }
        for (const socket of this._model.sockets) {
            worlds.push(this.Mat4.multiply(new Float64Array(this.Mat4.SIZE), socket.getOffset(), worlds[socket.getJoint()]));
        }

        return worlds;
    }

    _check(label, ok) {
        if (!ok) {
            this._failures++;
        }
        console.log(((ok) ? '  ok   ' : '  FAIL ') + label);
    }
}

process.exit((new PitMechanicBench().run(process.argv.includes('--update')) === 0) ? 0 : 1);

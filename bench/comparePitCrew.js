#!/usr/bin/env node
/**
 * Checks that the pit crew of the game keeps the original's timing, run from the repository root:
 *
 *   node bench/comparePitCrew.js
 *
 * Loads the game's crew (RacingPitCrew, its glTF models read by the engine's loader in a vm context, as the browser
 * does), starts it as the pit start does (RacingPitCrewSchedule.start()) and plays it at the original's tick (50 ms):
 * each mechanic's events must fall on the ticks where the original's frame (RacingCarPhysics.crewFrame) first shows
 * them: the wheel gun every tick of frames 4 and 22, the wheel taken off at frame 7, put back at frame 19, the repair
 * at frame 20, the end at frame 27. Played at the steps of the game's frames (16.7 ms, 33.3 ms), the events of each
 * mechanic come in the same order, each in the frame its tick falls in (each step played a hair long, against the
 * floating sums falling short of a tick). With schedules of a stop fixed (RacingPitCrewSchedule: a delay and an end
 * for each mechanic), the events keep their order, and the last repair and the last end fall when the schedule says
 * (repairedAt, finishedAt; releaseAt 0.2 s later), within a frame. Around each car placed on its box (RacingCarView), mirrored or not, the
 * wheel each mechanic takes off and puts back is exactly on the car's hub, its hand near it. Exits with 1 on a failure.
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT_DIR    = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT_DIR, 'website');
const SOURCES     = [
    'js/engine/entity/abstractLoadedEntity.js',
    'js/engine/entity/instance.js',
    'js/engine/entity/animatedModel.js',
    'js/engine/entity/staticModel.js',
    'js/engine/entity/face.js',
    'js/engine/entity/object3d.js',
    'js/engine/entity/texture.js',
    'js/engine/loader/abstractLoader.js',
    'js/engine/loader/instanceLoader.js',
    'js/engine/loader/interactionLoader.js',
    'js/engine/loader/object3dLoader.js',
    'js/engine/loader/textureLoader.js',
    'js/engine/loader/worldLoader.js',
    'js/engine/loader/gltfParser.js',
    'js/engine/loader/abstractGltfLoader.js',
    'js/engine/loader/staticModelLoader.js',
    'js/engine/loader/animatedModelLoader.js',
    'js/engine/loader.js',
    'js/engine/matrix.js',
    'js/engine/engine3d.js',
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
    'js/engine/animation/animationPlayer.js',
    'js/engine/animation/animatedInstance.js',
    'js/racing/racingPalette.js',
    'js/racing/game/racingModelConverter.js',
    'js/racing/game/racingWheelModels.js',
    'js/racing/game/racingCarPhysics.js',
    'js/racing/game/racingCarView.js',
    'js/racing/game/racingPitCrewSchedule.js',
    'js/racing/game/racingPitCrew.js',
    'js/racing/game/racingGame.js',
];
const CLASSES    = ['RacingPalette', 'RacingModelConverter', 'RacingWheelModels', 'RacingCarPhysics', 'RacingCarView', 'RacingPitCrewSchedule', 'RacingPitCrew', 'RacingGame', 'Mat4', 'Matrix'];
const DATA       = 'assets/virtual_racing/';
const COURSE     = 'big_forest';
const CAR        = 'formula';
const CARS       = ['formula', 'stock', 'prototype'];
// The pit start's car: on the first place of the grid, the pit box.
const START_PLACE = 0;
// A wheel taken off or put back lies on the hub (metres); the hand holding it is near: within the reach the ROM's
// clips leave around each car's hubs (up to 0.6 m, made around the Formula's), far short of the other side of the car.
const HUB_GAP     = 0.001;
const HAND_REACH  = 0.75;
// Metres per car model unit.
const CAR_SCALE  = (1 / 1024);
// The original's tick, and the frames of the game it is checked at (ticks).
const TICK_STEP  = 1;
const GAME_STEPS = [(1 / 3), (2 / 3)];
// Frames of the original that send the wheel gun ($3D28), take the wheels off and put them back ($3CEC), repair
// ($AB88) and end the animation.
const WRENCH_FRAMES   = [4, 22];
const WHEEL_OFF_FRAME = 7;
const WHEEL_ON_FRAME  = 19;
const REPAIR_FRAME    = 20;
const LAST_FRAME      = 27;
const LAST_TICK       = 130;
// Ticks summed in thirds do not fall exactly on a tick.
const TICK_EPSILON    = 1e-6;
// Each step played a hair long: a sum of floating steps must not fall short of a tick and hear its event one late.
const STEP_LEAD       = 1e-9;
// Stops' schedules: each mechanic's delay and end (s), within the drawn ranges and at their bounds.
const SCHEDULES = [
    {delays: [0, 0.1, 0.25, 0.5], ends: [5.3, 5.8, 6.3, 6.0]},
    {delays: [0.5, 0.5, 0, 0], ends: [6.3, 5.3, 5.3, 6.3]},
    {delays: [0.37, 0.02, 0.44, 0.19], ends: [5.61, 6.12, 5.94, 5.47]},
];

class PitCrewBench {
    constructor() {
        // The engine's glTF loader fetches through appBootstrap: here from the website directory.
        const appBootstrap = {
            fetchJson:  (url, callback) => callback(JSON.parse(fs.readFileSync(PitCrewBench._file(url), 'utf8'))),
            fetchAsync: (url) => Promise.resolve({arrayBuffer: () => PitCrewBench._buffer(fs.readFileSync(PitCrewBench._file(url)))}),
            logError:   (message, error) => { throw new Error(message + ': ' + error); },
        };
        this._ctx = vm.createContext({console, Math, Float32Array, Uint16Array, Uint8Array, Map, Set, Object, Error, Number, Array, Promise, JSON, appBootstrap, User: class {}});
        for (const file of SOURCES) {
            vm.runInContext(fs.readFileSync(path.join(WEBSITE_DIR, file), 'utf8'), this._ctx, {filename: file});
        }
        for (const name of CLASSES) {
            this[name] = vm.runInContext(name, this._ctx);
        }
        this.loader    = vm.runInContext('loader', this._ctx);
        this._failures = 0;
    }

    async run() {
        const read     = (file) => JSON.parse(fs.readFileSync(path.join(WEBSITE_DIR, DATA, file), 'utf8'));
        const data     = {race: read('race.json'), cars: read('cars.json'), palettes: read('palettes.json')};
        const {crew}   = await this._scene(data, CAR, false);
        const original = this._original();
        const name     = (n) => this.RacingPitCrew.CLIPS[n];
        this._play(crew, TICK_STEP).forEach((events, n) => {
            this._equal(name(n) + ': events at the original\'s ticks', events.map((event) => (event.name + '@' + Math.round(event.at))).join(' '), original.map((event) => (event.name + '@' + event.tick)).join(' '));
        });
        for (const step of GAME_STEPS) {
            const label = (n) => (name(n) + ' at ' + (step * this.RacingGame.TICK_MS).toFixed(1) + ' ms: ');
            this._play(crew, step).forEach((events, n) => {
                const late = events.filter((event, i) => ((original[i] === undefined) || ((event.at + TICK_EPSILON) < original[i].tick) || ((event.at - step) >= (original[i].tick + TICK_EPSILON))));
                this._equal(label(n) + 'same events, same order', events.map((event) => event.name).join(' '), original.map((event) => event.name).join(' '));
                this._equal(label(n) + 'each in the frame of its tick', late.length, 0);
            });
        }
        for (const [k, times] of SCHEDULES.entries()) {
            const schedule = new this.RacingPitCrewSchedule(times.delays, times.ends.map((end, n) => (this.RacingPitCrewSchedule.CLIP_END / (end - times.delays[n]))));
            for (const step of GAME_STEPS) {
                this._onSchedule(crew, schedule, step, original, ('schedule ' + (k + 1) + ' at ' + (step * this.RacingGame.TICK_MS).toFixed(1) + ' ms'));
            }
        }
        for (const code of CARS) {
            for (const mirror of [false, true]) {
                const scene = await this._scene(data, code, mirror);
                this._onHubs(scene, (code + (mirror ? ' mirrored' : '')));
            }
        }
        console.log((this._failures === 0) ? 'pit crew: all checks passed' : ('pit crew: ' + this._failures + ' check(s) failed'));

        return this._failures;
    }

    // The pit start at Big Forest: the car on its box, placed as the game does, and the crew, their models loaded by
    // the engine's loader.
    async _scene(data, code, mirror) {
        const car       = data.cars.cars.find((entry) => (entry.code === code));
        const converter = new this.RacingModelConverter(new this.RacingPalette(data.palettes, COURSE, code));
        const wheels    = new this.RacingWheelModels(data.cars, car);
        this.loader.reset();
        this.loader.beginBatch();
        const view = new this.RacingCarView(converter, data.cars, car, wheels, CAR_SCALE, mirror);
        const crew = new this.RacingPitCrew(('/' + DATA), converter, wheels, data.race.pit, car, COURSE, CAR_SCALE, mirror);
        await new Promise((resolve) => {
            this.loader.setCallback(resolve);
            this.loader.endBatch();
        });
        const [x, height, z] = data.race.startGrids[code].race[this.RacingGame.PIT_START_COURSES.indexOf(COURSE)][START_PLACE];
        const position       = [(x * this.RacingGame.METRES_PER_ENTITY_UNIT * (mirror ? -1 : 1)), (height * this.RacingGame.METRES_PER_HEIGHT_UNIT), (z * this.RacingGame.METRES_PER_ENTITY_UNIT)];
        // As the game: every instance made before the car is placed (the loader sets new ones as loaded).
        view.bind();
        crew.bind();
        view.setDamage(0).setEffects(null, true, null).animate(0, 0, 0, 0).place(position, 0, 0, 0, {lift: 0, yaw: 0, pitch: 0, roll: 0});

        return {view: view, crew: crew};
    }

    // At each wheel event, the wheel against the car's hub and the mechanic's hand.
    _onHubs({view, crew}, label) {
        const hubs     = this.RacingPitCrew.CLIPS.map((clip, wheel) => view.hubMatrix(wheel, this.Mat4.create()));
        const hand     = this.Mat4.create();
        const at       = (instance) => this.Matrix.composeInstanceTransform(instance.getTransform()).v[3];
        const distance = (p, m) => Math.hypot((p[0] - m[12]), (p[1] - m[13]), (p[2] - m[14]));
        const worst    = {gap: 0, reach: 0};
        crew.reset()
            .setOnWheel((wheel, off) => {
                const mechanic = crew._mechanics.find((entry) => (entry.wheel === wheel));
                const object   = (off ? mechanic.objects.removedWheel : mechanic.objects.newWheel);
                mechanic.animated.socketMatrix('wheel', hand);
                worst.gap   = Math.max(worst.gap, distance(at(object), hubs[wheel]));
                worst.reach = Math.max(worst.reach, distance([hand[12], hand[13], hand[14]], hubs[wheel]));
            })
            .setOnWrench(() => {})
            .setOnRepaired(() => {})
            .setOnFinished(() => {})
            .start(this.RacingPitCrewSchedule.start(), hubs);
        for (let tick = 0; tick < LAST_TICK; tick += TICK_STEP) {
            crew.update(TICK_STEP + STEP_LEAD);
        }
        this._check(label + ': wheels on the hubs (' + worst.gap.toFixed(4) + ' m), hands near (' + worst.reach.toFixed(2) + ' m)', ((worst.gap < HUB_GAP) && (worst.reach < HAND_REACH)));
    }

    // A stop's schedule played at a step: each mechanic's events in the original's order; the last repair and the last
    // end in the frame the schedule puts them in.
    _onSchedule(crew, schedule, step, original, label) {
        const heard   = this._play(crew, step, schedule);
        const seconds = (ticks) => ((ticks * this.RacingGame.TICK_MS) / this.RacingGame.MS_PER_SECOND);
        const frame   = (seconds(step) + TICK_EPSILON);
        const last    = (name) => Math.max(...heard.map((events) => seconds(events.find((event) => (event.name === name)).at)));
        const inFrame = (at, expected) => ((at >= (expected - TICK_EPSILON)) && ((at - frame) < expected));
        this._check(label + ': each mechanic\'s events in the original\'s order', heard.every((events) => (events.map((event) => event.name).join(' ') === original.map((event) => event.name).join(' '))));
        this._check(label + ': repaired at ' + schedule.repairedAt().toFixed(3) + ' s (heard ' + last('repaired').toFixed(3) + '), done at ' + schedule.finishedAt().toFixed(3) + ' s (heard ' + last('finished').toFixed(3) + '), released at ' + schedule.releaseAt().toFixed(3) + ' s',
            (inFrame(last('repaired'), schedule.repairedAt()) && inFrame(last('finished'), schedule.finishedAt()) && (Math.abs(schedule.releaseAt() - schedule.finishedAt() - this.RacingPitCrewSchedule.RELEASE_DELAY) < TICK_EPSILON)));
    }

    // Each mechanic's events played from the start at a step: {name, at (ticks played when heard)}.
    _play(crew, step, schedule = this.RacingPitCrewSchedule.start()) {
        const heard = this.RacingPitCrew.CLIPS.map(() => []);
        let at      = 0;
        const hear  = (n, name) => heard[n].push({name: name, at: at});
        crew.reset()
            .setOnWheel((wheel, off) => hear(this.RacingPitCrew.WHEEL_OF.indexOf(wheel), (off ? 'wheelOff' : 'wheelOn')))
            .setOnWrench((n) => hear(n, 'wrench'))
            .setOnRepaired((n) => hear(n, 'repaired'))
            .setOnFinished((n) => hear(n, 'finished'))
            .show(true)
            .start(schedule, this.RacingPitCrew.CLIPS.map(() => this.Mat4.create()));
        const lastTick = (LAST_TICK + ((this.RacingPitCrewSchedule.END_RANGE[1] - this.RacingPitCrewSchedule.CLIP_END) * this.RacingGame.MS_PER_SECOND / this.RacingGame.TICK_MS));
        while (at < lastTick) {
            at += step;
            crew.update(step + STEP_LEAD);
        }

        return heard;
    }

    // The original's: a tick per frame change of its crew.
    _original() {
        const events = [];
        const frame  = (tick) => this.RacingCarPhysics.crewFrame(tick);
        const first  = (wanted) => [...Array(LAST_TICK).keys()].find((tick) => (frame(tick) === wanted));
        for (let tick = 0; tick < LAST_TICK; tick++) {
            if (WRENCH_FRAMES.includes(frame(tick))) {
                events.push({name: 'wrench', tick: tick});
            }
        }
        events.push({name: 'wheelOff', tick: first(WHEEL_OFF_FRAME)}, {name: 'wheelOn', tick: first(WHEEL_ON_FRAME)}, {name: 'repaired', tick: first(REPAIR_FRAME)}, {name: 'finished', tick: first(LAST_FRAME)});

        return events.sort((a, b) => (a.tick - b.tick));
    }

    static _file(url) {
        return path.join(WEBSITE_DIR, url.replace(/^\//, ''));
    }

    static _buffer(bytes) {
        return bytes.buffer.slice(bytes.byteOffset, (bytes.byteOffset + bytes.byteLength));
    }

    _check(label, ok) {
        if (!ok) {
            this._failures++;
        }
        console.log((ok ? '  ok   ' : '  FAIL ') + label);
    }

    _equal(label, actual, expected) {
        const ok = (actual === expected);
        if (!ok) {
            this._failures++;
        }
        console.log((ok ? '  ok   ' : '  FAIL ') + label + (ok ? '' : ('\n         got      ' + actual + '\n         expected ' + expected)));
    }
}

new PitCrewBench().run().then((failures) => process.exit((failures === 0) ? 0 : 1));

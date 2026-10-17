#!/usr/bin/env node
/**
 * Offline exporter of the Virtua Racing Deluxe (USA) data used by Spipu-Racing, run from the repository root:
 *
 *   node tools/export/exportVirtualRacing.js [rom path]
 *
 * Reads the ROM (MD5 checked, default .source/Virtua Racing Deluxe (USA).32x) and writes website/assets/virtual_racing/.
 * Everything is read and encoded before the first file is written.
 */
const fs   = require('fs');
const path = require('path');

const {VrRom}                = require('./vrRom');
const {VrModelReader}        = require('./vrModelReader');
const {VrModelEncoder}       = require('./vrModelEncoder');
const {VR_ROM_MAP}           = require('./vrRomMap');
const {VrSkyBuilder}         = require('./vrSkyBuilder');
const {VrPngWriter}          = require('./vrPngWriter');
const {VrCollisionReader}    = require('./vrCollisionReader');
const {VrSoundReader}        = require('./vrSoundReader');
const {VrWavWriter}          = require('./vrWavWriter');
const {VrGameDataReader}     = require('./vrGameDataReader');
const {VrCarExporter}        = require('./vrCarExporter');
const {VrCourseObjectReader} = require('./vrCourseObjectReader');
const {VrPitReader}          = require('./vrPitReader');

class VirtualRacingExporter {
    constructor(romPath) {
        if (!fs.existsSync(romPath)) {
            throw new Error('ROM not found: ' + romPath + ' (usage: node tools/export/exportVirtualRacing.js [rom path])');
        }
        this._rom     = new VrRom(romPath);
        this._reader  = new VrModelReader(this._rom);
        this._encoder = new VrModelEncoder();
        this._files   = [];
    }

    run() {
        const map     = VR_ROM_MAP;
        const format  = VirtualRacingExporter.FORMAT;
        const builder = new VrSkyBuilder(this._rom);
        const skies   = map.courses.map((course, i) => this._sky(builder, course, i));
        const courses = map.courses.map((course, index) => this._course(course, index));
        const sky     = skies[0];
        if (skies.some((other) => ((other.width !== sky.width) || (other.height !== sky.height)))) {
            throw new Error('the sky panoramas differ in size');
        }

        this._json('catalog.json', {
            format:  format,
            courses: map.courses.map((course, i) => ({code: course.code, name: course.name, skyColor: builder.backdropColor(skies[i])})),
            cars:    map.cars.map((car) => ({code: car.code, name: car.name})),
            sky:     {horizonRow: map.skyHorizonRow, width: sky.width, height: sky.height},
        });
        this._json('palettes.json', this._palettes());
        this._json('cars.json', new VrCarExporter(this._rom, this._reader, this._encoder, map).export(format));
        map.courses.forEach((course, i) => {
            this._json(path.join('courses', course.code + '.json'), courses[i]);
            this._file(path.join('skies', course.code + '.png'), new VrPngWriter().encode(skies[i].width, skies[i].height, skies[i].rgba));
        });
        this._sounds();
        this._gameData(courses);
        this._writeAll();
    }

    _palettes() {
        const map  = VR_ROM_MAP;
        const read = (palettes, i) => this._rom.words((palettes.start + (i * palettes.stride)), palettes.colors, false);
        return {
            format:          VirtualRacingExporter.FORMAT,
            colorFormat:     'RGB555, bit 15 = through bit: red bits 0-4, green 5-9, blue 10-14',
            courses:         this._byCode(map.courses, map.courses.map((course, i) => read(map.coursePalettes, i))),
            cars:            this._byCode(map.cars, map.cars.map((car, i) => read(map.carPalettes, i))),
            carPaletteStart: map.carPalettes.firstIndex,
        };
    }

    _course(course, index) {
        const map    = VR_ROM_MAP;
        const size   = map.sceneryGridSize;
        const models = new Map();
        const grid   = [];
        for (let cell = 0; cell < (size * size); cell++) {
            const pointer = this._rom.u32(course.sceneryGrid + (cell * VrRom.POINTER_SIZE));
            if (pointer === map.sceneryEmptyCell) {
                grid.push(null);
                continue;
            }
            const offset = this._rom.fileFromSh2(pointer);
            const id     = VrModelEncoder.id(offset);
            if (!models.has(id)) {
                models.set(id, this._reader.read(offset));
            }
            grid.push(id);
        }
        const collision    = new VrCollisionReader(this._rom);
        const objectModels = new Map();
        const objects      = new VrCourseObjectReader(this._rom, this._reader, map.courseObjects).read(index, course.code, objectModels);
        return {
            format:      VirtualRacingExporter.FORMAT,
            code:        course.code,
            name:        course.name,
            vertexShift: map.sceneryVertexShift,
            gridSize:    size,
            grid:        grid,
            models:      this._encoder.encodeScene(models),
            // Car-scale models (1024 units a metre), placed and animated by the game.
            objects:      objects,
            objectModels: Object.fromEntries([...objectModels].map(([id, model]) => [id, this._encoder.encode(model)])),
            collision:   {
                gridSize:  map.collisionGridSize,
                cellSize:  map.collisionCellSize,
                origin:    map.collisionOrigin,
                toScenery: map.collisionToScenery,
                layers:    course.collision.map((layer) => collision.read(this._rom.fileFrom68k(layer.map), this._rom.fileFrom68k(layer.base), map.collisionGridSize)),
            },
        };
    }

    // Sections of a course: the highest section number of its collision polygons, plus one.
    _sectionCount(course) {
        const polygons = course.collision.layers.flatMap((layer) => layer.records.filter((record) => (record !== null)).flat());

        return (Math.max(...polygons.map((polygon) => polygon[VR_ROM_MAP.collisionSectionField])) + 1);
    }

    _gameData(courses) {
        const map     = VR_ROM_MAP;
        const reader  = new VrGameDataReader(this._rom, map.gameData, map.carScene, map.cars.length);
        const physics = reader.readPhysics();
        const race    = reader.readRace(courses.map((course) => this._sectionCount(course)));
        this._json('physics.json', {
            format: VirtualRacingExporter.FORMAT,
            ...physics,
            cars:   this._byCode(map.cars, physics.cars),
        });
        const pit     = new VrPitReader(this._rom, map).read();
        this._json('race.json', {
            format:     VirtualRacingExporter.FORMAT,
            startGrids: this._byCode(map.cars, race.startGrids.map((groups) => Object.fromEntries(map.gameData.startGridGroups.map((group, g) => [group, groups[g]])))),
            courses:    this._byCode(map.courses, race.courses),
            checkpointJingles: race.checkpointJingles,
            // Where the mechanics stand, the pit boxes.
            pit:        pit,
        });
    }

    _sounds() {
        const map     = VR_ROM_MAP;
        const reader  = new VrSoundReader(this._rom);
        const wav     = new VrWavWriter();
        const samples = {};
        for (const sample of reader.readDacSamples(map.soundDriver, map.dacSampleCount)) {
            const name = 'dac_' + VrModelEncoder.hex(sample.id, VirtualRacingExporter.SOUND_ID_DIGITS) + '.wav';
            this._file(path.join('sounds', name), wav.encode(sample.pcm, sample.rate, VirtualRacingExporter.MONO));
            samples[sample.id] = {file: name, rate: sample.rate, length: sample.pcm.length};
        }
        const pwm = map.pwmSample;
        this._file(path.join('sounds', VirtualRacingExporter.PWM_FILE), wav.encode(reader.readPwm(pwm.offset, pwm.frames), pwm.rate, VirtualRacingExporter.STEREO));

        const effects = {};
        for (const script of reader.readEffectScripts(map.soundEffects)) {
            effects[VrModelEncoder.hex(script.id, VirtualRacingExporter.SOUND_ID_DIGITS)] = {
                role:     (map.soundEffectRoles[script.id] ?? null),
                samples:  script.samples,
                timeline: script.timeline,
                frames:   script.frames,
                priority: script.priority,
                type:    ((script.samples.length > 0) ? 'dac' : 'fm'),
                voice:    script.voice,
                detune:   script.detune,
            };
        }
        this._json('sounds.json', {format: VirtualRacingExporter.FORMAT, samples, effects, pwmJingle: VirtualRacingExporter.PWM_FILE});
    }

    _sky(builder, course, index) {
        return builder.build({
            map:     course.sky.map,
            tiles:   course.sky.tiles,
            palette: (VR_ROM_MAP.skyPalettes.start + (index * VR_ROM_MAP.skyPalettes.stride)),
            columns: VR_ROM_MAP.skyColumns,
        });
    }

    // {code: value} for a list of courses or cars and their values in the same order.
    _byCode(list, values) {
        return Object.fromEntries(list.map((entry, i) => [entry.code, values[i]]));
    }

    _json(name, data) {
        this._file(name, JSON.stringify(data) + '\n');
    }

    _file(name, data) {
        this._files.push({name, data});
    }

    _writeAll() {
        for (const directory of VirtualRacingExporter.DIRECTORIES) {
            fs.mkdirSync(path.join(VirtualRacingExporter.OUTPUT_DIR, directory), {recursive: true});
        }
        for (const {name, data} of this._files) {
            const file = path.join(VirtualRacingExporter.OUTPUT_DIR, name);
            fs.writeFileSync(file, data);
            process.stdout.write(path.relative(VirtualRacingExporter.ROOT_DIR, file) + ': ' + fs.statSync(file).size + ' bytes\n');
        }
    }
}

VirtualRacingExporter.ROOT_DIR        = path.resolve(__dirname, '..', '..');
VirtualRacingExporter.DEFAULT_ROM     = path.join(VirtualRacingExporter.ROOT_DIR, '.source', 'Virtua Racing Deluxe (USA).32x');
VirtualRacingExporter.OUTPUT_DIR      = path.join(VirtualRacingExporter.ROOT_DIR, 'website', 'assets', 'virtual_racing');
VirtualRacingExporter.DIRECTORIES     = ['courses', 'skies', 'sounds'];
VirtualRacingExporter.FORMAT          = 1;
VirtualRacingExporter.SOUND_ID_DIGITS = 2;
VirtualRacingExporter.PWM_FILE        = 'pwm_jingle.wav';
VirtualRacingExporter.MONO            = 1;
VirtualRacingExporter.STEREO          = 2;

try {
    new VirtualRacingExporter(process.argv[2] ?? VirtualRacingExporter.DEFAULT_ROM).run();
} catch (error) {
    process.stderr.write(String(error.stack ?? error) + '\n');
    process.exitCode = 1;
}

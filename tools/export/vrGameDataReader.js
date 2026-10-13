const {VrCarScene} = require('./vrCarScene');

/**
 * Reads the game tables used by the player's car, the cameras and the race, as raw ROM values
 * (68K addresses in VR_ROM_MAP.gameData; their meaning is described in the project notes).
 */
class VrGameDataReader {
    /**
     * @param {VrRom}  rom
     * @param {object} map      - VR_ROM_MAP.gameData
     * @param {object} carScene - VR_ROM_MAP.carScene
     * @param {int}    cars     - number of cars
     */
    constructor(rom, map, carScene, cars) {
        this._rom      = rom;
        this._map      = map;
        this._carScene = carScene;
        this._cars     = cars;
    }

    readPhysics() {
        const map = this._map;
        return {
            gearRatios:    this._table(map.gearRatios, false),
            upshiftRpm:    this._table(map.upshiftRpm, true),
            downshiftRpm:  this._table(map.downshiftRpm, true),
            torque:        {automatic: this._table(map.torqueAutomatic, false), manual: this._table(map.torqueManual, false)},
            sinQuarter:    this._table(map.sinTable, true),
            atanLow:       this._table(map.atanLow, true),
            atanHigh:      this._table(map.atanHigh, true),
            rollTable:     this._table(map.rollTable, true),
            pitchTable:    this._table(map.pitchTable, true),
            crashRecovery: this._chunks(this._table(map.crashRecovery, true), map.crashRecovery.chunk),
            shakeTable:    this._table(map.shakeTable, true),
            cars:          this._carIndexes().map((car) => this._car(car)),
        };
    }

    /**
     * @param {int[]} courseSections - number of sections of each course, in the order of the course tables
     */
    readRace(courseSections) {
        return {
            startGrids: this._carIndexes().map((car) => this._startGrids(car)),
            courses:    courseSections.map((sections, course) => this._course(course, sections)),
            checkpointJingles: Array.from(this._rom.getBytes(this._rom.fileFrom68k(this._map.checkpointJingles.address), this._map.checkpointJingles.count))
                .map((id) => id.toString(16).toUpperCase()),
        };
    }

    // Groups (demo, race, two players) of start places {x, height, z, heading} by course.
    _startGrids(car) {
        const map    = this._map;
        const groups = this._rom.u32(this._rom.fileFrom68k(map.startGrids) + (car * VrGameDataReader.POINTER_SIZE));
        return map.startGridGroups.map((group, g) => Array.from({length: map.startGridCourses}, (unused, course) => {
            const records = this._rom.pointer68k(groups, ((g * map.startGridCourses) + course));
            return this._chunks(this._rom.words(records, (map.startGridRecords * VrGameDataReader.RECORD_WORDS), true), VrGameDataReader.RECORD_WORDS);
        }));
    }

    // Section points and progress, crash sections, pit lane and race paths of a course.
    _course(course, sections) {
        const map      = this._map;
        const block    = (map.courseProgress + (course * map.courseProgressStride));
        const pointer  = (field) => this._rom.pointer68k(block + field, 0);
        const progress = Array.from(this._rom.getBytes(pointer(VrGameDataReader.PROGRESS_FIELD), sections));
        const points   = (Math.max(...progress) + map.pathPointsAfterLast);
        return {
            sectionPairs:  this._chunks(this._rom.words(pointer(VrGameDataReader.SECTIONS_FIELD), (sections * 2), true), 2),
            sectionBytes:  progress,
            crashSections: Array.from(this._rom.getBytes(pointer(VrGameDataReader.CRASH_FIELD), (points * 2))),
            pitPath:       this._chunks(this._rom.words(pointer(VrGameDataReader.PIT_PATH_FIELD), (points * VrGameDataReader.PATH_WORDS), true), VrGameDataReader.PATH_WORDS),
            racePath:      this._chunks(this._rom.words(pointer(VrGameDataReader.RACE_PATH_FIELD), (points * VrGameDataReader.PATH_WORDS), true), VrGameDataReader.PATH_WORDS),
            lineCorrection:        this._rom.words(this._rom.fileFrom68k(map.lineCorrection + (course * 2)), 1, true)[0],
            checkpointCorrections: this._rom.words(this._rom.fileFrom68k(map.checkpointCorrections + (course * 4)), 2, true),
        };
    }

    _car(car) {
        const map    = this._map;
        const params = this._rom.pointer68k(map.carParams, car);
        const values = {};
        map.carParamNames.forEach((name, i) => {
            values[name] = this._rom.s16(params + VrGameDataReader.POINTER_SIZE + (i * 2));
        });
        const drag = (manual) => this._rom.words(this._rom.pointer68k(map.dragTables, ((car * 2) + manual)), map.dragWords, false);
        const max  = (manual) => this._rom.words(this._rom.fileFrom68k(map.maxSpeeds + ((((car * 2) + manual) * map.maxSpeedWords) * 2)), map.maxSpeedWords, false);
        const scene = new VrCarScene(this._rom, this._carScene, car);
        return {
            params:          values,
            gears:           this._rom.words(this._rom.fileFrom68k(this._rom.u32(params)), map.carGears, false),
            dragTable:       {automatic: drag(0), manual: drag(1)},
            maxSpeed:        {automatic: max(0), manual: max(1)},
            probeOffsets:    this._probePages(this._rom.pointer68k(map.probeOffsets, car)),
            hitbox:          this._rom.words(this._rom.pointer68k(map.hitboxBounds, car), map.hitboxWords, true),
            viewTransitions: this._viewTransitions(scene.pointer(this._carScene.viewTransitions)),
        };
    }

    /**
     * Transitions (old view x 4 + new view), one [$C054, $C056] pair per 20 Hz tick, in playback order:
     * the game reads its table from the last entry down to entry 1 (entry 0 is not used).
     */
    _viewTransitions(table) {
        const map = this._map;
        return Array.from({length: map.viewTransitions}, (unused, transition) => {
            const frames = this._rom.fileFrom68k(this._rom.u32(table + (transition * VrGameDataReader.POINTER_SIZE)));
            const played = [];
            for (let entry = (map.viewTransitionFrames - 1); entry >= 1; entry--) {
                played.push(this._rom.words(frames + (entry * VrGameDataReader.POINTER_SIZE), 2, true));
            }
            return played;
        });
    }

    // Pages of signed byte pairs (dx, dz), indexed by (heading + $46) >> 6.
    _probePages(start) {
        const map = this._map;
        return Array.from({length: map.probePages}, (unused, page) => {
            const bytes = this._rom.getBytes((start + (page * map.probePageBytes)), map.probePageBytes);
            return Array.from({length: map.probeCount}, (unused2, i) => [this._signedByte(bytes[i * 2]), this._signedByte(bytes[(i * 2) + 1])]);
        });
    }

    _table(table, signed) {
        return this._rom.words(this._rom.fileFrom68k(table.address), table.words, signed);
    }

    _carIndexes() {
        return Array.from({length: this._cars}, (unused, car) => car);
    }

    _signedByte(byte) {
        return ((byte << 24) >> 24);
    }

    _chunks(values, size) {
        const out = [];
        for (let i = 0; i < values.length; i += size) {
            out.push(values.slice(i, (i + size)));
        }
        return out;
    }
}

VrGameDataReader.POINTER_SIZE    = 4;
VrGameDataReader.RECORD_WORDS    = 4;
VrGameDataReader.PATH_WORDS      = 3;
// Pointers of a course progress block ($C700-$C70C, then the race path of entity +$B2).
VrGameDataReader.SECTIONS_FIELD  = 0;
VrGameDataReader.PROGRESS_FIELD  = 4;
VrGameDataReader.CRASH_FIELD     = 8;
VrGameDataReader.PIT_PATH_FIELD  = 12;
VrGameDataReader.RACE_PATH_FIELD = 16;

module.exports = {VrGameDataReader};

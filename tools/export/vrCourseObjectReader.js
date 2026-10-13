const {VrModelEncoder} = require('./vrModelEncoder');

/**
 * Reads the objects the 68K places around a course besides its scenery grid ($37B6, then the routine of the course
 * from the table $3844), as raw ROM values. An object has one or two parts: the second one is placed in the frame of
 * the first. The 68K writes them to render descriptors only while the car is near; the export keeps them all.
 *
 *   part: {position: [x, y, z]} (x / z in entity units, y in 1/256 m) or {offset: [x, y, z]} (1/256 m, in the frame of
 *         the first part), angles: [pitch, yaw, roll] (1/8192 turn), scale (8.8, 0 = unscaled), frames: model ids,
 *         frameTicks (ticks an image stays)
 *   animation: {part, angle: 'yaw' | 'roll', perTick, swing} - the angle turns by perTick a tick; with swing, the angle
 *         is sin(turn << 8) x swing (sin table of amplitude 256)
 */
class VrCourseObjectReader {
    /**
     * @param {VrRom}         rom
     * @param {VrModelReader} reader
     * @param {object}        map - VR_ROM_MAP.courseObjects
     */
    constructor(rom, reader, map) {
        this._rom    = rom;
        this._reader = reader;
        this._map    = map;
    }

    /**
     * @param {int}    course - index in the order of the course tables
     * @param {string} code
     * @param {Map<string, object>} models - filled with the models the objects use, by identifier
     * @returns {object[]}
     */
    read(course, code, models) {
        const map      = this._map;
        const animated = this._rom.pointer68k(map.animated.table, course);
        const objects  = [];
        for (let i = 0; i < map.animated.count; i++) {
            const at     = (animated + (i * map.animated.entryBytes));
            const frames = this._rom.fileFrom68k(this._rom.u32(at + VrCourseObjectReader.ENTRY_POINTER));
            const ids    = Array.from({length: map.animated.frames}, (unused, f) => this._model(this._rom.u32(frames + (f * VrCourseObjectReader.POINTER_SIZE)), models));
            objects.push({parts: [this._part(at, 'yaw', ids, map.animated.frameTicks)]});
        }
        for (const special of (map.byCourse[code] ?? [])) {
            objects.push(...this._special(special, models));
        }

        return objects;
    }

    _special(special, models) {
        const at = this._rom.fileFrom68k(special.address);
        switch (special.kind) {
            case 'pair':
                return [{
                    parts:     [
                        this._part(at, 'yaw', [this._model(this._rom.u32(at + VrCourseObjectReader.ENTRY_POINTER), models)]),
                        this._part((at + VrCourseObjectReader.PAIR_CHILD), 'yaw', [this._model(this._rom.u32(at + VrCourseObjectReader.PAIR_CHILD + VrCourseObjectReader.ENTRY_POINTER), models)], 0, true),
                    ],
                    animation: special.animation,
                }];
            case 'list':
                return Array.from({length: special.count}, (unused, i) => ({
                    parts: [this._part((at + (i * VrCourseObjectReader.LIST_ENTRY_BYTES)), 'yaw', [this._model(special.model, models)])],
                }));
            case 'single': {
                // A model given by the code, or the pointer after the words.
                const pointer = (special.model ?? this._rom.u32(at + VrCourseObjectReader.ENTRY_POINTER));

                return [{
                    parts:     [this._part(at, (special.angle ?? 'yaw'), [this._model(pointer, models)])],
                    animation: special.animation,
                }];
            }
            default:
                throw new Error('unknown course object kind ' + special.kind);
        }
    }

    // x, y, z, one angle, scale: the words the 68K copies to a render descriptor.
    _part(at, angle, frames, frameTicks = 0, child = false) {
        const [x, y, z, value, scale] = this._rom.words(at, VrCourseObjectReader.ENTRY_WORDS, true);
        const angles = [0, 0, 0];
        angles[VrCourseObjectReader.ANGLES.indexOf(angle)] = value;
        const part = {angles, scale, frames};
        part[(child) ? 'offset' : 'position'] = [x, y, z];
        if (frameTicks > 0) {
            part.frameTicks = frameTicks;
        }

        return part;
    }

    _model(pointer, models) {
        const offset = this._rom.fileFromSh2(pointer);
        const id     = VrModelEncoder.id(offset);
        if (!models.has(id)) {
            models.set(id, this._reader.read(offset));
        }

        return id;
    }
}

VrCourseObjectReader.POINTER_SIZE     = 4;
VrCourseObjectReader.ENTRY_WORDS      = 5;
VrCourseObjectReader.ENTRY_POINTER    = 10;
VrCourseObjectReader.LIST_ENTRY_BYTES = 10;
VrCourseObjectReader.PAIR_CHILD       = 14;
// Order of the descriptor angles ($FF6xxx +8, +$A, +$C).
VrCourseObjectReader.ANGLES           = ['pitch', 'yaw', 'roll'];

module.exports = {VrCourseObjectReader};

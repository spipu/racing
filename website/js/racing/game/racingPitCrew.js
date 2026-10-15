/**
 * The 4 mechanics of the pit box (race.json pit): they stand around the box of
 * the first place, in world axes ($3C7E: base of the course, x + dx and
 * z - dz by car, angles 0), and play their animation once (frame = ticks x
 * 7 / 30, $3BBB >> 16, then the last frame held). A frame draws up to 4
 * models together: the body, the tool, the removed wheel, the new wheel.
 * Drawn smoothly (project decision): a model followed by one of the same
 * topology in the next frame is morphed towards it over the frame, from the
 * pose of the original when the frame begins; the wheels go from the hands to
 * where they lie and back without a jump (RacingPitCrewWheels).
 */
class RacingPitCrew {
    /**
     * @param {RacingModelConverter} converter
     * @param {object}  race     - race.json (pit, pitModels)
     * @param {object}  cars     - cars.json
     * @param {object}  car      - entry of cars.json cars
     * @param {string}  course   - course code
     * @param {number}  carScale - metres per car model unit
     * @param {boolean} mirror
     */
    constructor(converter, race, cars, car, course, carScale, mirror) {
        const pit    = race.pit;
        const side   = ((mirror) ? -1 : 1);
        const wheels = new RacingPitCrewWheels(race, cars, car);
        const load   = (model) => loader.objects().loadFromData(null, converter.toObjectData(model, carScale, mirror));
        const [x, y, z] = pit.mechanicBases[course];
        this._frame     = -1;
        this._elapsed   = 0; // ticks the current frame has played
        this._instances = [];
        this._mechanics = pit.mechanics.map((mechanic, n) => {
            const [dx, dz] = pit.mechanicOffsets[car.code][n];
            const origin   = [(dx * RacingPitCrew.MODEL_UNITS_PER_ENTITY_UNIT), 0, (-dz * RacingPitCrew.MODEL_UNITS_PER_ENTITY_UNIT)];
            const shapes   = wheels.bodyShapes(mechanic.frames, origin);
            const parts    = new Map();
            const part     = (objectId) => {
                const instanceId = loader.instances().loadFromData(null, RacingCarView.instanceData(objectId));

                return {objectId: objectId, instanceId: instanceId};
            };
            const own      = (code) => {
                if (!parts.has(code)) {
                    parts.set(code, part(load(wheels.model(code))));
                }
                return parts.get(code);
            };
            // Each model of a frame: what is drawn, and the object it is morphed towards over the frame (a shape of its
            // own, or the next frame's model when it has the same topology).
            const frames = mechanic.frames.map((models, k) => models.map((code, column) => {
                if (code === null) {
                    return null;
                }
                const shape = ((column === RacingPitCrew.BODY) ? shapes[k] : {start: null, end: null});
                const next  = (((k + 1) < mechanic.frames.length) ? mechanic.frames[k + 1][column] : null);
                let goalId  = null;
                if (shape.end !== null) {
                    goalId = load(shape.end);
                } else if ((next !== null) && (next !== code)) {
                    goalId = own(next).objectId;
                }

                return {drawn: ((shape.start === null) ? own(code) : part(load(shape.start))), goalId, goal: null, morph: false};
            }));

            return {
                frames,
                position: [
                    ((x + dx) * RacingGame.METRES_PER_ENTITY_UNIT * side),
                    (y * RacingGame.METRES_PER_HEIGHT_UNIT),
                    ((z - dz) * RacingGame.METRES_PER_ENTITY_UNIT)
                ],
            };
        });
    }

    bind() {
        for (const mechanic of this._mechanics) {
            for (const entry of mechanic.frames.flat()) {
                if (entry === null) {
                    continue;
                }
                const part = entry.drawn;
                if (part.instance === undefined) {
                    part.object   = loader.objects().get(part.objectId);
                    part.instance = loader.instances().get(part.instanceId);
                    part.instance.setPose(mechanic.position, [0, 0, 0], [0, 0, 0]);
                }
                entry.goal  = ((entry.goalId === null) ? null : loader.objects().get(entry.goalId));
                entry.morph = ((entry.goal !== null) && part.object.isMorphableTo(entry.goal));
            }
        }

        return this;
    }

    /**
     * @returns {Instance[]} every model of every mechanic
     */
    getAllInstances() {
        const all = new Set();
        for (const mechanic of this._mechanics) {
            for (const entry of mechanic.frames.flat()) {
                if (entry !== null) {
                    all.add(entry.drawn.instance);
                }
            }
        }

        return [...all];
    }

    /**
     * @param {number}  frame   - animation frame, -1 when the crew is away ($C026)
     * @param {number}  ticks   - time elapsed, in original ticks
     * @param {boolean} running - the animation plays (its first frame is also held before it starts)
     */
    setFrame(frame, ticks, running) {
        if (frame !== this._frame) {
            this._frame   = frame;
            this._elapsed = 0;
            this._showFrame();
        } else if (running) {
            this._elapsed += ticks;
        }
        if (frame >= 0) {
            this._morph(Math.min((this._elapsed / RacingPitCrew._frameTicks(frame)), 1));
        }

        return this;
    }

    _entries(mechanic) {
        return mechanic.frames[Math.min(this._frame, (mechanic.frames.length - 1))];
    }

    _showFrame() {
        this._instances.length = 0;
        if (this._frame < 0) {
            return;
        }
        for (const mechanic of this._mechanics) {
            for (const entry of this._entries(mechanic)) {
                if (entry !== null) {
                    this._instances.push(entry.drawn.instance);
                }
            }
        }
    }

    _morph(share) {
        for (const mechanic of this._mechanics) {
            for (const entry of this._entries(mechanic)) {
                if (entry !== null) {
                    entry.drawn.object.setMorph(((entry.morph) ? entry.goal : null), share);
                }
            }
        }
    }

    // Ticks the original shows a frame: from the first tick it reaches it to the first it reaches the next.
    static _frameTicks(frame) {
        const first = (n) => Math.ceil((n * RacingCarPhysics.CREW_FRAME_ONE) / RacingCarPhysics.CREW_FRAME_RATE);

        return (first(frame + 1) - first(frame));
    }

    /**
     * @returns {Instance[]} the models of the current frame
     */
    getInstances() {
        return this._instances;
    }
}

// $3CEC: frames during which the mechanics hold the car's wheels.
RacingPitCrew.WHEELS_OFF_FIRST = 7;
RacingPitCrew.WHEELS_OFF_END   = 0x13;
// Column of the body in a frame of race.json pit.mechanics.
RacingPitCrew.BODY = 0;
// Car model units per entity unit (x / z of the mechanics' offsets).
RacingPitCrew.MODEL_UNITS_PER_ENTITY_UNIT = 64;

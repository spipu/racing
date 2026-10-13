/**
 * The 4 mechanics of the pit box (race.json pit): they stand around the box of
 * the first place, in world axes ($3C7E: base of the course, x + dx and
 * z - dz by car, angles 0), and play their animation once (frame = ticks x
 * 7 / 30, $3BBB >> 16, then the last frame held). A frame draws up to 4
 * models together: the body, the tool, the removed wheel, the new wheel.
 */
class RacingPitCrew {
    /**
     * @param {RacingModelConverter} converter
     * @param {object}  race     - race.json (pit, pitModels)
     * @param {string}  course   - course code
     * @param {string}  car      - car code
     * @param {number}  carScale - metres per car model unit
     * @param {boolean} mirror
     */
    constructor(converter, race, course, car, carScale, mirror) {
        const pit   = race.pit;
        const side  = ((mirror) ? -1 : 1);
        const [x, y, z] = pit.mechanicBases[course];
        this._frame     = -1;
        this._instances = [];
        this._mechanics = pit.mechanics.map((mechanic, n) => {
            const [dx, dz] = pit.mechanicOffsets[car][n];
            const parts    = new Map();
            for (const code of mechanic.frames.flat()) {
                if ((code !== null) && !parts.has(code)) {
                    const objectId = loader.objects().loadFromData(null, converter.toObjectData(race.pitModels[code], carScale, mirror));
                    parts.set(code, {instanceId: loader.instances().loadFromData(null, RacingCarView.instanceData(objectId)), instance: null});
                }
            }

            return {
                frames:   mechanic.frames,
                parts:    parts,
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
            for (const part of mechanic.parts.values()) {
                part.instance = loader.instances().get(part.instanceId);
                part.instance.setPose(mechanic.position, [0, 0, 0], [0, 0, 0]);
            }
        }

        return this;
    }

    /**
     * @returns {Instance[]} every model of every mechanic
     */
    getAllInstances() {
        return this._mechanics.flatMap((mechanic) => [...mechanic.parts.values()].map((part) => part.instance));
    }

    /**
     * @param {number} frame - animation frame, -1 when the crew is away ($C026)
     */
    setFrame(frame) {
        if (frame === this._frame) {
            return this;
        }
        this._frame = frame;
        this._instances.length = 0;
        if (frame < 0) {
            return this;
        }
        for (const mechanic of this._mechanics) {
            for (const code of mechanic.frames[Math.min(frame, (mechanic.frames.length - 1))]) {
                if (code !== null) {
                    this._instances.push(mechanic.parts.get(code).instance);
                }
            }
        }

        return this;
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

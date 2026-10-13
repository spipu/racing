/**
 * The objects the original places around a course besides its scenery grid
 * (courses/<code>.json objects): animated banners, the Ferris wheel and the
 * swing boat of Big Forest, the windmill of Bay Bridge, the weather vane of
 * Highland... The original shows one at a time, near the car (a limit of the
 * 32X): here they all stay in the scenery, like the rest of the course.
 *
 * A part is placed in the world (x / z in entity units, y in 1/256 m) or, for
 * the second part of an object, in the frame of the first one (1/256 m);
 * angles in 1/8192 turn, scale in 8.8 (0 = unscaled). An animation turns an
 * angle of a part by a counter of the ticks ($C8E2), or swings it by its sine.
 */
class RacingCourseObjects {
    /**
     * @param {RacingModelConverter} converter
     * @param {object}  course   - the course file (objects, objectModels)
     * @param {number}  carScale - metres per car model unit
     * @param {boolean} mirror
     */
    constructor(converter, course, carScale, mirror) {
        this._side      = ((mirror) ? -1 : 1);
        this._ticks     = 0;
        this._instances = [];
        this._objects   = (course.objects ?? []).map((object) => ({
            animation: (object.animation ?? null),
            parts:     object.parts.map((part) => this._part(converter, course.objectModels, part, carScale, mirror)),
        }));
    }

    bind() {
        for (const object of this._objects) {
            for (const part of object.parts) {
                part.instances = part.instanceIds.map((id) => loader.instances().get(id));
            }
        }

        return this;
    }

    /**
     * @returns {Instance[]} every image of every part
     */
    getAllInstances() {
        return this._objects.flatMap((object) => object.parts.flatMap((part) => part.instances));
    }

    /**
     * @returns {Instance[]} the instances to draw: the current image of each part
     */
    getInstances() {
        return this._instances;
    }

    /**
     * @param {number} ticks - time elapsed, in original ticks
     */
    animate(ticks) {
        this._ticks += ticks;
        this._instances.length = 0;
        for (const object of this._objects) {
            const [first, second] = object.parts;
            const turn = this._turn(object.animation);
            const yaw  = (first.yaw + ((turn.part === 0) ? turn.yaw : 0));
            this._place(first, first.position, [0, 0, 0], yaw, (first.roll + ((turn.part === 0) ? turn.roll : 0)));
            if (second !== undefined) {
                this._place(second, first.position, second.offset, (yaw + second.yaw), (second.roll + ((turn.part === 1) ? turn.roll : 0)));
            }
        }

        return this;
    }

    // Angles of the animation now, in degrees.
    _turn(animation) {
        if (animation === null) {
            return {part: -1, yaw: 0, roll: 0};
        }
        const counter = (animation.perTick * this._ticks);
        let angle     = ((counter % RacingCourseObjects.TURN) / RacingCourseObjects.TURN);
        if (animation.swing !== undefined) {
            // sin((counter << 8) in 1/65536 turn) x 256 x swing, in 1/8192 turn.
            const phase = ((counter * RacingCourseObjects.SWING_SHIFT) / RacingCourseObjects.SINE_TURN);
            angle = ((Math.sin(phase * 2 * Math.PI) * RacingCourseObjects.SINE_AMPLITUDE * animation.swing) / RacingCourseObjects.TURN);
        }
        const degrees = (angle * 360);

        return {
            part: animation.part,
            yaw:  ((animation.angle === 'yaw') ? (-degrees * this._side) : 0),
            roll: ((animation.angle === 'roll') ? (degrees * this._side) : 0),
        };
    }

    _place(part, position, offset, yaw, roll) {
        const instance = part.instances[(part.frameTicks > 0) ? (Math.floor(this._ticks / part.frameTicks) % part.instances.length) : 0];
        instance.setRotation([0, yaw, 0]).setPose(position, offset, [0, 0, roll]);
        this._instances.push(instance);
    }

    _part(converter, models, part, carScale, mirror) {
        const scale  = (carScale * ((part.scale === 0) ? 1 : (part.scale / RacingCourseObjects.SCALE_ONE)));
        const angles = part.angles.map((value) => ((value * 360) / RacingCourseObjects.TURN));
        const height = RacingGame.METRES_PER_HEIGHT_UNIT;

        return {
            instanceIds: part.frames.map((id) => {
                const objectId = loader.objects().loadFromData(null, converter.toObjectData(models[id], scale, mirror));

                return loader.instances().loadFromData(null, RacingCarView.instanceData(objectId));
            }),
            instances:  [],
            frameTicks: (part.frameTicks ?? 0),
            position:   ((part.position === undefined) ? null : [
                (part.position[0] * RacingGame.METRES_PER_ENTITY_UNIT * this._side),
                (part.position[1] * height),
                (part.position[2] * RacingGame.METRES_PER_ENTITY_UNIT)
            ]),
            offset:     ((part.offset === undefined) ? null : [(part.offset[0] * height * this._side), (part.offset[1] * height), (part.offset[2] * height)]),
            yaw:        (-angles[RacingCourseObjects.YAW] * this._side),
            roll:       (angles[RacingCourseObjects.ROLL] * this._side),
        };
    }
}

// Descriptor angles: 1/8192 turn, [pitch, yaw, roll].
RacingCourseObjects.TURN           = 8192;
RacingCourseObjects.YAW            = 1;
RacingCourseObjects.ROLL           = 2;
RacingCourseObjects.SCALE_ONE      = 256;
// The swing reads the sine table at the counter << 8, in 1/65536 turn, amplitude 256.
RacingCourseObjects.SWING_SHIFT    = 256;
RacingCourseObjects.SINE_TURN      = 65536;
RacingCourseObjects.SINE_AMPLITUDE = 256;

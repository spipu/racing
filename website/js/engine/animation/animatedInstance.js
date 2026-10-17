/**
 * An animated character in the world: its own copy of the model's geometry
 * (an Object3d), the engine Instance that places and draws it, its pose, its
 * player and the objects it handles. The game calls update at each frame (0
 * under a pause, to draw the pose still); the engine imposes no loop.
 *
 * An object taken (attach) follows a socket; one laid down (detach with a
 * place) goes to its place, then stays there. Either way it may move there
 * over a transition, from where it was, its speed rising and falling to zero:
 * never a jump.
 *
 * A mirrored instance (scene mirrored in x) negates x after the skinning; the
 * objects it handles must be built mirrored too, as any geometry of that scene.
 */
class AnimatedInstance {
    /**
     * Registers the geometry and the Instance in the loader; bind once the loader is ready.
     *
     * @param {AnimatedModel} model
     * @param {{materialColor?: function(object): number[], mirror?: boolean, position?: number[],
     *          rotation?: number[]}} options - materialColor: [r, g, b(, alpha)] 0-255 of a material (default its
     *          glTF color, ModelMesh.materialColor); rotation in degrees as Instance.setRotation
     */
    constructor(model, options = {}) {
        const materialColor = (options.materialColor ?? ModelMesh.materialColor);
        const pose          = new SkeletonPose(model.getSkeleton());

        this._model       = model;
        this._mirror      = (options.mirror === true);
        this._pose        = pose;
        this._player      = new AnimationPlayer(pose);
        this._objectId    = loader.objects().loadFromData(null, model.getMesh().toObjectData(model.getMaterials(), materialColor, this._mirror));
        this._instanceId  = loader.instances().loadFromData(null, {
            object:         this._objectId,
            position:       [...(options.position ?? [0, 0, 0])],
            rotation:       [...(options.rotation ?? [0, 0, 0])],
            trigger:        'none',
            keyframes:      [],
            collisionShape: 'none',
        });
        this._object      = null;
        this._instance    = null;
        this._placement   = Mat4.create();
        this._translation = new Float32Array(Skeleton.TRANSLATION_SIZE);
        this._orientation = new Float32Array(Skeleton.ROTATION_SIZE);
        this._rootMotion  = new Float32Array(AnimationPlayer.ROOT_MOTION_SIZE);
        this._handled     = [];
    }

    bind() {
        this._object   = loader.objects().get(this._objectId);
        this._instance = loader.instances().get(this._instanceId);
        this._refreshPlacement();

        return this;
    }

    getInstance() {
        return this._instance;
    }

    getPlayer() {
        return this._player;
    }

    getPose() {
        return this._pose;
    }

    /**
     * @param {number[]} position
     * @param {number[]} rotation - degrees, as Instance.setRotation
     */
    place(position, rotation) {
        this._instance.setRotation(rotation);
        this._instance.setPose(position, [0, 0, 0], [0, 0, 0]);
        this._refreshPlacement();

        return this;
    }

    /**
     * Plays the clips, poses the skeleton, writes the geometry, then moves the objects handled; one laid down is let
     * go once at its place.
     *
     * @param {number}           dt        - seconds
     * @param {AnimationEvent[]} eventsOut - the events crossed (AnimationPlayer.advance)
     */
    update(dt, eventsOut) {
        this._player.advance(dt, eventsOut);
        this._pose.computeWorld().computeSkinning();
        this._model.getMesh().skinInto(this._object, this._pose, this._mirror);
        this._instance.refreshWorldCenter();
        for (const handled of this._handled) {
            handled.elapsed = Math.min((handled.elapsed + dt), handled.duration);
            this._move(handled);
        }
        if (this._handled.some((handled) => AnimatedInstance._laid(handled))) {
            this._handled = this._handled.filter((handled) => !AnimatedInstance._laid(handled));
        }

        return eventsOut;
    }

    /**
     * Moves the instance by the root motion of the last update, turned as the character is (mirror included): the
     * travel the clips give the feet, so they do not slide on the ground.
     */
    applyRootMotion() {
        const motion = this._player.getRootMotion(this._rootMotion);
        const m      = this._placement;
        const dx     = (this._mirror ? -motion[0] : motion[0]);
        const dz     = motion[1];
        const x      = ((dx * m[0]) + (dz * m[AnimatedInstance.Z_ROW]));
        const y      = ((dx * m[1]) + (dz * m[AnimatedInstance.Z_ROW + 1]));
        const z      = ((dx * m[2]) + (dz * m[AnimatedInstance.Z_ROW + 2]));

        this._instance.translate(x, y, z);
        m[AnimatedInstance.TRANSLATION_ROW]     += x;
        m[AnimatedInstance.TRANSLATION_ROW + 1] += y;
        m[AnimatedInstance.TRANSLATION_ROW + 2] += z;

        return this;
    }

    /**
     * The instance follows the socket until detached, reaching it from where it is over the transition; its own
     * transform is replaced by a world matrix.
     *
     * @param {Instance} instance
     * @param {string}   socketName
     * @param {number}   transition - seconds, 0: at once
     */
    attach(instance, socketName, transition = 0) {
        this._handle(instance, this._model.getSocket(socketName), null, transition);

        return this;
    }

    /**
     * Lets the instance go: without a place it stays where it is; with one, it goes there over the transition, then
     * stays (an instance not held is laid there the same way).
     *
     * @param {Instance}          instance
     * @param {Float32Array|null} place      - in the model's space (Mat4), as the clips' events give it
     * @param {number}            transition - seconds, 0: at once
     */
    detach(instance, place = null, transition = 0) {
        this._handled = this._handled.filter((handled) => (handled.instance !== instance));
        if (place !== null) {
            this._handle(instance, null, this.toWorld(Mat4.create(), place), transition);
        }

        return this;
    }

    /**
     * @param {string}       name
     * @param {Float32Array} out  - the socket in the world (Mat4 layout)
     */
    socketMatrix(name, out) {
        const socket = this._model.getSocket(name);

        return this.toWorld(out, Mat4.multiply(out, socket.getOffset(), this._pose.getWorld(socket.getJoint())));
    }

    /**
     * A transform in the model's space (as the clips and their events give it) into the world.
     *
     * @param {Float32Array} out   - may be local
     * @param {Float32Array} local
     */
    toWorld(out, local) {
        if (this._mirror) {
            Mat4.mirrorX(out, local);
            return Mat4.multiply(out, out, this._placement);
        }

        return Mat4.multiply(out, local, this._placement);
    }

    // Buffers made here, once per taking or laying: the frames that move the instance allocate nothing.
    _handle(instance, socket, place, transition) {
        this._handled = this._handled.filter((handled) => (handled.instance !== instance));
        const from = Mat4.fromMatrix(Mat4.create(), Matrix.composeInstanceTransform(instance.getTransform()));
        const handled = {
            instance:        instance,
            socket:          socket,
            place:           place,
            elapsed:         0,
            duration:        Math.max(transition, 0),
            fromTranslation: Float32Array.of(from[AnimatedInstance.TRANSLATION_ROW], from[AnimatedInstance.TRANSLATION_ROW + 1], from[AnimatedInstance.TRANSLATION_ROW + 2]),
            fromRotation:    Quaternion.fromMat4(new Float32Array(Skeleton.ROTATION_SIZE), 0, from),
            translation:     new Float32Array(Skeleton.TRANSLATION_SIZE),
            rotation:        new Float32Array(Skeleton.ROTATION_SIZE),
            target:          Mat4.create(),
            world:           Mat4.create(),
            matrix:          new Matrix().identity(),
        };
        this._handled.push(handled);
        this._move(handled);
    }

    // Where the instance is now: its goal (the socket, or its place), or on the way from where it started.
    _move(handled) {
        const target = handled.target;
        if (handled.socket === null) {
            Mat4.copy(target, handled.place);
        } else {
            Mat4.multiply(target, handled.socket.getOffset(), this._pose.getWorld(handled.socket.getJoint()));
            this.toWorld(target, target);
        }
        let world = target;
        if (handled.elapsed < handled.duration) {
            const share = (handled.elapsed / handled.duration);
            const eased = ((3 * share * share) - (2 * share * share * share));
            const t     = handled.translation;
            for (let k = 0; k < Skeleton.TRANSLATION_SIZE; k++) {
                t[k] = (handled.fromTranslation[k] + ((target[AnimatedInstance.TRANSLATION_ROW + k] - handled.fromTranslation[k]) * eased));
            }
            Quaternion.fromMat4(handled.rotation, 0, target);
            Quaternion.slerp(handled.rotation, 0, handled.fromRotation, 0, handled.rotation, 0, eased);
            world = Mat4.fromTranslationRotationScale(handled.world, t, 0, handled.rotation, 0, AnimatedInstance.UNIT_SCALE, 0);
        }
        handled.instance.setWorldMatrix(Mat4.toMatrix(handled.matrix, world));
    }

    // A laying finished: the instance stays at its place, no longer moved.
    static _laid(handled) {
        return ((handled.socket === null) && (handled.elapsed >= handled.duration));
    }

    // The Instance's position and rotation as a Mat4 (Matrix.composeInstanceTransform without the animation deltas).
    _refreshPlacement() {
        this._translation.set(this._instance.getPosition());
        Quaternion.fromDegrees(this._orientation, 0, this._instance.getRotation());
        Mat4.fromTranslationRotationScale(this._placement, this._translation, 0, this._orientation, 0, AnimatedInstance.UNIT_SCALE, 0);
    }
}

AnimatedInstance.UNIT_SCALE      = Float32Array.of(1, 1, 1);
// Rows of a Mat4 (row vectors): the image of z, the translation.
AnimatedInstance.Z_ROW           = (2 * Mat4.ORDER);
AnimatedInstance.TRANSLATION_ROW = (3 * Mat4.ORDER);

/**
 * An animated character in the world: its own copy of the model's geometry
 * (an Object3d), the engine Instance that places and draws it, its pose, its
 * player and the objects it holds. The game calls update at each frame (0
 * under a pause, to draw the pose still); the engine imposes no loop.
 *
 * A mirrored instance (scene mirrored in x) negates x after the skinning; the
 * objects it holds must be built mirrored too, as any geometry of that scene.
 */
class AnimatedInstance {
    /**
     * Registers the geometry and the Instance in the loader; bind once the loader is ready.
     *
     * @param {AnimatedModel} model
     * @param {{materialColor?: function(object): number[], mirror?: boolean, position?: number[],
     *          rotation?: number[]}} options - materialColor: [r, g, b(, alpha)] 0-255 of a material (default its
     *          glTF color); rotation in degrees as Instance.setRotation
     */
    constructor(model, options = {}) {
        const materialColor = (options.materialColor ?? AnimatedInstance.materialColor);
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
        this._scratch     = Mat4.create();
        this._translation = new Float32Array(Skeleton.TRANSLATION_SIZE);
        this._orientation = new Float32Array(Skeleton.ROTATION_SIZE);
        this._rootMotion  = new Float32Array(AnimationPlayer.ROOT_MOTION_SIZE);
        this._attachments = [];
    }

    /**
     * The default color of a material: its glTF base color.
     *
     * @param {{color: number[]}} material
     * @returns {number[]}
     */
    static materialColor(material) {
        const [r, g, b, a] = material.color;
        const rgb          = [(r * AnimatedInstance.CHANNEL_MAX), (g * AnimatedInstance.CHANNEL_MAX), (b * AnimatedInstance.CHANNEL_MAX)];

        return ((a < 1) ? [...rgb, a] : rgb);
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
     * Plays the clips, poses the skeleton, writes the geometry, then moves the objects held.
     *
     * @param {number}           dt        - seconds
     * @param {AnimationEvent[]} eventsOut - the events crossed (AnimationPlayer.advance)
     */
    update(dt, eventsOut) {
        this._player.advance(dt, eventsOut);
        this._pose.computeWorld().computeSkinning();
        this._model.getMesh().skinInto(this._object, this._pose, this._mirror);
        this._instance.refreshWorldCenter();
        for (const attachment of this._attachments) {
            this._holdAt(attachment);
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
     * The instance follows the socket until detached; its own transform is replaced by a world matrix.
     *
     * @param {Instance} instance
     * @param {string}   socketName
     */
    attach(instance, socketName) {
        this.detach(instance);
        const attachment = {instance: instance, socket: this._model.getSocket(socketName), matrix: new Matrix().identity()};

        this._attachments.push(attachment);
        this._holdAt(attachment);

        return this;
    }

    // The instance stays where it was held.
    detach(instance) {
        this._attachments = this._attachments.filter((attachment) => (attachment.instance !== instance));

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

    _holdAt(attachment) {
        const socket = attachment.socket;

        Mat4.multiply(this._scratch, socket.getOffset(), this._pose.getWorld(socket.getJoint()));
        this.toWorld(this._scratch, this._scratch);
        attachment.instance.setWorldMatrix(Mat4.toMatrix(attachment.matrix, this._scratch));
    }

    // The Instance's position and rotation as a Mat4 (Matrix.composeInstanceTransform without the animation deltas).
    _refreshPlacement() {
        this._translation.set(this._instance.getPosition());
        Quaternion.fromDegrees(this._orientation, 0, this._instance.getRotation());
        Mat4.fromTranslationRotationScale(this._placement, this._translation, 0, this._orientation, 0, AnimatedInstance.UNIT_SCALE, 0);
    }
}

// Face colors of Object3d: 0-255.
AnimatedInstance.CHANNEL_MAX     = 255;
AnimatedInstance.UNIT_SCALE      = Float32Array.of(1, 1, 1);
// Rows of a Mat4 (row vectors): the image of z, the translation.
AnimatedInstance.Z_ROW           = (2 * Mat4.ORDER);
AnimatedInstance.TRANSLATION_ROW = (3 * Mat4.ORDER);

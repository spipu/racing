/**
 * Binds a curve to a property of a joint: its translation, rotation or scale.
 */
class AnimationChannel {
    /**
     * @param {AnimationSampler} sampler
     * @param {int}              joint
     * @param {string}           path - AnimationChannel.TRANSLATION, ROTATION or SCALE
     */
    constructor(sampler, joint, path) {
        const size = AnimationChannel.SIZES[path];
        if (size === undefined) {
            throw new Error('AnimationChannel - unknown path ' + path);
        }
        if (sampler.getComponents() !== size) {
            throw new Error('AnimationChannel - ' + path + ' takes ' + size + ' components, not ' + sampler.getComponents());
        }

        this._sampler = sampler;
        this._joint   = joint;
        this._path    = path;
        this._offset  = (joint * size);
        Object.freeze(this);
    }

    getSampler() {
        return this._sampler;
    }

    getJoint() {
        return this._joint;
    }

    getPath() {
        return this._path;
    }

    /**
     * @param {SkeletonPose} pose
     * @param {number}       t
     * @param {{key: int}}   cursor
     */
    applyTo(pose, t, cursor) {
        this._sampler.sample(t, cursor, this._target(pose), this._offset);
    }

    _target(pose) {
        if (this._path === AnimationChannel.TRANSLATION) {
            return pose.getTranslation();
        }
        if (this._path === AnimationChannel.ROTATION) {
            return pose.getRotation();
        }

        return pose.getScale();
    }
}

// glTF names.
AnimationChannel.TRANSLATION = 'translation';
AnimationChannel.ROTATION    = 'rotation';
AnimationChannel.SCALE       = 'scale';
AnimationChannel.SIZES       = Object.freeze({
    [AnimationChannel.TRANSLATION]: Skeleton.TRANSLATION_SIZE,
    [AnimationChannel.ROTATION]:    Skeleton.ROTATION_SIZE,
    [AnimationChannel.SCALE]:       Skeleton.SCALE_SIZE,
});

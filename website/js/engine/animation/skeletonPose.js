/**
 * The changing state of a skeleton for one instance: local translation,
 * rotation and scale of each joint, from which the joints' matrices in the
 * model are computed, then the skinning matrices (joint × inverse bind). All
 * its buffers are allocated here, none by frame.
 */
class SkeletonPose {
    /**
     * @param {Skeleton} skeleton
     */
    constructor(skeleton) {
        const count    = skeleton.getJointCount();
        const world    = new Float32Array(count * Mat4.SIZE);
        const skinning = new Float32Array(count * Mat4.SIZE);

        this._skeleton    = skeleton;
        this._translation = new Float32Array(count * Skeleton.TRANSLATION_SIZE);
        this._rotation    = new Float32Array(count * Skeleton.ROTATION_SIZE);
        this._scale       = new Float32Array(count * Skeleton.SCALE_SIZE);
        this._local       = Mat4.create();
        this._world       = [];
        this._skinning    = [];
        for (let i = 0; i < count; i++) {
            this._world.push(world.subarray((i * Mat4.SIZE), ((i + 1) * Mat4.SIZE)));
            this._skinning.push(skinning.subarray((i * Mat4.SIZE), ((i + 1) * Mat4.SIZE)));
        }
        this.reset();
    }

    getSkeleton() {
        return this._skeleton;
    }

    // Back to the rest pose.
    reset() {
        this._translation.set(this._skeleton.getRestTranslation());
        this._rotation.set(this._skeleton.getRestRotation());
        this._scale.set(this._skeleton.getRestScale());

        return this;
    }

    /**
     * @returns {Float32Array} x y z per joint, written by the animation clips
     */
    getTranslation() {
        return this._translation;
    }

    /**
     * @returns {Float32Array} x y z w per joint
     */
    getRotation() {
        return this._rotation;
    }

    /**
     * @returns {Float32Array} x y z per joint
     */
    getScale() {
        return this._scale;
    }

    /**
     * Moves this pose towards another of the same skeleton, in place: translations and scales linearly, rotations
     * along the shortest arc.
     *
     * @param {SkeletonPose} other
     * @param {number}       weight - 0 keeps this pose, 1 gives the other
     */
    blend(other, weight) {
        const keep = (1 - weight);
        for (let i = 0; i < this._translation.length; i++) {
            this._translation[i] = (this._translation[i] * keep) + (other._translation[i] * weight);
        }
        for (let i = 0; i < this._scale.length; i++) {
            this._scale[i] = (this._scale[i] * keep) + (other._scale[i] * weight);
        }
        for (let o = 0; o < this._rotation.length; o += Skeleton.ROTATION_SIZE) {
            Quaternion.slerp(this._rotation, o, this._rotation, o, other._rotation, o, weight);
        }

        return this;
    }

    // Each joint's matrix in the model: its local matrix, then its parent's.
    computeWorld() {
        const skeleton = this._skeleton;
        const count    = skeleton.getJointCount();
        for (let i = 0; i < count; i++) {
            const parent = skeleton.getParent(i);
            const world  = this._world[i];
            Mat4.fromTranslationRotationScale(((parent < 0) ? world : this._local), this._translation, (i * Skeleton.TRANSLATION_SIZE), this._rotation, (i * Skeleton.ROTATION_SIZE), this._scale, (i * Skeleton.SCALE_SIZE));
            if (parent >= 0) {
                Mat4.multiply(world, this._local, this._world[parent]);
            }
        }

        return this;
    }

    // After computeWorld: the inverse bind, then the joint's matrix in the model.
    computeSkinning() {
        const count = this._skeleton.getJointCount();
        for (let i = 0; i < count; i++) {
            Mat4.multiply(this._skinning[i], this._skeleton.getInverseBind(i), this._world[i]);
        }

        return this;
    }

    getWorld(joint) {
        return this._world[joint];
    }

    getSkinning(joint) {
        return this._skinning[joint];
    }
}

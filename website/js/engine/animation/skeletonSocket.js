/**
 * An attach point of a model: a joint and an offset from it (Mat4 layout),
 * where an object is held (a weapon, a tool, a wheel…).
 */
class SkeletonSocket {
    /**
     * @param {string}       name
     * @param {int}          joint
     * @param {Float32Array} offset - from the socket to the joint
     */
    constructor(name, joint, offset) {
        if (offset.length !== Mat4.SIZE) {
            throw new Error('SkeletonSocket - ' + name + ': the offset is not a 4x4 matrix');
        }

        this._name   = name;
        this._joint  = joint;
        this._offset = offset;
        Object.freeze(this);
    }

    getName() {
        return this._name;
    }

    getJoint() {
        return this._joint;
    }

    getOffset() {
        return this._offset;
    }
}

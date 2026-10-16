/**
 * The joints of a model, fixed once built and shared by every instance:
 * names, parents (always listed before their children), rest pose
 * (translation, rotation, scale relative to the parent) and inverse bind
 * matrices (Mat4 layout: from the model to the joint at bind time).
 */
class Skeleton {
    /**
     * @param {{names: string[], parents: int[], restTranslation: Float32Array, restRotation: Float32Array,
     *          restScale: Float32Array, inverseBind: Float32Array}} data - parent -1 for a root; per joint 3, 4, 3
     *          and 16 floats
     */
    constructor(data) {
        const count = data.names.length;
        Skeleton._check((data.parents.length === count), 'one parent per joint');
        Skeleton._check((data.restTranslation.length === (count * Skeleton.TRANSLATION_SIZE)), 'one rest translation per joint');
        Skeleton._check((data.restRotation.length === (count * Skeleton.ROTATION_SIZE)), 'one rest rotation per joint');
        Skeleton._check((data.restScale.length === (count * Skeleton.SCALE_SIZE)), 'one rest scale per joint');
        Skeleton._check((data.inverseBind.length === (count * Mat4.SIZE)), 'one inverse bind matrix per joint');
        data.parents.forEach((parent, i) => {
            Skeleton._check(((parent >= -1) && (parent < i)), 'joint ' + i + ': parent ' + parent + ' not listed before it');
        });

        this._names           = Object.freeze([...data.names]);
        this._parents         = Object.freeze([...data.parents]);
        this._restTranslation = data.restTranslation;
        this._restRotation    = data.restRotation;
        this._restScale       = data.restScale;
        this._inverseBindOf   =Object.freeze(this._names.map((name, i) => data.inverseBind.subarray((i * Mat4.SIZE), ((i + 1) * Mat4.SIZE))));
        this._indexByName     = new Map(this._names.map((name, i) => [name, i]));
        Object.freeze(this);
    }

    getJointCount() {
        return this._names.length;
    }

    getJointName(joint) {
        return this._names[joint];
    }

    // -1 for a root.
    getParent(joint) {
        return this._parents[joint];
    }

    /**
     * @returns {int} the joint, -1 when no joint has this name
     */
    indexOf(name) {
        return (this._indexByName.get(name) ?? -1);
    }

    getRestTranslation() {
        return this._restTranslation;
    }

    getRestRotation() {
        return this._restRotation;
    }

    getRestScale() {
        return this._restScale;
    }

    getInverseBind(joint) {
        return this._inverseBindOf[joint];
    }

    static _check(condition, message) {
        if (!condition) {
            throw new Error('Skeleton - ' + message);
        }
    }
}

// Floats per joint in the translation, rotation (quaternion) and scale arrays.
Skeleton.TRANSLATION_SIZE = 3;
Skeleton.ROTATION_SIZE    = 4;
Skeleton.SCALE_SIZE       = 3;

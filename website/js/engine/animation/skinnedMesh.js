/**
 * The geometry of an animated model in its bind pose (ModelMesh), with up to
 * four joints and weights per vertex (linear blend skinning). Fixed once
 * built and shared by every instance; skinInto writes the posed vertices into
 * the Object3d of one instance.
 */
class SkinnedMesh extends ModelMesh {
    /**
     * @param {{positions: Float32Array, joints: Uint16Array, weights: Float32Array,
     *          faces: {indices: int[], material: int}[]}} data - per vertex 3 floats, 4 joints and 4 weights
     *          summing to 1; indices of a triangle from 0
     */
    constructor(data) {
        super(data);
        const count = this.getVertexCount();
        this._check((data.joints.length === (count * SkinnedMesh.INFLUENCES)), 'not 4 joints per vertex');
        this._check((data.weights.length === (count * SkinnedMesh.INFLUENCES)), 'not 4 weights per vertex');
        let rigid = true;
        for (let v = 0; v < count; v++) {
            rigid = (rigid && (data.weights[v * SkinnedMesh.INFLUENCES] === 1));
        }

        this._joints  = data.joints;
        this._weights = data.weights;
        this._rigid   = rigid;
        Object.freeze(this);
    }

    /**
     * @returns {int} the highest joint any vertex uses, -1 without vertex
     */
    getHighestJoint() {
        return this._joints.reduce((highest, joint) => Math.max(highest, joint), -1);
    }

    /**
     * Writes the posed vertices into the Object3d built from toObjectData, then refreshes its bounds and normals.
     *
     * @param {Object3d}     object3d
     * @param {SkeletonPose} pose     - after computeWorld and computeSkinning
     * @param {boolean}      mirror
     */
    skinInto(object3d, pose, mirror) {
        const points = object3d.ptOrigin;
        const p      = this._positions;
        for (let v = 0; v < this._count; v++) {
            const o   = (v * SkinnedMesh.POSITION_SIZE);
            const out = points[v];
            if (this._rigid) {
                Mat4.transformPoint(out, 0, pose.getSkinning(this._joints[v * SkinnedMesh.INFLUENCES]), p[o], p[o + 1], p[o + 2]);
            } else {
                this._blendPoint(out, pose, v, p[o], p[o + 1], p[o + 2]);
            }
            if (mirror) {
                out[0] = -out[0];
            }
        }
        object3d.refreshGeometry();
    }

    _blendPoint(out, pose, v, x, y, z) {
        const point = SkinnedMesh.SCRATCH;
        out[0] = 0;
        out[1] = 0;
        out[2] = 0;
        for (let k = 0; k < SkinnedMesh.INFLUENCES; k++) {
            const weight = this._weights[(v * SkinnedMesh.INFLUENCES) + k];
            if (weight === 0) {
                continue;
            }
            Mat4.transformPoint(point, 0, pose.getSkinning(this._joints[(v * SkinnedMesh.INFLUENCES) + k]), x, y, z);
            out[0] += (point[0] * weight);
            out[1] += (point[1] * weight);
            out[2] += (point[2] * weight);
        }
    }

}

// Joints (and weights) per vertex, glTF's JOINTS_0 / WEIGHTS_0.
SkinnedMesh.INFLUENCES    = 4;
// One weighted point at a time, within a call: no state kept.
SkinnedMesh.SCRATCH       = new Float32Array(SkinnedMesh.POSITION_SIZE);

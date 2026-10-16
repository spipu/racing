/**
 * The geometry of an animated model in its bind pose: vertices, up to four
 * joints and weights per vertex (linear blend skinning), triangles and their
 * material. Fixed once built and shared by every instance; skinInto writes
 * the posed vertices into the Object3d of one instance.
 */
class SkinnedMesh {
    /**
     * @param {{positions: Float32Array, joints: Uint16Array, weights: Float32Array,
     *          faces: {indices: int[], material: int}[]}} data - per vertex 3 floats, 4 joints and 4 weights
     *          summing to 1; indices of a triangle from 0
     */
    constructor(data) {
        const count = (data.positions.length / SkinnedMesh.POSITION_SIZE);
        SkinnedMesh._check(Number.isInteger(count), 'positions are not x y z triples');
        SkinnedMesh._check((data.joints.length === (count * SkinnedMesh.INFLUENCES)), 'not 4 joints per vertex');
        SkinnedMesh._check((data.weights.length === (count * SkinnedMesh.INFLUENCES)), 'not 4 weights per vertex');
        data.faces.forEach((face, k) => {
            SkinnedMesh._check(face.indices.every((index) => ((index >= 0) && (index < count))), 'face ' + k + ' points outside the vertices');
        });
        let rigid = true;
        for (let v = 0; v < count; v++) {
            rigid = (rigid && (data.weights[v * SkinnedMesh.INFLUENCES] === 1));
        }

        this._count     = count;
        this._positions = data.positions;
        this._joints    = data.joints;
        this._weights   = data.weights;
        this._faces     = Object.freeze(data.faces.map((face) => Object.freeze({indices: Object.freeze([...face.indices]), material: face.material})));
        this._rigid     = rigid;
        Object.freeze(this);
    }

    getVertexCount() {
        return this._count;
    }

    getFaces() {
        return this._faces;
    }

    /**
     * @returns {int} the highest joint any vertex uses, -1 without vertex
     */
    getHighestJoint() {
        return this._joints.reduce((highest, joint) => Math.max(highest, joint), -1);
    }

    /**
     * Object3dLoader data of the bind pose, for the Object3d of one instance.
     *
     * @param {{color: number[], doubleSided: boolean}[]} materials
     * @param {function(object): number[]}               materialColor - [r, g, b(, alpha)], 0-255 (alpha 0-1)
     * @param {boolean}                                  mirror        - x negated, the faces turned inside out
     * @returns {{points: number[][], faces: {pts: int[], color: number[]}[]}}
     */
    toObjectData(materials, materialColor, mirror) {
        const sx     = ((mirror) ? -1 : 1);
        const points = [];
        for (let v = 0; v < this._count; v++) {
            const p = (v * SkinnedMesh.POSITION_SIZE);
            points.push([(this._positions[p] * sx), this._positions[p + 1], this._positions[p + 2]]);
        }
        const faces = [];
        for (const face of this._faces) {
            const [a, b, c] = face.indices.map((index) => (index + 1));
            const material  = materials[face.material];
            const color     = materialColor(material);
            faces.push({pts: ((mirror) ? [a, c, b] : [a, b, c]), color: [...color]});
            if (material.doubleSided) {
                faces.push({pts: ((mirror) ? [a, b, c] : [a, c, b]), color: [...color]});
            }
        }

        return {points, faces};
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

    static _check(condition, message) {
        if (!condition) {
            throw new Error('SkinnedMesh - ' + message);
        }
    }
}

SkinnedMesh.POSITION_SIZE = 3;
// Joints (and weights) per vertex, glTF's JOINTS_0 / WEIGHTS_0.
SkinnedMesh.INFLUENCES    = 4;
// One weighted point at a time, within a call: no state kept.
SkinnedMesh.SCRATCH       = new Float32Array(SkinnedMesh.POSITION_SIZE);

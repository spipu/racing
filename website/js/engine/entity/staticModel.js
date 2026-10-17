/**
 * A static model read from a file, loaded once: a mesh and its materials (no
 * palette applied: a material may carry a paletteIndex in its extras). Drawn
 * by the Object3d built from toObjectData, as any object.
 */
class StaticModel extends AbstractLoadedEntity {
    constructor(id, url, callback) {
        super(id, url, callback);

        this._mesh      = null;
        this._materials = [];
    }

    /**
     * @param {{mesh: ModelMesh, materials: {color: number[], doubleSided: boolean, extras: object}[]}} data - material
     *        colors [r, g, b, a] 0-1
     */
    populate(data) {
        data.mesh.getFaces().forEach((face, k) => {
            StaticModel._check((data.materials[face.material] !== undefined), 'face ' + k + ': no material ' + face.material);
        });

        this._mesh      = data.mesh;
        this._materials = Object.freeze(data.materials.map((material) => Object.freeze({...material})));

        return this;
    }

    getMesh() {
        return this._mesh;
    }

    getMaterials() {
        return this._materials;
    }

    /**
     * Object3dLoader data of the model.
     *
     * @param {function(object): number[]} materialColor - [r, g, b(, alpha)] 0-255 of a material (alpha 0-1)
     * @param {boolean}                    mirror        - x negated, the faces turned inside out
     */
    toObjectData(materialColor = ModelMesh.materialColor, mirror = false) {
        return this._mesh.toObjectData(this._materials, materialColor, mirror);
    }

    static _check(condition, message) {
        if (!condition) {
            throw new Error('StaticModel - ' + message);
        }
    }
}

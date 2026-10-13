const {VrDecalLayers} = require('./vrDecalLayers');

/**
 * Exported form of a model and its identifier, shared by the cars and the courses.
 *
 * Model: v = flat vertex coordinates (ROM axes), f = faces {c: palette index, i: vertex indices, d: no backface
 * culling, n: normal, l: layer over the earlier coplanar faces (VrDecalLayers)}.
 */
class VrModelEncoder {
    constructor() {
        this._layers = new VrDecalLayers();
    }

    /**
     * @param {object}     model
     * @param {int[]|null} layers - the model's own coplanar order when null
     */
    encode(model, layers = null) {
        layers = (layers ?? this._layers.compute(model));
        return {
            v: model.vertices.flat(),
            f: model.faces.map((face, index) => {
                const encoded = {c: face.colorIndex, i: face.indices};
                if (layers[index] > 0) {
                    encoded.l = layers[index];
                }
                if (face.doubleSided) {
                    encoded.d = 1;
                }
                if (face.normal !== undefined) {
                    encoded.n = face.normal;
                }
                return encoded;
            }),
        };
    }

    /**
     * The models of a course, with the coplanar faces ordered across models too.
     *
     * @param {Map<string, object>} models - by identifier
     * @returns {object} encoded models by identifier
     */
    encodeScene(models) {
        const list    = [...models.values()];
        const layers  = this._layers.computeScene(list);
        const encoded = {};
        [...models.keys()].forEach((id, i) => {
            encoded[id] = this.encode(list[i], layers[i]);
        });

        return encoded;
    }

    /**
     * File offset of a model, in hexadecimal.
     */
    static id(offset) {
        return VrModelEncoder.hex(offset, VrModelEncoder.ID_DIGITS);
    }

    static hex(value, digits) {
        return value.toString(16).toUpperCase().padStart(digits, '0');
    }
}

VrModelEncoder.ID_DIGITS = 6;

module.exports = {VrModelEncoder};

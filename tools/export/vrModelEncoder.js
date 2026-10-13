const {VrDecalLayers} = require('./vrDecalLayers');

/**
 * Exported form of a model and its identifier, shared by the cars and the courses.
 *
 * Model: v = flat vertex coordinates (ROM axes), f = faces {c: palette index, i: vertex indices, d: no backface
 * culling, n: normal, l: lift in model units over the coplanar faces it covers (VrDecalLayers)}.
 */
class VrModelEncoder {
    constructor() {
        this._carLayers     = new VrDecalLayers(VrModelEncoder.CAR_UNITS_PER_METRE, VrModelEncoder.CAR_STEP_METRES);
        this._sceneryLayers = new VrDecalLayers(VrModelEncoder.SCENERY_UNITS_PER_METRE, VrModelEncoder.SCENERY_STEP_METRES);
    }

    /**
     * @param {object}     model
     * @param {number[]|null} lifts - a car model's own coplanar order when null
     */
    encode(model, lifts = null) {
        lifts = (lifts ?? this._carLayers.compute(model));
        return {
            v: model.vertices.flat(),
            f: model.faces.map((face, index) => {
                const encoded = {c: face.colorIndex, i: face.indices};
                if (lifts[index] > 0) {
                    encoded.l = (Math.round(lifts[index] * VrModelEncoder.LIFT_PRECISION) / VrModelEncoder.LIFT_PRECISION);
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
        const lifts   = this._sceneryLayers.computeScene(list);
        const encoded = {};
        [...models.keys()].forEach((id, i) => {
            encoded[id] = this.encode(list[i], lifts[i]);
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
// The SH2 shifts the car vertices by 6 bits and the scenery ones by 11 into its 16.16 space: 1 m = 1024 / 32 units.
VrModelEncoder.CAR_UNITS_PER_METRE     = 1024;
VrModelEncoder.SCENERY_UNITS_PER_METRE = 32;
VrModelEncoder.LIFT_PRECISION          = 100;
// Distance a covering face stands in front of the covered one: the car seen close up, the scenery far away (above
// the depth precision there).
VrModelEncoder.CAR_STEP_METRES     = 0.02;
VrModelEncoder.SCENERY_STEP_METRES = 0.03;

module.exports = {VrModelEncoder};

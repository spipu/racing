/**
 * Reads a model from glTF 2.0 (a .gltf and its single .bin), in one of two
 * subsets; anything outside them is refused with an error that names it.
 *   - animated (parse): nodes, one skinned mesh in triangles, its skin,
 *     animations, materials, and in extras the sockets of a joint node
 *     ({sockets: [{name, translation, rotation}]}), the events of an animation
 *     ({events: [{time, name, data}]}) and anything else of a material
 *     (paletteIndex…);
 *   - static (parseStatic): one mesh in triangles, no skin, its materials.
 *
 * glTF is right-handed, the engine left-handed: x is negated on reading
 * (vertices, translations, inverse bind matrices, and the translation and
 * rotation an event's data may carry; quaternions get -y and -z; the
 * triangles turn the other way).
 */
class GltfParser {
    /**
     * @param {object}      gltf   - the .gltf JSON
     * @param {ArrayBuffer} binary - the content of buffers[0]
     * @returns {{skeleton: Skeleton, mesh: SkinnedMesh, materials: object[], clips: AnimationClip[],
     *            sockets: SkeletonSocket[]}} - the data of AnimatedModel.populate
     */
    static parse(gltf, binary) {
        return new GltfParser(gltf, binary)._parse();
    }

    /**
     * @param {object}      gltf   - the .gltf JSON
     * @param {ArrayBuffer} binary - the content of buffers[0]
     * @returns {{mesh: ModelMesh, materials: object[]}} - the data of StaticModel.populate
     */
    static parseStatic(gltf, binary) {
        return new GltfParser(gltf, binary)._parseStatic();
    }

    constructor(gltf, binary) {
        this._gltf     = gltf;
        this._binary   = binary;
        this._nodes    = (gltf.nodes ?? []);
        this._parentOf = GltfParser._parents(this._nodes);
    }

    _parse() {
        this._checkSubset();
        GltfParser._check(((this._gltf.skins ?? []).length === 1), 'exactly one skin expected');
        const skinned     = this._skinnedNode();
        const skin        = this._gltf.skins[skinned.skin];
        const order       = this._jointOrder(skin);
        const jointOfNode = new Map(order.map((node, joint) => [node, joint]));
        const skinToJoint = skin.joints.map((node) => jointOfNode.get(node));

        return {
            skeleton:  this._skeleton(skin, order, jointOfNode),
            mesh:      this._skinnedMesh(this._gltf.meshes[skinned.mesh], skinToJoint),
            materials: this._materials(),
            clips:     (this._gltf.animations ?? []).map((animation, i) => this._clip(animation, i, jointOfNode)),
            sockets:   order.flatMap((node, joint) => this._sockets(this._nodes[node], joint)),
        };
    }

    // The node carrying the mesh, and every node above it, must not move it: the mesh is read as it is.
    _parseStatic() {
        this._checkSubset();
        GltfParser._check(((this._gltf.skins ?? []).length === 0), 'a static model has no skin');
        const meshes = this._nodes.map((node, index) => [node, index]).filter(([node]) => (node.mesh !== undefined));
        GltfParser._check((meshes.length === 1), 'exactly one mesh expected');
        const [node, index] = meshes[0];
        for (let at = index; at !== undefined; at = this._parentOf.get(at)) {
            GltfParser._check(GltfParser._isIdentity(this._nodes[at]), 'node ' + at + ' must not move the mesh');
        }
        const {positions, faces} = this._primitives(this._gltf.meshes[node.mesh], null);

        return {mesh: new ModelMesh({positions: new Float32Array(positions), faces: faces}), materials: this._materials()};
    }

    _checkSubset() {
        const gltf = this._gltf;
        GltfParser._check(String(gltf.asset?.version ?? '').startsWith(GltfParser.VERSION), 'glTF ' + GltfParser.VERSION + ' expected');
        for (const key of GltfParser.REFUSED) {
            GltfParser._check(((gltf[key] ?? []).length === 0), '"' + key + '" is not supported');
        }
        GltfParser._check(((gltf.buffers ?? []).length === 1), 'exactly one buffer expected');
    }

    // The one node that carries the mesh and its skin.
    _skinnedNode() {
        const meshes = this._nodes.filter((node) => (node.mesh !== undefined));
        GltfParser._check(((meshes.length === 1) && (meshes[0].skin === 0)), 'exactly one mesh, skinned, expected');

        return meshes[0];
    }

    /**
     * The skin's joint nodes, every parent before its children.
     *
     * @returns {int[]} node indices
     */
    _jointOrder(skin) {
        const parentOf = this._parentOf;
        const joints   = new Set(skin.joints);
        const depth    = (node) => {
            let count = 0;
            for (let parent = parentOf.get(node); parent !== undefined; parent = parentOf.get(parent)) {
                if (joints.has(parent)) {
                    count++;
                } else {
                    GltfParser._check(GltfParser._isIdentity(this._nodes[parent]), 'node ' + parent + ' above a joint must not move it');
                }
            }

            return count;
        };
        const depths = new Map(skin.joints.map((node) => [node, depth(node)]));

        return [...skin.joints].sort((a, b) => (depths.get(a) - depths.get(b)));
    }

    _skeleton(skin, order, jointOfNode) {
        const parentOf        = this._parentOf;
        const count           = order.length;
        const restTranslation = new Float32Array(count * Skeleton.TRANSLATION_SIZE);
        const restRotation    = new Float32Array(count * Skeleton.ROTATION_SIZE);
        const restScale       = new Float32Array(count * Skeleton.SCALE_SIZE);
        const inverseBind     = new Float32Array(count * Mat4.SIZE);
        const names           = [];
        const parents         = [];
        order.forEach((nodeIndex, joint) => {
            const node = this._nodes[nodeIndex];
            GltfParser._check((node.matrix === undefined), 'joint node ' + nodeIndex + ': a matrix instead of translation, rotation, scale');
            names.push(node.name ?? (GltfParser.JOINT_NAME + joint));
            parents.push(this._jointParent(nodeIndex, parentOf, jointOfNode));
            restTranslation.set(GltfParser._translation(node.translation ?? [0, 0, 0]), (joint * Skeleton.TRANSLATION_SIZE));
            restRotation.set(GltfParser._rotation(node.rotation ?? [0, 0, 0, 1]), (joint * Skeleton.ROTATION_SIZE));
            restScale.set((node.scale ?? [1, 1, 1]), (joint * Skeleton.SCALE_SIZE));
        });
        const matrices = ((skin.inverseBindMatrices === undefined) ? null : this._floats(skin.inverseBindMatrices, GltfParser.MAT4));
        skin.joints.forEach((node, k) => {
            const target = inverseBind.subarray((jointOfNode.get(node) * Mat4.SIZE), ((jointOfNode.get(node) + 1) * Mat4.SIZE));
            if (matrices === null) {
                Mat4.identity(target);
            } else {
                Mat4.mirrorX(target, matrices.subarray((k * Mat4.SIZE), ((k + 1) * Mat4.SIZE)));
            }
        });

        return new Skeleton({names, parents, restTranslation, restRotation, restScale, inverseBind});
    }

    // The nearest joint above a node, -1 for none.
    _jointParent(node, parentOf, jointOfNode) {
        for (let parent = parentOf.get(node); parent !== undefined; parent = parentOf.get(parent)) {
            if (jointOfNode.has(parent)) {
                return jointOfNode.get(parent);
            }
        }

        return -1;
    }

    _skinnedMesh(mesh, skinToJoint) {
        const {positions, joints, weights, faces} = this._primitives(mesh, skinToJoint);

        return new SkinnedMesh({positions: new Float32Array(positions), joints: new Uint16Array(joints), weights: new Float32Array(weights), faces: faces});
    }

    /**
     * Every primitive in one mesh, triangle indices turned the other way; joints and weights only when skinned.
     *
     * @param {object}     mesh
     * @param {int[]|null} skinToJoint - null: a static mesh
     */
    _primitives(mesh, skinToJoint) {
        const positions = [];
        const joints    = [];
        const weights   = [];
        const faces     = [];
        mesh.primitives.forEach((primitive, p) => {
            GltfParser._check(((primitive.mode ?? GltfParser.TRIANGLES) === GltfParser.TRIANGLES), 'primitive ' + p + ': triangles only');
            GltfParser._check((primitive.targets === undefined), 'primitive ' + p + ': morph targets are not supported');
            GltfParser._check((primitive.material !== undefined), 'primitive ' + p + ': no material');
            for (const name of Object.keys(primitive.attributes)) {
                GltfParser._check(GltfParser.ATTRIBUTES.includes(name), 'primitive ' + p + ': attribute ' + name + ' is not supported');
            }
            const first  = (positions.length / ModelMesh.POSITION_SIZE);
            const points = this._floats(primitive.attributes.POSITION, GltfParser.VEC3);
            for (let i = 0; i < points.length; i += ModelMesh.POSITION_SIZE) {
                positions.push(-points[i], points[i + 1], points[i + 2]);
            }
            if (skinToJoint !== null) {
                this._accessor(primitive.attributes.JOINTS_0, GltfParser.VEC4).forEach((k) => joints.push(skinToJoint[k]));
                this._floats(primitive.attributes.WEIGHTS_0, GltfParser.VEC4).forEach((weight) => weights.push(weight));
            } else {
                GltfParser._check(((primitive.attributes.JOINTS_0 === undefined) && (primitive.attributes.WEIGHTS_0 === undefined)), 'primitive ' + p + ': joints and weights without a skin');
            }
            const indices = ((primitive.indices === undefined) ? [...Array(points.length / ModelMesh.POSITION_SIZE).keys()] : [...this._accessor(primitive.indices, GltfParser.SCALAR)]);
            for (let i = 0; i < indices.length; i += GltfParser.TRIANGLE) {
                faces.push({indices: [(first + indices[i]), (first + indices[i + 2]), (first + indices[i + 1])], material: primitive.material});
            }
        });

        return {positions, joints, weights, faces};
    }

    _materials() {
        return (this._gltf.materials ?? []).map((material, i) => this._material(material, i));
    }

    _material(material, i) {
        const pbr = (material.pbrMetallicRoughness ?? {});
        for (const key of GltfParser.TEXTURES) {
            GltfParser._check(((material[key] ?? pbr[key]) === undefined), 'material ' + i + ': ' + key + ' is not supported');
        }

        return {color: [...(pbr.baseColorFactor ?? [1, 1, 1, 1])], doubleSided: (material.doubleSided === true), extras: {...(material.extras ?? {})}};
    }

    _clip(animation, i, jointOfNode) {
        const channels = animation.channels.map((channel, c) => {
            const node = channel.target.node;
            const path = channel.target.path;
            GltfParser._check(jointOfNode.has(node), 'animation ' + i + ', channel ' + c + ': node ' + node + ' is not a joint');
            GltfParser._check((AnimationChannel.SIZES[path] !== undefined), 'animation ' + i + ', channel ' + c + ': path ' + path + ' is not supported');
            const sampler = animation.samplers[channel.sampler];
            const values  = Float32Array.from(this._floats(sampler.output, ((path === AnimationChannel.ROTATION) ? GltfParser.VEC4 : GltfParser.VEC3)));
            GltfParser._handedness(values, path);

            return new AnimationChannel(new AnimationSampler(this._floats(sampler.input, GltfParser.SCALAR), values, (sampler.interpolation ?? AnimationSampler.LINEAR), AnimationChannel.SIZES[path], (path === AnimationChannel.ROTATION)), jointOfNode.get(node), path);
        });
        const events = (animation.extras?.events ?? []).map((event) => new AnimationEvent(event.time, event.name, GltfParser._eventData(event.data ?? {})));

        return new AnimationClip((animation.name ?? (GltfParser.ANIMATION_NAME + i)), channels, events);
    }

    _sockets(node, joint) {
        return (node.extras?.sockets ?? []).map((socket) => {
            const offset = Mat4.fromTranslationRotationScale(Mat4.create(), GltfParser._translation(socket.translation ?? [0, 0, 0]), 0, GltfParser._rotation(socket.rotation ?? [0, 0, 0, 1]), 0, GltfParser.UNIT_SCALE, 0);

            return new SkeletonSocket(socket.name, joint, offset);
        });
    }

    /**
     * @returns {Map<int, int>} node → its parent node
     */
    static _parents(nodes) {
        const parentOf = new Map();
        nodes.forEach((node, index) => (node.children ?? []).forEach((child) => parentOf.set(child, index)));

        return parentOf;
    }

    /**
     * The values of an accessor as floats (normalized integers scaled to 0-1).
     *
     * @returns {Float32Array}
     */
    _floats(index, type) {
        const values     = this._accessor(index, type);
        const normalized = (this._gltf.accessors[index].normalized === true);
        if (values instanceof Float32Array) {
            return values;
        }
        GltfParser._check(normalized, 'accessor ' + index + ': floats or normalized integers expected');
        const max = GltfParser.NORMALIZED_MAX.get(values.constructor);

        return Float32Array.from(values, (value) => (value / max));
    }

    /**
     * A typed view on the binary, copied only when the buffer view interleaves (byteStride).
     *
     * @param {int}    index
     * @param {string} type  - the accessor type expected (SCALAR, VEC3, VEC4, MAT4)
     */
    _accessor(index, type) {
        const accessor = this._gltf.accessors[index];
        GltfParser._check((accessor.type === type), 'accessor ' + index + ': ' + type + ' expected, not ' + accessor.type);
        GltfParser._check((accessor.sparse === undefined), 'accessor ' + index + ': sparse accessors are not supported');
        const Type   = GltfParser.COMPONENT_TYPES.get(accessor.componentType);
        const size   = GltfParser.COMPONENTS[type];
        const view   = this._gltf.bufferViews[accessor.bufferView];
        const offset = ((view.byteOffset ?? 0) + (accessor.byteOffset ?? 0));
        GltfParser._check((Type !== undefined), 'accessor ' + index + ': component type ' + accessor.componentType + ' is not supported');
        const element = (size * Type.BYTES_PER_ELEMENT);
        if ((view.byteStride === undefined) || (view.byteStride === element)) {
            return new Type(this._binary, offset, (accessor.count * size));
        }
        const values = new Type(accessor.count * size);
        for (let i = 0; i < accessor.count; i++) {
            values.set(new Type(this._binary, (offset + (i * view.byteStride)), size), (i * size));
        }

        return values;
    }

    // An event's data, its translation and rotation (glTF conventions) turned to the engine's handedness.
    static _eventData(data) {
        const out = {...data};
        if (data.translation !== undefined) {
            out.translation = [...GltfParser._translation(data.translation)];
        }
        if (data.rotation !== undefined) {
            out.rotation = [...GltfParser._rotation(data.rotation)];
        }

        return out;
    }

    static _translation(t) {
        return Float32Array.of(-t[0], t[1], t[2]);
    }

    static _rotation(q) {
        return Float32Array.of(q[0], -q[1], -q[2], q[3]);
    }

    // In place, keys and CUBICSPLINE tangents alike (the change of handedness is linear).
    static _handedness(values, path) {
        if (path === AnimationChannel.TRANSLATION) {
            for (let i = 0; i < values.length; i += Skeleton.TRANSLATION_SIZE) {
                values[i] = -values[i];
            }
        }
        if (path === AnimationChannel.ROTATION) {
            for (let i = 0; i < values.length; i += Skeleton.ROTATION_SIZE) {
                values[i + 1] = -values[i + 1];
                values[i + 2] = -values[i + 2];
            }
        }
    }

    static _isIdentity(node) {
        const t = (node.translation ?? [0, 0, 0]);
        const r = (node.rotation ?? [0, 0, 0, 1]);
        const s = (node.scale ?? [1, 1, 1]);

        return ((node.matrix === undefined) && t.every((v) => (v === 0)) && (r[0] === 0) && (r[1] === 0) && (r[2] === 0) && s.every((v) => (v === 1)));
    }

    static _check(condition, message) {
        if (!condition) {
            throw new Error('GltfParser - ' + message);
        }
    }
}

GltfParser.VERSION         = '2.';
// Refused when present and not empty.
GltfParser.REFUSED         = Object.freeze(['extensionsUsed', 'extensionsRequired', 'cameras', 'textures', 'images']);
GltfParser.TEXTURES        = Object.freeze(['baseColorTexture', 'metallicRoughnessTexture', 'normalTexture', 'occlusionTexture', 'emissiveTexture']);
// NORMAL and TEXCOORD_0 are read by none: the engine draws flat faces of a plain colour.
GltfParser.ATTRIBUTES      = Object.freeze(['POSITION', 'JOINTS_0', 'WEIGHTS_0', 'NORMAL', 'TEXCOORD_0']);
GltfParser.TRIANGLES       = 4;
GltfParser.TRIANGLE        = 3;
GltfParser.SCALAR          = 'SCALAR';
GltfParser.VEC3            = 'VEC3';
GltfParser.VEC4            = 'VEC4';
GltfParser.MAT4            = 'MAT4';
GltfParser.COMPONENTS      = Object.freeze({SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16});
GltfParser.COMPONENT_TYPES = new Map([[5121, Uint8Array], [5123, Uint16Array], [5125, Uint32Array], [5126, Float32Array]]);
GltfParser.NORMALIZED_MAX  = new Map([[Uint8Array, 255], [Uint16Array, 65535]]);
GltfParser.UNIT_SCALE      = Float32Array.of(1, 1, 1);
GltfParser.JOINT_NAME      = 'joint';
GltfParser.ANIMATION_NAME  = 'animation';

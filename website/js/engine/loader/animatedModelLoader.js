class AnimatedModelLoader extends AbstractGltfLoader {
    constructor(loadedCallback) {
        super('animatedModel', loadedCallback);
    }

    _create(id, url, callback) {
        return new AnimatedModel(id, url, callback);
    }

    /**
     * @param {AnimatedModel}                       entity
     * @param {{gltf: object, binary: ArrayBuffer}} data
     */
    _populateFromData(entity, data) {
        entity.populate(GltfParser.parse(data.gltf, data.binary));
    }
}

class StaticModelLoader extends AbstractGltfLoader {
    constructor(loadedCallback) {
        super('staticModel', loadedCallback);
    }

    _create(id, url, callback) {
        return new StaticModel(id, url, callback);
    }

    /**
     * @param {StaticModel}                         entity
     * @param {{gltf: object, binary: ArrayBuffer}} data
     */
    _populateFromData(entity, data) {
        entity.populate(GltfParser.parseStatic(data.gltf, data.binary));
    }
}

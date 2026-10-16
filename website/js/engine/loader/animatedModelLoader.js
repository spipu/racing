class AnimatedModelLoader extends AbstractLoader {
    constructor(loadedCallback) {
        super('animatedModel', loadedCallback);
    }

    _create(id, url, callback) {
        return new AnimatedModel(id, url, callback);
    }

    // A .gltf, then its single .bin, found next to it.
    _initialiseEntityFromUrl(entity) {
        const url = entity.getUrl();
        appBootstrap.fetchJson(url, (gltf) => {
            const binaryUrl = (url.slice(0, (url.lastIndexOf('/') + 1)) + gltf.buffers[0].uri);
            appBootstrap.fetchAsync(binaryUrl)
                .then((response) => response.arrayBuffer())
                .then((binary) => {
                    this._populateFromData(entity, {gltf: gltf, binary: binary});
                    entity.setLoaded();
                })
                .catch((error) => appBootstrap.logError('Failed to load "' + binaryUrl + '"', error));
        });
    }

    /**
     * @param {AnimatedModel}                       entity
     * @param {{gltf: object, binary: ArrayBuffer}} data
     */
    _populateFromData(entity, data) {
        entity.populate(GltfParser.parse(data.gltf, data.binary));
    }
}

/**
 * Base of the loaders of glTF models: a .gltf, then its single .bin found
 * next to it, handed to _populateFromData as {gltf, binary}.
 */
class AbstractGltfLoader extends AbstractLoader {
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
}

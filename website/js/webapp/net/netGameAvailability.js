/**
 * Whether this device can take part in a game session: the game says whether
 * it can render as every session requires, and pairing reads the other side's
 * code with the camera. The camera probe only settles once the page is
 * visible: the menus never wait on it, they grey their entries when it
 * answers, and a probe still silent after PROBE_WAIT_MS lets the flow go on —
 * the pairing then reports a missing camera itself.
 */
class NetGameAvailability {
    /**
     * @param {NetGameLinks}    links
     * @param {function(): boolean} canRender - whether the renderer of a session works here (WebGL)
     */
    constructor(links, canRender) {
        this._links     = links;
        this._canRender = canRender;
        this._reason    = null;
    }

    /**
     * @returns {Promise<string|null>} why the device cannot play (NO_WEBGL, NO_CAMERA), null when it can
     */
    unavailableReason() {
        if (this._reason === null) {
            this._reason = this._probe();
        }

        return this._reason;
    }

    async _probe() {
        if (!this._canRender()) {
            return NetGameAvailability.NO_WEBGL;
        }
        if (this._links.needsCamera() && !(await NetGameAvailability._cameraWithin(NetGameAvailability.PROBE_WAIT_MS))) {
            return NetGameAvailability.NO_CAMERA;
        }

        return null;
    }

    // An unanswered probe counts as a camera: the pairing opens it and says so if it fails.
    static _cameraWithin(ms) {
        return Promise.race([CameraProbe.isAvailable(), new Promise((resolve) => setTimeout(() => resolve(true), ms))]);
    }
}

NetGameAvailability.NO_WEBGL      = 'webgl';
NetGameAvailability.NO_CAMERA     = 'camera';
NetGameAvailability.PROBE_WAIT_MS = 2000;

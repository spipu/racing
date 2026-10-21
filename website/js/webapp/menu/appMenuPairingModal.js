/**
 * The pairing of one sub, over the menus: the code this device shows as a QR
 * code, the camera reading the other side's code, each with its caption, then
 * the player being connected to, and a cancel button. The session runs the
 * flow; this modal is its view, and turns every failure into an explicit
 * message — a link that cannot open says which network to put both devices on.
 * A game adds the texts of its own refusals of an invite (registerError).
 */
class AppMenuPairingModal extends AppMenuModal {
    /**
     * @param {AppMenuDisplay} display
     */
    constructor(display) {
        super(display);

        this._view = null;
    }

    // The main invites one more sub: its code shown, the sub's answer read.
    openForMain(session) {
        return this._open(appTranslator.get('multiplayer.lobby.add'), {
            show:       appTranslator.get('multiplayer.pairing.showToSub'),
            read:       appTranslator.get('multiplayer.pairing.readSub'),
            connecting: (payload) => AppMenuPairingModal._connectingTo(payload)
        }, false, session, (view) => session.addPlayer(view), () => {});
    }

    /**
     * A sub answers the main: its code read, then the answer shown, one at a time.
     *
     * @param {NetGameSubSession} session
     * @param {function}          onPaired - once the link to the main is open
     * @param {function}          onFailed - the pairing was cancelled or failed: the session is over
     */
    openForSub(session, onPaired, onFailed) {
        return this._open(appTranslator.get('multiplayer.join'), {
            show:       appTranslator.get('multiplayer.pairing.showToMain'),
            read:       appTranslator.get('multiplayer.pairing.readMain'),
            connecting: () => appTranslator.get('multiplayer.pairing.connecting')
        }, true, session, (view) => session.join(view), onPaired, onFailed);
    }

    /**
     * @param {string}                       title
     * @param {{show: string, read: string, connecting: function}} captions - see QrPairingView
     * @param {boolean}                      sequential - reads first, then shows: one frame at a time
     * @param {object}                       session    - its cancelPairing() and getCodeChannel()
     * @param {function(object): Promise}    pair       - runs the session's flow through the view
     * @param {function}                     onPaired
     * @param {function}                     onFailed
     */
    _open(title, captions, sequential, session, pair, onPaired, onFailed = () => {}) {
        const {modal}  = this._createShell(title, 'app-menu-modal app-menu-modal-wide app-menu-modal-pairing', 'app-menu-subtitle');
        const stage    = AppMenuDom.addElement(modal, 'div', 'app-menu-pairing-stage'
            + ((sequential) ? ' app-menu-pairing-stage-sequential' : ''));
        const elements = {
            qr:            AppMenuPairingModal._tile(stage, 'div', 'app-menu-pairing-qr'),
            camera:        AppMenuPairingModal._tile(stage, 'video', 'app-menu-pairing-camera'),
            qrCaption:     null,
            cameraCaption: null,
            status:        AppMenuDom.addElement(stage, 'div', 'app-menu-pairing-status')
        };
        elements.qrCaption     = AppMenuDom.addElement(elements.qr.parentElement, 'div', 'app-menu-pairing-caption');
        elements.cameraCaption = AppMenuDom.addElement(elements.camera.parentElement, 'div', 'app-menu-pairing-caption');
        elements.camera.muted       = true;
        elements.camera.playsInline = true;

        const actions = AppMenuDom.addElement(modal, 'div', 'app-menu-modal-actions');
        const button  = AppMenuDom.addButton(actions, 'app-menu-button', appTranslator.get('menu.cancel'), () => session.cancelPairing());
        this._attachButtonsNav([button], button, 0);

        this._view = new QrPairingView(new QrScanner(), elements, captions, session.getCodeChannel())
            .setSequential(sequential)
            .enableZoom();
        this._run(pair, onPaired, onFailed);

        return this;
    }

    // A cancel simply closes the modal; any other failure explains itself.
    async _run(pair, onPaired, onFailed) {
        try {
            await QrModule.prepare(appBootstrap.buildUrl(AppMenuPairingModal.WASM_URL));
            await pair(this._view);
        } catch (error) {
            this.close();
            onFailed();
            this._fail(error);
            return;
        }
        this.close();
        onPaired();
    }

    _fail(error) {
        if ((error instanceof NetError) && (error.getCode() === NetError.CANCELLED)) {
            return;
        }
        const code = AppMenuPairingModal._errorCode(error);
        // A refusal the player can act on (another version, the game's own) is no bug.
        if (code === AppMenuPairingModal.ERROR_DEFAULT) {
            console.error(error);
        }
        AppMenuSound.play(AppMenuSound.INVALID);
        new AppMenuModal(this._display).info(AppMenuPairingModal._message(code, error));
    }

    /**
     * @param {string}      errorCode - a NetError code the game raises to refuse an invite
     * @param {string}      textCode  - the text that explains it
     * @param {string|null} parameter - the text's parameter that receives the error's detail, null for none
     */
    static registerError(errorCode, textCode, parameter = null) {
        AppMenuPairingModal.ERROR_CODES[errorCode] = textCode;
        if (parameter !== null) {
            AppMenuPairingModal.DETAIL_PARAMETERS[errorCode] = parameter;
        }
    }

    // A refusal that names something (the game's own) names it on one line.
    static _message(code, error) {
        const parameter = ((error instanceof NetError) ? (AppMenuPairingModal.DETAIL_PARAMETERS[error.getCode()] ?? null) : null);
        if (parameter === null) {
            return appTranslator.get(code);
        }

        return appTranslator.get(code, {[parameter]: (error.getDetail() ?? '').replace(/ /g, AppMenuPairingModal.NO_BREAK_SPACE)});
    }

    // The sub's answer names it; a payload that does not decode leaves the line nameless.
    static _connectingTo(payload) {
        try {
            return appTranslator.get('multiplayer.pairing.connectingTo', {nickname: NetGameAnswer.decode(payload)});
        } catch (error) {
            return appTranslator.get('multiplayer.pairing.connecting');
        }
    }

    static _errorCode(error) {
        if ((error instanceof NetError) && AppMenuPairingModal.NETWORK_CODES.includes(error.getCode())) {
            return (AppMenuPairingModal.NETWORK_MESSAGES[error.getDetail()] ?? AppMenuPairingModal.NETWORK_DEFAULT);
        }
        if (error instanceof NetError) {
            return (AppMenuPairingModal.ERROR_CODES[error.getCode()] ?? AppMenuPairingModal.ERROR_DEFAULT);
        }
        if ((error instanceof DOMException) && AppMenuPairingModal.CAMERA_ERRORS.includes(error.name)) {
            return 'multiplayer.error.camera';
        }

        return AppMenuPairingModal.ERROR_DEFAULT;
    }

    // The element of a tile of the stage, its caption added under it by the caller.
    static _tile(stage, tagName, className) {
        const tile = AppMenuDom.addElement(stage, 'div', 'app-menu-pairing-tile');

        return AppMenuDom.addElement(tile, tagName, 'app-menu-pairing-frame ' + className);
    }
}

AppMenuPairingModal.WASM_URL       = '/lib/zxing-wasm/zxing_full.wasm';
AppMenuPairingModal.NO_BREAK_SPACE = '\u00A0';
AppMenuPairingModal.ERROR_DEFAULT  = 'multiplayer.error.pairing';
AppMenuPairingModal.ERROR_CODES    = {
    [NetError.VERSION_MISMATCH]: 'multiplayer.error.version',
    [NetError.INVITE_USED]:      'multiplayer.error.invite',
    [NetError.UNKNOWN_INVITE]:   'multiplayer.error.invite'
};
// The error codes whose detail the text names, by the text's parameter.
AppMenuPairingModal.DETAIL_PARAMETERS = {};
// A link that could not open: the message follows the network verdict carried by the error.
AppMenuPairingModal.NETWORK_CODES    = [NetError.LINK_LOST, NetError.CONNECT_TIMEOUT, NetError.UNREACHABLE];
AppMenuPairingModal.NETWORK_DEFAULT  = 'multiplayer.error.connect';
AppMenuPairingModal.NETWORK_MESSAGES = {
    [NetReachability.SAME_NETWORK]: 'multiplayer.error.sameNetwork',
    [NetReachability.INTERNET]:     'multiplayer.error.otherNetwork',
    [NetReachability.UNREACHABLE]:  'multiplayer.error.otherNetwork'
};
// The camera refused, missing or busy (getUserMedia).
AppMenuPairingModal.CAMERA_ERRORS = ['NotAllowedError', 'NotFoundError', 'NotReadableError', 'OverconstrainedError'];

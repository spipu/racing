/**
 * Multiplayer sub-menu of the main's pause, as doom_js's MenuMultiplayerModal in a session: the lobby, without adding a
 * player during a race (user decision: one joins before a race only), the stop of the session and the multiplayer
 * options. Its back entry, Backspace, Escape and the gamepad back button return to the pause.
 */
class RacingMultiplayerModal extends AppMenuAbstractListModal {
    /**
     * @param {AppMenuDisplay} display
     * @param {{getSession: function, stop: function}} sessionContext - see RacingHostedSession.pauseContext
     */
    constructor(display, sessionContext) {
        super(display);

        this._nav.setEscapeAsBack(true);
        this._sessionContext = sessionContext;
        this._onResume       = null;
        this._stacked        = null;
    }

    // The lobby's start resumes the race.
    setOnResume(callback) {
        this._onResume = callback;

        return this;
    }

    show() {
        const {listEl} = this._openSimpleShell(appTranslator.get('multiplayer.pause.menu'));
        this._nav.addItemIn(listEl, appTranslator.get('multiplayer.pause.lobby'), () => this._openLobby());
        this._nav.addItemIn(listEl, appTranslator.get('multiplayer.pause.stop'), () => this._confirmStop());
        this._nav.addItemIn(listEl, appTranslator.get('multiplayer.options'), () => this._openOptions());
        this._nav.setBackTarget(this._nav.addItemIn(listEl, appTranslator.get('menu.back'), () => this.close()));
        this._nav.selectFirst();

        return this;
    }

    _teardown() {
        if (this._stacked !== null) {
            this._stacked.setOnClose(null).close();
            this._stacked = null;
        }
    }

    _openLobby() {
        this._openStacked(new AppMenuLobbyModal(this._display)).openMain(this._sessionContext.getSession(), {
            start:      () => this._resume(),
            back:       null,
            addPlayers: false
        });
    }

    // What is changed here presets the next race: the running one keeps its settings.
    _openOptions() {
        this._openStacked(new RacingOptionsModal(this._display)).showMultiplayer();
    }

    _confirmStop() {
        RacingHostedSession.confirmStop(this._display, () => {
            this._sessionContext.stop();
            this._resume();
        });
    }

    _openStacked(modal) {
        this._stacked = modal.setOnClose(() => {
            this._stacked = null;
        });

        return modal;
    }

    _resume() {
        if (this._onResume !== null) {
            this._onResume();
        }
    }
}

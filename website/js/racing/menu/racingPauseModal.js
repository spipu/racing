/**
 * Pause modal, shown by the race over its own frozen frame (modelled on
 * doom_js's MenuPauseModal). Title "{course} — {car}", navigable entries:
 * back to the race, restart the race (not on a device that follows the main's
 * race), multiplayer (in a session the device hosts), options, leave the race
 * (stopping the session the device hosts, leaving the one it follows); no
 * bottom button: Backspace and the gamepad back button resume, the Escape and
 * pause toggle stays with the race, which only leaves the pause from its root:
 * the stacked options modal handles Escape itself as one step back.
 */
class RacingPauseModal extends AppMenuAbstractListModal {
    /**
     * @param {AppMenuDisplay} display
     */
    constructor(display) {
        super(display);

        this._nav.setEscapeAsBack(false);
        this._onResume       = null;
        this._onRestart      = null;
        this._onQuit         = null;
        this._titleProvider  = null;
        this._options        = null;
        this._sessionContext = null;    // see RacingHostedSession.pauseContext, null outside a session
        this._multiplayer    = null;
    }

    /**
     * @param {object|null} context - RacingHostedSession.pauseContext, null outside a session
     */
    setSessionContext(context) {
        this._sessionContext = context;

        return this;
    }

    setOnResume(callback) {
        this._onResume = callback;

        return this;
    }

    setOnRestart(callback) {
        this._onRestart = callback;

        return this;
    }

    setOnQuit(callback) {
        this._onQuit = callback;

        return this;
    }

    /**
     * @param {function} titleProvider returns the (translated) modal title, read again when the options close
     */
    show(titleProvider) {
        this._titleProvider = titleProvider ?? this._titleProvider;

        const {modal} = this._createShell(this._titleProvider(), 'app-menu-modal app-menu-modal-wide', 'app-menu-subtitle');
        const listEl  = AppMenuDom.addElement(modal, 'div', 'app-menu-list');
        this._nav.addItemIn(listEl, appTranslator.get('race.pause.resume'), () => this._onResume());
        if (this._onRestart !== null) {
            this._nav.addItemIn(listEl, appTranslator.get('race.pause.restart'), () => this._confirmRestart());
        }
        if (this._inSession()) {
            this._nav.addItemIn(listEl, appTranslator.get('multiplayer.pause.menu'), () => this._openMultiplayer());
        }
        this._nav.addItemIn(listEl, appTranslator.get('menu.options'), () => this._openOptions());
        this._nav.addItemIn(listEl, appTranslator.get('race.pause.quit'), () => this._onQuit());

        this._nav.attach();
        this._nav.selectFirst();

        return this;
    }

    // The race's Escape toggle only leaves the pause from its root.
    isAtRoot() {
        return this._isTopOverlay();
    }

    _onBack() {
        this._onResume();
    }

    _teardown() {
        if (this._options !== null) {
            this._options.setOnClose(null).close();
            this._options = null;
        }
        if (this._multiplayer !== null) {
            this._multiplayer.setOnClose(null).close();
            this._multiplayer = null;
        }
    }

    _inSession() {
        return ((this._sessionContext !== null) && (this._sessionContext.getSession() !== null));
    }

    // Rebuilt when it closes: the session may have stopped.
    _openMultiplayer() {
        this._multiplayer = new RacingMultiplayerModal(this._display, this._sessionContext).setOnResume(() => this._onResume()).setOnClose(() => {
            this._multiplayer = null;
            this.show();
        });
        this._multiplayer.show();
    }

    _confirmRestart() {
        this._confirm(appTranslator.get('race.pause.restartConfirm'), this._onRestart, appTranslator.get('race.pause.restartButton'));
    }

    // Rebuilt when the options close: a language change must reach the title and the entries.
    _openOptions() {
        this._options = new RacingOptionsModal(this._display).setInGame(true).setRendererLocked(this._inSession()).setOnClose(() => {
            this._options = null;
            this.show();
        });
        this._options.show();
    }
}

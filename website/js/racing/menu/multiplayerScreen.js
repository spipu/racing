/**
 * Multiplayer screen, as doom_js's: create a race — the nickname asked for if there is none, then the course, the car
 * and the gearbox, the race built with the lobby over it —, join a race (RacingJoinFlow), and a shortcut to the
 * multiplayer options. Its entries grey out on a device that cannot play (no WebGL, no camera).
 */
class MultiplayerScreen extends AbstractRacingMenuScreen {
    /**
     * @param {RacingMenuNavigator} navigator
     * @param {AppMenuDisplay}      display
     */
    constructor(navigator, display) {
        super(navigator, display);

        this._links        = new NetGameLinks();
        this._availability = new NetGameAvailability(this._links, () => new Object3dRendererWebGL().isAvailable());
        this._join         = new RacingJoinFlow(navigator, display, this._links, this._availability);
    }

    _build() {
        const {panel, listEl} = this._buildPanel(appTranslator.get('menu.multiplayer'));

        const create = this._addListItem(listEl, appTranslator.get('multiplayer.create'), () => {
            AppMenuNetGate.enter(this._display, () => this._availability.unavailableReason(), racingSettings,
                (nickname) => this._navigator.openSessionCourses(nickname));
        });
        const join = this._addListItem(listEl, appTranslator.get('multiplayer.join'), () => this._join.start());
        this._addListItem(listEl, appTranslator.get('multiplayer.options'), () => {
            this._openModal(new RacingOptionsModal(this._display)).showMultiplayer();
        });
        this._addBackButton(panel);
        this._nav.selectFirst();
        for (const item of [create, join]) {
            AppMenuNetGate.greyWhenUnavailable(item, () => this._availability.unavailableReason());
        }
    }

    /**
     * A followed session back in its lobby (the main picks the next course).
     *
     * @param {NetGameSubSession} session
     */
    showLobby(session) {
        this._join.showLobby(session);
    }

    _onBack() {
        this._navigator.showMainMenu();
    }
}

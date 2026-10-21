/**
 * Joining a main's race from the Multiplayer screen, as doom_js's MenuJoinFlow: pairs with the main — its code read,
 * the answer shown —, then shows the lobby, which says once the main's race runs. The lobby closes when the session
 * ends, with why.
 */
class RacingJoinFlow {
    /**
     * @param {AppMenuDisplay}      display
     * @param {NetGameLinks}        links
     * @param {NetGameAvailability} availability
     */
    constructor(display, links, availability) {
        this._display      = display;
        this._links        = links;
        this._availability = availability;
    }

    start() {
        AppMenuNetGate.enter(this._display, () => this._availability.unavailableReason(), racingSettings, (nickname) => {
            this._pair(new NetGameSubSession(this._links, nickname));
        });
    }

    _pair(session) {
        new AppMenuPairingModal(this._display).openForSub(session, () => this._showLobby(session), () => session.dispose());
    }

    _showLobby(session) {
        const lobby = new AppMenuLobbyModal(this._display);
        session.setOnEnd((reason) => {
            lobby.close();
            AppMenuNetMessages.showEnd(this._display, reason);
        });
        lobby.openSub(session, {leave: () => session.leave()});
    }
}

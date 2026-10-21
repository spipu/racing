/**
 * The session a main hosts for other devices, as DoomHostedSession, but held by the menus (RacingMenuNavigator) rather
 * than by a race: it outlives the races (user decision), the subs waiting in its lobby while the main picks the next
 * course. Created by the Multiplayer screen's "Create a race" with the main's nickname; its session opens with the
 * lobby of the first race and stops on the main's word (the main menu, the pause, back out of the lobby or the course
 * choice).
 *
 * Each race it is attached to (attach): the subs of its lobby get their cars on the grid as they join and lose them as
 * they leave, the race shows frozen under the start lobby until Start, and its pause reaches the session — the
 * lobby read only, the stop. It reaches the race through its public surface alone.
 */
class RacingHostedSession {
    /**
     * @param {string} nickname - the main's
     */
    constructor(nickname) {
        this._nickname = nickname;
        this._links    = new NetGameLinks();
        this._session  = null;   // NetGameMainSession once open
        this._game     = null;   // the race it is attached to
        this._display  = null;   // the start lobby's, over the frozen race until Start
        this._lobby    = null;
    }

    /**
     * The session follows the race, built under its multiplayer rules: the subs' cars enter it as they are in the lobby.
     *
     * @param {RacingGame} game
     */
    attach(game) {
        const session = this.open();
        this._game    = game;
        session.setCycle({
            admitted: (peer) => game.getRole().addPlayer(session.playerIdOf(peer)),
            gone:     (peer) => game.getRole().removePlayer(session.playerIdOf(peer)),
        });

        return this;
    }

    // The race goes: the session waits for the next one.
    detach() {
        this._closeStartLobby();
        if (this._session !== null) {
            this._session.setCycle(null);
        }
        this._game = null;
    }

    /**
     * Once the race is shown: frozen under the lobby until Start, where players may still join. Back there stops the
     * session, asked first when players are in.
     *
     * @param {function} onCancel - the race is left for the menus
     */
    showStartLobby(onCancel) {
        this._game.freeze();
        this._display = new AppMenuDisplay('screen').init(true);
        this._lobby   = new AppMenuLobbyModal(this._display).openMain(this._session, {
            start: () => this._startFromLobby(),
            back:  () => this._backFromStartLobby(onCancel),
        });
    }

    // The start lobby covers the race like a pause menu.
    isStartLobbyOpen() {
        return (this._display !== null);
    }

    _startFromLobby() {
        this._closeStartLobby();
        if (!this._session.isStarted()) {
            this._session.start();
        }
        this._game.unfreeze();
    }

    _backFromStartLobby(onCancel) {
        const cancel = () => {
            this._closeStartLobby();
            this.stop();
            onCancel();
        };
        if (!this.hasPlayers()) {
            cancel();
            return;
        }
        new AppMenuModal(this._display).confirm(appTranslator.get('multiplayer.pause.stopConfirm'), cancel);
    }

    _closeStartLobby() {
        if (this._lobby !== null) {
            this._lobby.setOnClose(null).close();
            this._display.destroy();
        }
        this._lobby   = null;
        this._display = null;
    }

    /**
     * @returns {{getSession: function, stop: function}} what the pause's Multiplayer entry drives
     */
    pauseContext() {
        return {
            getSession: () => this._session,
            stop:       () => this._stopFromPause(),
        };
    }

    // The race goes on alone: the subs' cars leave the track.
    _stopFromPause() {
        const game = this._game;
        for (const player of game.getRoster().getAll()) {
            game.getRole().removePlayer(player.getId());
        }
        this.detach();
        this.stop();
        game.sessionStopped();
    }

    /**
     * @returns {NetGameMainSession} the session, opened on its first call
     */
    open() {
        if (this._session === null) {
            this._session = new NetGameMainSession({
                links:    this._links,
                nickname: this._nickname,
                capacity: RacingHostedSession.CAPACITY,
                mode:     RacingNetProtocol.MODE_RACE,
                options:  {},
                colors:   Array.from({length: RacingHostedSession.CAPACITY}, (unused, i) => RacingCarColors.cssOfSlot(i + NetLobby.MAIN_SLOT))
            });
        }

        return this._session;
    }

    /**
     * @returns {NetGameMainSession|null} null before the first lobby
     */
    getSession() {
        return this._session;
    }

    /**
     * @returns {boolean} other players are in the lobby: stopping the session disconnects them
     */
    hasPlayers() {
        return ((this._session !== null) && (this._session.getLobby().getPlayers().length > 1));
    }

    /**
     * Ends the session, the subs told why; nothing happens before it opened.
     *
     * @param {string} reason - NetGameProtocol.END_*
     */
    stop(reason = NetGameProtocol.END_STOPPED) {
        if (this._session === null) {
            return;
        }
        this._session.stop(reason);
        this._session = null;
    }
}

// Players of a race, main included.
RacingHostedSession.CAPACITY = 8;

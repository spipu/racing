/**
 * The session a sub follows, as DoomFollowedSession; a race being one RacingGame, it outlives them. It builds each race
 * the main sends — one build at a time, the last word of the main winning —, the race before it torn down, goes back
 * to the lobby when the main picks the next course, and takes the device back to the Multiplayer screen when the
 * session ends — once the build is over when the end comes during one, at once otherwise — or when a race could not
 * be built.
 */
class RacingFollowedSession {
    /**
     * @param {RacingMenuNavigator} navigator
     * @param {NetGameSubSession}   session
     */
    constructor(navigator, session) {
        this._navigator    = navigator;
        this._session      = session;
        this._game         = null;   // the race shown
        this._joining      = false;  // a race the main sent is being built
        this._pendingLevel = null;   // the race the main sent meanwhile, built next
        this._pendingLobby = false;  // the main went back to its lobby meanwhile
        this._endReason    = null;   // NetGameProtocol.END_* once the session ended
        this._left         = false;  // this device left the session itself
    }

    getSession() {
        return this._session;
    }

    /**
     * The device joins the main's race on the race the main sent.
     *
     * @param {object} level - the levelLoad message: {seq, course, mirror, car, gearbox, laps, players}
     */
    async join(level) {
        if (this._joining) {
            this._pendingLevel = level;
            this._pendingLobby = false;
            return;
        }
        this._joining = true;
        if (this._game !== null) {
            this._game.leaveRace();
            this._game = null;
        }
        const selection = {course: level.course, mirror: level.mirror, car: level.car, gearbox: level.gearbox};
        const game      = new RacingGame(this._navigator, selection, null, this);
        game.getRole().prepareLevel(level);
        game.getRole().follow((event) => game.getPresentation().playTurnEvent(event), (next) => this.join(next),
            (notice) => game.getPresentation().setNotice(notice), (reason) => this._onEnd(reason), () => this._toLobby());
        game.getPresentation().setPingSource(() => this._session.getHostPing());
        let failure = null;
        try {
            await game.start(level);
            this._game = game;
        } catch (error) {
            failure = error;
        } finally {
            this._joining = false;
        }
        // What the session told meanwhile, handled once the build is over.
        if (this._endReason !== null) {
            if (failure !== null) {
                game.leaveRace();
            }
            this._leaveEnded();
            return;
        }
        if (failure !== null) {
            this._leaveFailedBuild(game, failure);
            return;
        }
        if (this._pendingLevel !== null) {
            const pending = this._pendingLevel;
            this._pendingLevel = null;
            await this.join(pending);
        } else if (this._pendingLobby) {
            this._toLobby();
        }
    }

    // The player left the race from its pause, its role leaving the session: the Multiplayer screen.
    playerLeft() {
        this._left = true;
        this._game = null;
        this._navigator.leftFollowedSession(null);
    }

    /**
     * The race shown stopped on an error: the session is left, the menus say why.
     *
     * @param {Error} error
     */
    raceFailed(error) {
        this._game = null;
        this._session.setCycle(null).leave();
        this._navigator.leftFollowedSessionOnError(error);
    }

    // The race is over, the main picks the next course: the lobby again, until its next race.
    _toLobby() {
        if (this._joining) {
            this._pendingLevel = null;
            this._pendingLobby = true;
            return;
        }
        this._pendingLobby = false;
        if (this._game === null) {
            return;
        }
        this._game.leaveRace();
        this._game = null;
        this._navigator.followedSessionToLobby(this._session);
    }

    // The main stopped, removed this sub, or the link is lost. During a build, the build's end handles it.
    _onEnd(reason) {
        this._endReason = reason;
        if (!this._joining) {
            this._leaveEnded();
        }
    }

    _leaveEnded() {
        if (this._left) {
            return;
        }
        if (this._game !== null) {
            this._game.leaveRace();
            this._game = null;
        }
        this._navigator.leftFollowedSession(this._endReason);
    }

    // A race that could not be built leaves the session: the menus say why.
    _leaveFailedBuild(game, error) {
        console.error(error);
        this._pendingLevel = null;
        this._session.setCycle(null).leave();
        game.leaveRace();
        this._navigator.leftFollowedSessionOnError(error);
    }
}

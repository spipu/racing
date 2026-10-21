/**
 * The role of a device that follows another's race (a sub), as DoomSubRole. It simulates nothing: on each turn state
 * the main sends, it applies it at once (RacingReplicaApplier) and answers with its command for the next turn before
 * the next frame draws — sampled from what its controls collected since the previous one. Its frames present the
 * main's time: the ticks of the states that came since the previous frame, none while no state comes. Its pause stops
 * the race for everyone (user decision): the main is told, and its command is neutral meanwhile. It tells the game
 * when the main starts another race and when the session ends.
 */
class RacingSubRole extends AbstractRacingRole {
    /**
     * @param {RacingPlayerRoster} roster
     * @param {NetGameSubSession}  session
     */
    constructor(roster, session) {
        super();

        this._roster      = roster;
        this._session     = session;
        this._notice      = new RacingSessionNotice();
        this._data        = null;
        this._applier     = null;
        this._sampler     = null;    // the local player's, handed over on each frame
        this._levelSeq    = null;    // the main's sequence number of the race being built
        this._lastStateAt = null;
        this._ticks       = 0;       // of the states come since the previous frame
        this._localPaused = false;
        this._playEvent   = null;
        this._onLevelLoad = null;
    }

    /**
     * @param {function(object)}      playEvent   - RacingPresentation.playTurnEvent
     * @param {function(object)}      onLevelLoad - the main started a race: its levelLoad message
     * @param {function(string|null)} onNotice    - the message to show over the race, null for none
     * @param {function(string)}      onEnd       - the session ended, with its NetGameProtocol.END_* reason
     */
    follow(playEvent, onLevelLoad, onNotice, onEnd) {
        this._playEvent   = playEvent;
        this._onLevelLoad = onLevelLoad;
        this._notice.setOnNotice(onNotice);
        this._session.setCycle(this).setOnEnd(onEnd);

        return this;
    }

    /**
     * The race the main sent is built here: which one it is.
     *
     * @param {object} level - its levelLoad message
     */
    prepareLevel(level) {
        this._levelSeq = level.seq;
        this._applier  = null;
        this._notice.clear();
        this._session.setLivenessSuspended(true);
    }

    getNotice() {
        return this._notice;
    }

    // The main's race reports the finish and the records: nothing here.
    adoptRace(data) {
        this._data = data;
    }

    // Each car on its place of the grid until the main's first state; no record races here.
    enterRace() {
        for (const player of this._roster.getAll()) {
            const [x, height, z, heading] = RacingSimulation.startPlace(this._data, player.getId());
            const state = player.getCarState();
            state.x       = x;
            state.height  = height;
            state.z       = z;
            state.heading = heading;
            player.enterRace(null, new RacingRaceView(this._data.laps));
        }
        this._applier = new RacingReplicaApplier(this._roster, this._playEvent);
    }

    // The race is shown: the sub joins the turn cycle with the next state.
    levelStarted() {
        this._lastStateAt = null;
        this._session.setLivenessSuspended(false);
        this._session.sendControl({type: RacingNetProtocol.LEVEL_READY, seq: this._levelSeq});
    }

    // The main is told: the race stops for everyone.
    setLocalPaused(paused) {
        this._localPaused = paused;
        // No state came during the pause: the wait for the main counts from its end.
        if (!paused && (this._lastStateAt !== null)) {
            this._lastStateAt = performance.now();
        }
        this._session.sendControl({type: RacingNetProtocol.SUB_PAUSE, paused: paused});
    }

    isHeld() {
        return this._notice.isPaused();
    }

    // Every frame draws: the state, not a turn, moves a sub's race.
    isTurnReady() {
        return true;
    }

    /**
     * Nothing moves here: the sampler keeps collecting until the next state asks for the command. A state overdue for
     * longer than WAITING_NOTICE_MS with no word from the main names the main.
     */
    advance(ticks, sampler, now) {
        this._sampler = sampler;
        this._notice.update(now);
        const presented = this._ticks;
        this._ticks = 0;
        if ((this._lastStateAt !== null) && !this._notice.isPaused() && !this._notice.isWaiting()
            && ((now - this._lastStateAt) > NetTurnCycle.WAITING_NOTICE_MS)) {
            this._notice.setWaiting([this._session.getHostNickname()]);
        }

        return presented;
    }

    leave() {
        this._session.setCycle(null).leave();
    }

    // --- Session cycle ---

    levelLoad(message) {
        this._onLevelLoad(message);
    }

    waiting(nicknames) {
        this._notice.setWaiting(nicknames);
    }

    // Another player left the race: it is named for a moment.
    playerRemoved(message) {
        this._notice.departed(message.nickname, performance.now());
    }

    playerAway(message) {
        this._notice.awayChanged(message.nickname, (message.away === true), performance.now());
    }

    // No state comes during a pause: it ends with the next state. This device's own pause is its menu's.
    phase(message) {
        if (message.type !== RacingNetProtocol.PAUSE) {
            return;
        }
        const own = this._roster.getLocal().getId();
        this._notice.setPausedBy(message.players.filter((player) => (player.id !== own)).map((player) => player.nickname));
    }

    // Decoded in full before anything is applied; the command leaves at once.
    state(buffer) {
        if (this._applier === null) {
            return;
        }
        let snapshot = null;
        try {
            snapshot = RacingNetStateCodec.decode(buffer);
        } catch (error) {
            console.error('RacingSubRole - invalid state message (' + buffer.byteLength + ' bytes): ' + error.message);
            this._session.endInvalid();
            return;
        }
        this._applier.apply(snapshot);
        this._ticks += snapshot.ticks;
        // Sampled even when paused: what the menu took must not reach the race on resuming.
        const sampled = ((this._sampler !== null) ? this._sampler.sample() : null);
        const command = (((sampled === null) || this._localPaused) ? RacingSimulation.NEUTRAL_COMMAND : sampled);
        this._session.sendBinary(RacingNetCommandCodec.encode((snapshot.turn + 1), command));
        this._lastStateAt = performance.now();
        this._notice.turnArrived();
    }
}

/**
 * The main's turn cycle of a race (NetTurnCycle), which also hears a sub's pause — in a race, the pause of any player
 * stops it for everyone (user decision, a departure from doom_js where a sub's pause only opens its menu) — and the
 * record its levelReady carries.
 */
class RacingNetTurnCycle extends NetTurnCycle {
    /**
     * @param {NetGameMainSession} session
     */
    constructor(session) {
        super(session, new RacingNetCommandCodec());

        this._onSubPause  = null;
        this._onSubRecord = null;
    }

    /**
     * @param {function(int, boolean)} callback - the player id of a sub whose pause menu opened (true) or closed (false)
     */
    setOnSubPause(callback) {
        this._onSubPause = callback;

        return this;
    }

    /**
     * @param {function(int, object)} callback - the player id of a sub that built the race, and its device's record
     */
    setOnSubRecord(callback) {
        this._onSubRecord = callback;

        return this;
    }

    // A sub still building the race speaks of the race before it: its pause there holds nothing here.
    control(peer, message) {
        const sub      = (this._subs.get(peer.getId()) ?? null);
        const building = ((sub !== null) && (sub.phase === NetTurnCycle.SYNCING));
        if ((message.type === RacingNetProtocol.LEVEL_READY) && building && (message.seq === this._levelSeq)
            && (message.record !== null) && (message.record !== undefined) && (this._onSubRecord !== null)) {
            this._onSubRecord(this._session.playerIdOf(peer), message.record);
        }
        if (message.type !== RacingNetProtocol.SUB_PAUSE) {
            super.control(peer, message);
            return;
        }
        if ((sub !== null) && !building && (this._onSubPause !== null)) {
            this._onSubPause(this._session.playerIdOf(peer), (message.paused === true));
        }
    }
}

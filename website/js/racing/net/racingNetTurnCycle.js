/**
 * The main's turn cycle of a race (NetTurnCycle), which also hears a sub's pause: in a race, the pause of any player
 * stops it for everyone (user decision, an écart to doom_js where a sub's pause only opens its menu).
 */
class RacingNetTurnCycle extends NetTurnCycle {
    /**
     * @param {NetGameMainSession} session
     */
    constructor(session) {
        super(session, RacingNetCommandCodec);

        this._onSubPause = null;
    }

    /**
     * @param {function(int, boolean)} callback - the player id of a sub whose pause menu opened (true) or closed (false)
     */
    setOnSubPause(callback) {
        this._onSubPause = callback;

        return this;
    }

    control(peer, message) {
        if (message.type !== RacingNetProtocol.SUB_PAUSE) {
            super.control(peer, message);
            return;
        }
        if ((this._onSubPause !== null) && this._subs.has(peer.getId())) {
            this._onSubPause(this._session.playerIdOf(peer), (message.paused === true));
        }
    }
}

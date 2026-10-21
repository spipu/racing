/**
 * The session of the main of a game: it invites the subs, admits each one on
 * its hello and welcomes it with its player id, its slot and how the session
 * plays (the mode and its options), keeps the lobby — each sub's slot,
 * nickname and ping — and sends it to every sub whenever it changes and with
 * every ping sample, changes the mode, removes a sub, and stops the whole
 * session. A sub that leaves drops out of the lobby; one lost against its
 * will — its link gone, or too slow — once the game runs with players of
 * their own leaves its seat reserved for its return, in a game that holds
 * seats; one whose page goes to the background stays in it, marked away.
 *
 * A game extends it: what its invites carry (_invitePayload), whether its subs
 * play their own players in a mode (_subsPlayOwnPlayers), whether it holds the
 * seats of the players lost (_holdsSeats).
 */
class NetGameMainSession {
    /**
     * @param {object}        config
     * @param {NetGameLinks}  config.links
     * @param {string}        config.nickname - the main's
     * @param {int}           config.capacity - players, main included
     * @param {int}           config.mode     - the game's mode of the session
     * @param {object}        config.options  - the mode's game settings, as the subs get them
     * @param {string[]|null} config.colors   - CSS colour of each slot (index 0 = slot 1), shown when the subs play
     */
    constructor(config) {
        this._links     = config.links;
        this._colors    = config.colors;
        this._lobby     = new NetLobby(config.capacity).addMain(config.nickname);
        this._mode      = config.mode;
        this._options   = config.options;
        this._onRemoved = null;
        this._onAway    = null;
        this._onRelease = null;
        this._started   = false;
        this._pairing   = null;
        this._onChange  = null;
        this._cycle     = null;
        this._pending   = new Map();   // peer id → nickname of a sub paired but not yet heard
        this._lobby.setColors(this._colorsOf(config.mode));
        this._host      = new NetHostSession(appBootstrap.getVersion(), config.links.linkFactory())
            .setOnPeerOpen((peer) => this._admit(peer))
            .setOnPeerControl((peer, message) => this._receive(peer, message))
            .setOnPeerBinary((peer, buffer) => this._cycleCall('binary', peer, buffer))
            .setOnPeerLost((peer) => this._drop(peer, true));
        this._pingTimer = setInterval(() => this._samplePings(), NetConfig.PING_PERIOD_MS);
    }

    getLobby() {
        return this._lobby;
    }

    isStarted() {
        return this._started;
    }

    getMode() {
        return this._mode;
    }

    getOptions() {
        return this._options;
    }

    /**
     * Every sub is welcomed again under the new mode; the next invites carry it.
     *
     * @param {int}    mode    - the game's mode
     * @param {object} options
     */
    setMode(mode, options) {
        this._mode    = mode;
        this._options = options;
        this._lobby.setColors(this._colorsOf(mode));
        for (const peer of this._host.getPeers()) {
            if (this._lobby.getPlayer(peer.getId()) !== null) {
                this._welcome(peer);
            }
        }

        return this;
    }

    /**
     * @param {function(string)} callback - the nickname of a player who left, when the subs play
     */
    setOnPlayerRemoved(callback) {
        this._onRemoved = callback;

        return this;
    }

    /**
     * @param {function(string, boolean)} callback - the nickname of a player, when the subs play, and whether it went away or came back
     */
    setOnPlayerAway(callback) {
        this._onAway = callback;

        return this;
    }

    /**
     * @param {function(int)} callback - the slot of a seat no longer kept for its lost player
     */
    setOnSeatReleased(callback) {
        this._onRelease = callback;

        return this;
    }

    // A reserved seat lasts the level it was left in.
    releaseSeats() {
        const slots = this._lobby.releaseSeats();
        for (const slot of slots) {
            this._seatReleased(slot);
        }
        if (slots.length > 0) {
            this._changed();
        }
    }

    _seatReleased(slot) {
        if (this._onRelease !== null) {
            this._onRelease(slot);
        }
    }

    // The players' colours only mean something once they have a body.
    _colorsOf(mode) {
        return ((this._subsPlayOwnPlayers(mode)) ? this._colors : null);
    }

    /**
     * @param {int} mode
     * @returns {boolean} whether every sub of a session in that mode plays its own player, rather than watching the main's
     */
    _subsPlayOwnPlayers(mode) {
        return true;
    }

    // Whether a sub lost against its will keeps its seat for its return.
    _holdsSeats() {
        return false;
    }

    /**
     * @returns {Uint8Array} what the next invite carries besides the pairing (read by the subs)
     */
    _invitePayload() {
        return new Uint8Array(0);
    }

    /**
     * @returns {int|null} the player id of a sub in the lobby — its slot —, null for any other peer
     */
    playerIdOf(peer) {
        const player = this._lobby.getPlayer(peer.getId());

        return ((player !== null) ? player.slot : null);
    }

    /**
     * The turn cycle of the running game, told about every sub in the lobby:
     * {admitted(peer), gone(peer, keepsSeat), awayChanged(peer, away), control(peer, message), binary(peer, buffer)},
     * each method optional. Null detaches it.
     */
    setCycle(cycle) {
        this._cycle = cycle;
        if (cycle !== null) {
            for (const peer of this._host.getPeers()) {
                if (this._lobby.getPlayer(peer.getId()) !== null) {
                    cycle.admitted?.(peer);
                }
            }
        }

        return this;
    }

    // The nickname a sub joined with, the waiting message's.
    nicknameOf(peer) {
        const player = this._lobby.getPlayer(peer.getId());

        return ((player !== null) ? player.nickname : '');
    }

    // Called whenever the lobby changes, pings included.
    setOnChange(callback) {
        this._onChange = callback;

        return this;
    }

    /**
     * Pairs one more sub through the view: the invite shown, its answer read.
     *
     * @param {object} view - see NetPairing
     * @returns {Promise<NetPeer>}
     */
    addPlayer(view) {
        this._pairing = new NetHostPairing(this._host, view);

        return this._pairing.addPeer(this._invitePayload());
    }

    cancelPairing() {
        if (this._pairing !== null) {
            this._pairing.cancel();
        }
    }

    getCodeChannel() {
        return this._links.codeChannel();
    }

    start() {
        this._started = true;
        this._host.broadcastControl({type: NetGameProtocol.START});
    }

    /**
     * @param {int}    peerId - the sub's id in the lobby
     * @param {string} reason - the NetGameProtocol.END_* told to that sub
     */
    remove(peerId, reason = NetGameProtocol.END_REMOVED) {
        const peer = this._host.getPeers().find((candidate) => (candidate.getId() === peerId));
        if (peer === undefined) {
            return;
        }
        peer.sendControl({type: NetGameProtocol.SESSION_END, reason: reason});
        this._drop(peer, (reason === NetGameProtocol.END_TIMEOUT));
        setTimeout(() => this._host.remove(peer), NetGameProtocol.END_GRACE_MS);
    }

    /**
     * @param {string} reason - the NetGameProtocol.END_* told to every sub
     */
    stop(reason = NetGameProtocol.END_STOPPED) {
        clearInterval(this._pingTimer);
        this._cycle = null;
        this.cancelPairing();
        this._host.broadcastControl({type: NetGameProtocol.SESSION_END, reason: reason});
        // The subs answer the end during the grace: a stopped session tells nobody of their going.
        this._onChange  = null;
        this._onRemoved = null;
        this._onAway    = null;
        this._onRelease = null;
        setTimeout(() => this._host.close(), NetGameProtocol.END_GRACE_MS);
    }

    // The answer payload comes from the scanned code: a malformed one loses the
    // peer as an invalid message would. The sub enters the lobby on its hello.
    _admit(peer) {
        let nickname = null;
        try {
            nickname = NetGameAnswer.decode(peer.getPayload());
        } catch (error) {
            peer.reportInvalid(error);
            return;
        }
        this._pending.set(peer.getId(), nickname);
    }

    // The welcome precedes anything else the sub gets from the session: the
    // lobby, the start, the level to build.
    _join(peer) {
        const nickname = this._pending.get(peer.getId());
        if (nickname === undefined) {
            return;
        }
        this._pending.delete(peer.getId());
        const seat = this._lobby.claimSeat(nickname);
        if (seat === null) {
            this._refuse(peer, NetGameProtocol.END_FULL);
            return;
        }
        this._lobby.addPlayer(peer.getId(), nickname, seat.slot);
        if (seat.released !== null) {
            this._seatReleased(seat.released);
        }
        this._welcome(peer);
        if (this._started) {
            peer.sendControl({type: NetGameProtocol.START});
        }
        this._changed();
        this._cycleCall('admitted', peer);
    }

    _welcome(peer) {
        peer.sendControl({type: NetGameProtocol.WELCOME, playerId: this.playerIdOf(peer), mode: this._mode, options: this._options});
    }

    // A peer that never entered the lobby is told why and let go, nobody else hearing of it.
    _refuse(peer, reason) {
        peer.sendControl({type: NetGameProtocol.SESSION_END, reason: reason});
        setTimeout(() => this._host.remove(peer), NetGameProtocol.END_GRACE_MS);
    }

    _receive(peer, message) {
        if (message.type === NetGameProtocol.SESSION_END) {
            this._host.remove(peer);
            this._drop(peer);
            return;
        }
        if (message.type === NetGameProtocol.HELLO) {
            this._join(peer);
            return;
        }
        if (message.type === NetGameProtocol.AWAY) {
            this._setAway(peer, (message.away === true));
            return;
        }
        this._cycleCall('control', peer, message);
    }

    _setAway(peer, away) {
        const player = this._lobby.getPlayer(peer.getId());
        if ((player === null) || (player.away === away)) {
            return;
        }
        this._lobby.setAway(peer.getId(), away);
        // Without a turn cycle (in the lobby), the session keeps a suspended page's link itself; a cycle sees to it.
        if (this._cycle === null) {
            peer.setLivenessSuspended(away);
        }
        this._cycleCall('awayChanged', peer, away);
        this._tellOtherPlayers(peer, {type: NetGameProtocol.PLAYER_AWAY, nickname: player.nickname, away: away});
        this._changed();
        if (this._subsPlayOwnPlayers(this._mode) && (this._onAway !== null)) {
            this._onAway(player.nickname, away);
        }
    }

    // The turn cycle hears of the departure before the lobby forgets the sub's
    // slot; the main's game once the lobby has.
    _drop(peer, lostAgainstWill = false) {
        this._pending.delete(peer.getId());
        const player = this._lobby.getPlayer(peer.getId());
        if (player === null) {
            return;
        }
        const keepsSeat = (lostAgainstWill && this._started && this._holdsSeats() && this._subsPlayOwnPlayers(this._mode));
        this._cycleCall('gone', peer, keepsSeat);
        this._tellOtherPlayers(peer, {type: NetGameProtocol.PLAYER_REMOVED, playerId: player.slot, nickname: player.nickname});
        if (keepsSeat) {
            this._lobby.reserve(peer.getId());
        } else {
            this._lobby.remove(peer.getId());
        }
        this._changed();
        if (this._subsPlayOwnPlayers(this._mode) && (this._onRemoved !== null)) {
            this._onRemoved(player.nickname);
        }
    }

    // When the subs play, the other players hear of what happens to one of them.
    _tellOtherPlayers(peer, message) {
        if (!this._subsPlayOwnPlayers(this._mode)) {
            return;
        }
        for (const other of this._host.getPeers()) {
            if ((other !== peer) && (this._lobby.getPlayer(other.getId()) !== null)) {
                other.sendControl(message);
            }
        }
    }

    _cycleCall(event, peer, payload = null) {
        this._cycle?.[event]?.(peer, payload);
    }

    _samplePings() {
        for (const peer of this._host.getPeers()) {
            this._lobby.setPing(peer.getId(), peer.getPing());
        }
        this._changed();
    }

    _changed() {
        this._host.broadcastControl({type: NetGameProtocol.LOBBY, lobby: this._lobby.toData()});
        if (this._onChange !== null) {
            this._onChange();
        }
    }
}

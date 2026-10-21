/**
 * The role of the device that simulates the race — the only one in a race alone, the main in a session — as
 * DoomMainRole. RacingGame runs the flow every device shares and asks its role to move the race each frame; this role
 * owns the simulation (RacingSimulation) and everything only the simulating device does: the players entering the
 * race — the subs of its lobby on their places before the start (user decision: every car starts with the main's, a
 * departure from doom_js where a sub's player enters with its first command), leaving it with their link unless their
 * race is done (user decision: a finished player keeps its result) —, and, while it
 * hosts a session, the turn cycle of the subs (RacingNetTurnCycle): no turn before every awaited sub's command for it
 * is in, the state of each turn to the subs, and the pause of any player, which holds the race for everyone (user
 * decision). A device that only follows the race holds a RacingSubRole.
 */
class RacingMainRole extends AbstractRacingRole {
    /**
     * @param {RacingPlayerRoster} roster
     * @param {RacingTurnEvents}   events
     */
    constructor(roster, events) {
        super();

        this._roster     = roster;
        this._events     = events;
        this._simulation = new RacingSimulation(roster, events, Math.random);
        this._level      = null;        // {course, mirror, car, gearbox, laps} of the race shown, as the subs build it
        this._session    = null;
        this._cycle      = null;
        this._recorder   = null;        // RacingNetEvents listening to the turn events while hosting
        this._ticks      = 0;           // of the turn being simulated, sent with its state
        this._paused     = new Set();   // player ids of the players in their pause, the main's included
        this._onPausedBy = null;
        this._nicknames  = new Map();   // player id → nickname, kept once gone: the results name the abandons
    }

    // Each device hears of the finish and the records of its own player alone.
    adoptRace(data, onFinish, onRecord) {
        const local = (callback) => ((player, value) => {
            if (player === this._roster.getLocal()) {
                callback(value);
            }
        });
        this._simulation.adoptRace(data, local(onFinish), local(onRecord));
    }

    // The records are this device's: the other players' cars race against none.
    enterRace(record) {
        for (const player of this._roster.getAll()) {
            this._simulation.addPlayer(player, ((player === this._roster.getLocal()) ? record : null));
        }
    }

    getOutcome() {
        return this._simulation.getOutcome();
    }

    getNickname(id) {
        return (this._nicknames.get(id) ?? '');
    }

    // The race is shown: the subs build it once the session hosts it (startHosting).
    levelStarted(level) {
        this._level = level;
    }

    // The main restarts its race and picks the next one.
    restartsRace() {
        return true;
    }

    // --- Hosting ---

    /**
     * The subs of the session follow this device's race from now on: each one builds it, the start waits for them.
     *
     * @param {NetGameMainSession}  session
     * @param {function(string[])}  onWaiting  - the nicknames waited for, none once the wait is over
     * @param {function(string[])}  onPausedBy - the nicknames of the subs whose pause holds the race, none once it runs
     */
    startHosting(session, onWaiting, onPausedBy) {
        this._session    = session;
        this._onPausedBy = onPausedBy;
        this._cycle      = new RacingNetTurnCycle(session).setOnWaiting(onWaiting)
            .setOnPlayerGone((id) => this._playerGone(id))
            .setOnSubPause((id, paused) => this._setPaused(id, paused))
            .setOnSubRecord((id, record) => this._adoptSubRecord(id, record))
            .setHoldsLevelStart(true);
        this._hostRace();
        session.setCycle(this._cycle);
    }

    // The subs' cars leave with their session; the race goes on alone.
    stopHosting() {
        this._detachRecorder();
        this._cycle   = null;
        this._session = null;
        for (const player of this._roster.getAll()) {
            this.removePlayer(player.getId());
        }
    }

    _hostRace() {
        this._detachRecorder();
        const recorder = new RacingNetEvents();
        const capture  = new RacingNetStateCapture(this._roster, this._simulation.getOutcome(), recorder);
        this._recorder = recorder;
        this._events.addListener(recorder.getListener());
        const players = this._roster.getAll().map((player) => ({
            id:       player.getId(),
            nickname: this._nicknameOf(player.getId())
        }));
        for (const player of players) {
            this._nicknames.set(player.id, player.nickname);
        }
        this._cycle.levelStarted(Object.assign({players: players}, this._level), {
            encode: (turn) => RacingNetStateCodec.encode(capture.capture(turn, this._ticks)),
            drain:  () => recorder.drain()
        });
    }

    // A record sent by a sub's device, before its race starts; one of another shape is ignored.
    _adoptSubRecord(id, record) {
        const player = this._roster.getById(id);
        const time   = (ms) => ((typeof ms === 'number') && Number.isFinite(ms));
        const valid  = (time(record.lapMs) && Array.isArray(record.checkpointsMs)
            && (record.checkpointsMs.length === RacingRaceControl.CHECKPOINTS) && record.checkpointsMs.every((ms) => ((ms === null) || time(ms))));
        if ((player !== null) && (player.getRace() !== null) && valid) {
            this._simulation.setRecord(player, record);
        }
    }

    // The subs are told, while it hosts them.
    announcePhase(message) {
        if (this._cycle !== null) {
            this._cycle.announcePhase(message);
        }
    }

    _detachRecorder() {
        if (this._recorder !== null) {
            this._events.removeListener(this._recorder.getListener());
            this._recorder = null;
        }
    }

    /**
     * A sub of the session enters the race on its slot's place, before the start.
     *
     * @param {int}    id       - its slot
     * @param {string} nickname - shown over its car
     */
    addPlayer(id, nickname) {
        this._nicknames.set(id, nickname);
        if (this._roster.getById(id) !== null) {
            return;
        }
        const player = new RacingPlayer(id);
        this._roster.add(player);
        this._simulation.addPlayer(player, null);
    }

    // A sub gone during the race: its car leaves the track, unless its race is done (it keeps its result).
    _playerGone(id) {
        const player = this._roster.getById(id);
        if ((player !== null) && (player.getRace() !== null) && player.getRace().finished) {
            this._setPaused(id, false);
            return;
        }
        this.removePlayer(id);
    }

    /**
     * A sub left the session: its car leaves the track, its pause with it.
     *
     * @param {int} id
     */
    removePlayer(id) {
        const player = this._roster.getById(id);
        if ((player === null) || (player === this._roster.getLocal())) {
            return;
        }
        this._simulation.removePlayer(player);
        this._roster.remove(id);
        this._setPaused(id, false);
    }

    // --- Pause ---

    setLocalPaused(paused) {
        this._setPaused(this._roster.getLocal().getId(), paused);
    }

    // Another player's pause holds the race on this device.
    isHeld() {
        for (const id of this._paused) {
            if (id !== this._roster.getLocal().getId()) {
                return true;
            }
        }

        return false;
    }

    // Every change is told to the subs; the turns run again once the last pause is over.
    _setPaused(id, paused) {
        if (paused === this._paused.has(id)) {
            return;
        }
        if (paused) {
            this._paused.add(id);
        } else {
            this._paused.delete(id);
        }
        if (this._onPausedBy !== null) {
            this._onPausedBy(this._pausedNicknames(this._roster.getLocal().getId()));
        }
        if (this._cycle === null) {
            return;
        }
        if (this._paused.size > 0) {
            const players = Array.from(this._paused).map((id) => ({id: id, nickname: this._nicknameOf(id)}));
            this._cycle.announcePhase({type: RacingNetProtocol.PAUSE, players: players});
            return;
        }
        this._cycle.turnsResumed(performance.now());
    }

    _pausedNicknames(exceptId) {
        return Array.from(this._paused).filter((id) => (id !== exceptId)).map((id) => this._nicknameOf(id));
    }

    // The lobby's, else the one kept from the lobby before the race (a sub gone keeps its name).
    _nicknameOf(id) {
        const player = ((this._session !== null) ? this._session.getLobby().getPlayerInSlot(id) : null);

        return ((player !== null) ? player.nickname : this.getNickname(id));
    }

    // Nothing to leave: the main's session is stopped by the menus.
    leave() {
    }

    // --- Turn ---

    // No turn before every awaited sub's command for it is in.
    isTurnReady(now) {
        return ((this._cycle === null) || this._cycle.isTurnReady(now));
    }

    /**
     * One turn: the local player's command sampled now, the subs' that came for it, then the race, then the state to
     * the subs.
     *
     * @param {number}               ticks
     * @param {RacingCommandSampler} sampler
     * @param {number}               now
     * @returns {number} the ticks the race ran, presented
     */
    advance(ticks, sampler, now) {
        const commands = new Map([[this._roster.getLocal().getId(), sampler.sample()]]);
        if (this._cycle !== null) {
            for (const [id, command] of this._cycle.commands()) {
                commands.set(id, command);
            }
        }
        this._ticks = ticks;
        this._simulation.tick(ticks, commands);
        if (this._cycle !== null) {
            this._cycle.sendState(now);
        }

        return ticks;
    }
}

/**
 * The lobby of a game session: its players in slot order with their ping and,
 * when the subs play, the colour of their slot, updated live. The main adds a player
 * (greyed out once the lobby is full, absent when the game admits none for now),
 * removes a sub by picking its line, and starts from the bottom row, beside its
 * back button; a sub only sees the list — and that the game runs on the main —
 * and can leave.
 */
class AppMenuLobbyModal extends AppMenuAbstractListModal {
    /**
     * @param {AppMenuDisplay} display
     */
    constructor(display) {
        super(display);

        this._session  = null;
        this._isMain   = false;
        this._actions  = null;
        this._titleEl  = null;
        this._listEl   = null;
        this._statusEl = null;
        this._shape    = null;
        this._pingEls  = new Map();   // player id → its ping element
        this._itemKeys = [];          // what each list entry stands for, to keep the selection on it
    }

    /**
     * @param {NetGameMainSession} session
     * @param {{start: function, back: function|null, addPlayers: (boolean|undefined)}} actions - without back, Back
     *        closes the lobby; addPlayers false: no player is added from it (true by default)
     */
    openMain(session, actions) {
        this._isMain = true;

        return this._open(session, actions, appTranslator.get('menu.back'),
            {label: appTranslator.get('multiplayer.lobby.start'), action: () => this._actions.start()});
    }

    /**
     * @param {NetGameSubSession}  session
     * @param {{leave: function}} actions
     */
    openSub(session, actions) {
        this._isMain = false;

        return this._open(session, actions, appTranslator.get('multiplayer.lobby.leave'), null);
    }

    _open(session, actions, buttonLabel, confirmation) {
        this._session = session;
        this._actions = actions;
        const {titleEl, bodyEl} = this._openShell('', buttonLabel, confirmation);
        this._titleEl  = titleEl;
        this._listEl   = AppMenuDom.addElement(bodyEl, 'div', 'app-menu-list');
        this._statusEl = AppMenuDom.addElement(bodyEl, 'div', 'app-menu-status');
        this._shape    = null;
        session.setOnChange(() => this._refresh());
        this._refresh();
        this._nav.selectFirst();

        return this;
    }

    _teardown() {
        if (this._session !== null) {
            this._session.setOnChange(null);
        }
    }

    _onBack() {
        if (this._isMain && (this._actions.back !== null)) {
            this._actions.back();
            return;
        }
        if (!this._isMain) {
            this._actions.leave();
        }
        this.close();
    }

    // A new player list is rebuilt; a ping sample only rewrites the pings.
    _refresh() {
        const lobby = this._session.getLobby();
        const shape = JSON.stringify([lobby.getPlayers().map((player) => [player.id, player.color]), lobby.getReserved(), this._session.isStarted()]);
        this._titleEl.textContent = appTranslator.get('multiplayer.lobby.title', {count: lobby.getPlayers().length, capacity: lobby.getCapacity()});
        if (shape !== this._shape) {
            this._shape = shape;
            this._rebuild(lobby);
            return;
        }
        for (const player of lobby.getPlayers()) {
            const pingEl = this._pingEls.get(player.id);
            if (pingEl !== undefined) {
                this._showPing(pingEl, player);
            }
        }
    }

    // The selection stays on the entry it was on: a player joining must not
    // slide it from "Add a player" onto a line that removes someone.
    _rebuild(lobby) {
        const selected = (this._itemKeys[this._nav.getSelectedIndex()] ?? null);
        this._listEl.innerHTML = '';
        this._nav.clear();
        this._pingEls.clear();
        this._itemKeys = [];
        const seats = [...lobby.getPlayers(), ...lobby.getReserved()].sort((a, b) => (a.slot - b.slot));
        for (const seat of seats) {
            if (lobby.getReserved().includes(seat)) {
                this._addReservedSeat(seat);
            } else {
                this._addPlayer(seat);
            }
        }
        if (this._isMain) {
            this._addMainActions(lobby);
        }
        this._statusEl.textContent = (((!this._isMain) && this._session.isStarted()) ? appTranslator.get('multiplayer.lobby.inProgress') : '');
        if (selected !== null) {
            this._nav.restoreIndex(Math.max(0, this._itemKeys.indexOf(selected)));
        }
    }

    // The host is tagged; a sub shows its ping with signal bars, and on the main the cross that removes it.
    _addPlayer(player) {
        const item = this._addSeatItem(player, () => this._pickPlayer(player));
        if (player.id === NetLobby.MAIN_ID) {
            AppMenuDom.addText(item, 'app-menu-tag', appTranslator.get('multiplayer.lobby.main'));
        } else {
            const pingEl = AppMenuDom.addElement(item, 'span', 'app-menu-ping');
            AppMenuDom.addElement(pingEl, 'span', 'app-menu-ping-bars');
            AppMenuDom.addElement(pingEl, 'span', 'app-menu-ping-text');
            this._showPing(pingEl, player);
            this._pingEls.set(player.id, pingEl);
            if (this._isMain) {
                AppMenuDom.addDeleteButton(item, appTranslator.get('multiplayer.lobby.remove'), () => this._pickPlayer(player));
            }
        }
        this._itemKeys.push(player.id);
    }

    // The bars fill by thresholds of the round trip (AppMenuLobbyModal.PING_BAR_LIMITS_MS), none before a sample.
    _showPing(pingEl, player) {
        let level = 0;
        if ((player.ping !== null) && (player.away !== true)) {
            level = AppMenuLobbyModal.PING_BAR_LIMITS_MS.filter((limit) => (player.ping <= limit)).length + 1;
        }
        pingEl.dataset.level = String(level);
        pingEl.querySelector('.app-menu-ping-text').textContent = this._pingText(player);
    }

    // A lost player's seat, kept for its return: nothing to do with it.
    _addReservedSeat(seat) {
        const item = this._addSeatItem(seat, () => {});
        item.classList.add('app-menu-item-disabled');
        AppMenuDom.addText(item, 'app-menu-item-infos', appTranslator.get('multiplayer.lobby.disconnected'));
        this._itemKeys.push(AppMenuLobbyModal.KEY_RESERVED + seat.slot);
    }

    _addSeatItem(seat, action) {
        const label = appTranslator.get('multiplayer.lobby.player', {slot: seat.slot, nickname: seat.nickname});
        const item  = this._nav.addItemIn(this._listEl, label, action);
        if (seat.color !== null) {
            AppMenuDom.addColorSwatch(item, seat.color);
        }

        return item;
    }

    _addMainActions(lobby) {
        if (this._actions.addPlayers === false) {
            return;
        }
        const add = this._nav.addItemIn(this._listEl, appTranslator.get('multiplayer.lobby.add'), () => this._addPlayerIfRoom());
        add.classList.add('app-menu-item-add');
        if (lobby.isFull()) {
            add.classList.add('app-menu-item-disabled');
        }
        this._itemKeys.push(AppMenuLobbyModal.KEY_ADD);
    }

    _addPlayerIfRoom() {
        if (this._session.getLobby().isFull()) {
            AppMenuSound.play(AppMenuSound.INVALID);
            return;
        }
        new AppMenuPairingModal(this._display).openForMain(this._session);
    }

    // The main removes a sub by picking its line; nothing else reacts.
    _pickPlayer(player) {
        if (!this._isMain || (player.id === NetLobby.MAIN_ID)) {
            return;
        }
        this._confirm(appTranslator.get('multiplayer.lobby.removeConfirm', {nickname: player.nickname}),
            () => this._session.remove(player.id), null, null, true);
    }

    _pingText(player) {
        if (player.away === true) {
            return appTranslator.get('multiplayer.lobby.away');
        }
        if (player.ping === null) {
            return appTranslator.get('multiplayer.lobby.pingPending');
        }
        const ping = new Intl.NumberFormat(appTranslator.getLocale(), {maximumFractionDigits: 0}).format(player.ping);

        return appTranslator.get('multiplayer.lobby.ping', {ping: ping});
    }
}

AppMenuLobbyModal.KEY_ADD            = 'add';
AppMenuLobbyModal.KEY_RESERVED       = 'reserved-';
// Round trips under which the signal shows 4, 3, then 2 bars; above the last one, a single bar.
AppMenuLobbyModal.PING_BAR_LIMITS_MS = Object.freeze([40, 90, 180]);

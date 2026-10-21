/**
 * The players of a race, looked up by id, one of them being the local player (the one this device samples and views).
 * A race alone holds its local player alone. The list of all is kept in slot order — the order that breaks the ties of
 * the ranking — and rebuilt only when a player comes or goes: it is read every frame.
 */
class RacingPlayerRoster {
    constructor() {
        this._players = new Map();
        this._localId = null;
        this._all     = null;   // in slot order, null once a player came or went
    }

    add(player) {
        this._players.set(player.getId(), player);
        this._all = null;

        return this;
    }

    setLocal(player) {
        this.add(player);
        this._localId = player.getId();

        return this;
    }

    remove(id) {
        this._players.delete(id);
        this._all = null;

        return this;
    }

    /**
     * @returns {RacingPlayer}
     */
    getLocal() {
        return this._players.get(this._localId);
    }

    /**
     * @param {int} id
     * @returns {RacingPlayer|null}
     */
    getById(id) {
        return (this._players.get(id) ?? null);
    }

    /**
     * @returns {RacingPlayer[]} in slot order; shared, never to be changed by the caller (a new one replaces it)
     */
    getAll() {
        this._all ??= Array.from(this._players.values()).sort((a, b) => (a.getId() - b.getId()));

        return this._all;
    }
}

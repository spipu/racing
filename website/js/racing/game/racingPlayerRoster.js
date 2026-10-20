/**
 * The players of a race, looked up by id, one of them being the local player (the one this device samples and views).
 * A race alone holds its local player alone.
 */
class RacingPlayerRoster {
    constructor() {
        this._players = new Map();
        this._localId = null;
    }

    add(player) {
        this._players.set(player.getId(), player);

        return this;
    }

    setLocal(player) {
        this.add(player);
        this._localId = player.getId();

        return this;
    }

    remove(id) {
        this._players.delete(id);

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
     * @returns {RacingPlayer[]} in joining order
     */
    getAll() {
        return Array.from(this._players.values());
    }
}

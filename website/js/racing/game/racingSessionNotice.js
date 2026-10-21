/**
 * The one message of a race session over the race (NetSessionNotice), as DoomSessionNotice: its prompt names the
 * players whose pause holds the race (user decision: any player's pause stops the race for everyone), the local
 * player's own pause aside — its menu says it.
 */
class RacingSessionNotice extends NetSessionNotice {
    constructor() {
        super();

        this._pausedBy = [];   // nicknames of the other players in their pause
    }

    /**
     * @param {string[]} nicknames - none once nobody else holds the race
     */
    setPausedBy(nicknames) {
        this._pausedBy = nicknames;
        this._refresh();
    }

    isPaused() {
        return (this._pausedBy.length > 0);
    }

    // A turn state came: the race runs again.
    turnArrived() {
        this._pausedBy = [];
        super.turnArrived();
    }

    clear() {
        this._pausedBy = [];
        super.clear();
    }

    _promptText() {
        return ((this._pausedBy.length > 0) ? appTranslator.get('multiplayer.pausedBy', {nickname: this._pausedBy.join(', ')}) : null);
    }
}

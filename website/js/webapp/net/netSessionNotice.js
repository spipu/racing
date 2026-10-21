/**
 * The one message a game session shows over the game, by priority: the
 * players the game waits for, then the host's pause, then the game's prompt
 * to the local player, then the last news of another player — left, away,
 * back — (for NEWS_MS), then the game's status of the session. Each device
 * keeps its own: the main shows who it waits for and the players' news, a sub
 * everything the main tells it.
 *
 * A game extends it with its prompt (_promptText) and its status
 * (_statusText), and calls _refresh when either changes.
 */
class NetSessionNotice {
    constructor() {
        this._waiting    = [];      // nicknames the game waits for
        this._mainPaused = false;
        this._news       = null;    // {code, nickname, until}: the last thing that happened to another player
        this._shown      = null;
        this._onNotice   = null;
    }

    /**
     * @param {function(string|null)} callback - the message to show, null for none
     */
    setOnNotice(callback) {
        this._onNotice = callback;

        return this;
    }

    setWaiting(nicknames) {
        this._waiting = nicknames;
        this._refresh();
    }

    isWaiting() {
        return (this._waiting.length > 0);
    }

    // The host paused: it waits for nobody meanwhile.
    pausedByMain() {
        this._waiting    = [];
        this._mainPaused = true;
        this._refresh();
    }

    // A turn state came: the wait and the host's pause are over.
    turnArrived() {
        this._waiting    = [];
        this._mainPaused = false;
        this._refresh();
    }

    isMainPaused() {
        return this._mainPaused;
    }

    /**
     * @param {string} nickname
     * @param {number} now      - performance.now() clock
     */
    departed(nickname, now) {
        this._tell('multiplayer.playerLeft', nickname, now);
    }

    /**
     * @param {string}  nickname
     * @param {boolean} away     - whether its page went to the background, or came back
     * @param {number}  now      - performance.now() clock
     */
    awayChanged(nickname, away, now) {
        this._tell(((away) ? 'multiplayer.playerAway' : 'multiplayer.playerBack'), nickname, now);
    }

    _tell(code, nickname, now) {
        this._news = {code: code, nickname: nickname, until: now + NetSessionNotice.NEWS_MS};
        this._refresh();
    }

    // Called every frame: a player's news runs out.
    update(now) {
        if ((this._news !== null) && (now >= this._news.until)) {
            this._news = null;
            this._refresh();
        }
    }

    // A new level, or no session any more: nothing left to say.
    clear() {
        this._waiting    = [];
        this._mainPaused = false;
        this._news       = null;
        this._refresh();
    }

    _refresh() {
        const text = this._text();
        if ((text === this._shown) || (this._onNotice === null)) {
            return;
        }
        this._shown = text;
        this._onNotice(text);
    }

    _text() {
        if (this._waiting.length > 0) {
            return appTranslator.get('multiplayer.waiting', {nickname: this._waiting.join(', ')});
        }
        if (this._mainPaused) {
            return appTranslator.get('multiplayer.pausedByMain');
        }
        const prompt = this._promptText();
        if (prompt !== null) {
            return prompt;
        }
        if (this._news !== null) {
            return appTranslator.get(this._news.code, {nickname: this._news.nickname});
        }

        return this._statusText();
    }

    /**
     * @returns {string|null} what the game asks of the local player, over the players' news
     */
    _promptText() {
        return null;
    }

    /**
     * @returns {string|null} the game's lasting word on the session, under the players' news
     */
    _statusText() {
        return null;
    }
}

NetSessionNotice.NEWS_MS = 3000;

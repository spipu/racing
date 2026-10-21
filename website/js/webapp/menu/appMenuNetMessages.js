/**
 * The explicit messages of the multiplayer flows of a game, shared by the
 * main's menus and the sub's screens: why this device cannot play, and why a
 * session ended. A game adds the texts of its own end reasons (registerEnd).
 */
class AppMenuNetMessages {
    /**
     * @param {AppMenuDisplay} display
     * @param {string}         reason  - NetGameAvailability.NO_*
     */
    static showUnavailable(display, reason) {
        AppMenuSound.play(AppMenuSound.INVALID);
        new AppMenuModal(display).info(appTranslator.get(AppMenuNetMessages.UNAVAILABLE[reason]));
    }

    /**
     * @param {AppMenuDisplay} display
     * @param {string}         reason  - NetGameProtocol.END_*, or one of the game's
     * @param {function|null}  onClose
     */
    static showEnd(display, reason, onClose = null) {
        const code = (AppMenuNetMessages.ENDS[reason] ?? AppMenuNetMessages.ENDS[NetGameProtocol.END_LOST]);
        new AppMenuModal(display).info(appTranslator.get(code), onClose);
    }

    /**
     * @param {string} reason - an end reason of the game
     * @param {string} code   - the text that explains it
     */
    static registerEnd(reason, code) {
        AppMenuNetMessages.ENDS[reason] = code;
    }
}

AppMenuNetMessages.UNAVAILABLE = {
    [NetGameAvailability.NO_WEBGL]:  'multiplayer.unavailable.webgl',
    [NetGameAvailability.NO_CAMERA]: 'multiplayer.unavailable.camera'
};
AppMenuNetMessages.ENDS = {
    [NetGameProtocol.END_STOPPED]:   'multiplayer.end.stopped',
    [NetGameProtocol.END_REMOVED]:   'multiplayer.end.removed',
    [NetGameProtocol.END_TIMEOUT]:   'multiplayer.end.timeout',
    [NetGameProtocol.END_LOST]:      'multiplayer.end.lost',
    [NetGameProtocol.END_GAME_OVER]: 'multiplayer.end.gameOver',
    [NetGameProtocol.END_INVALID]:   'multiplayer.end.invalid',
    [NetGameProtocol.END_FULL]:      'multiplayer.end.full'
};

/**
 * The way into every multiplayer flow of a game: its menu entry greys out
 * once the device proves unable to play, pressing it then explains why, and a
 * missing nickname is asked for before the flow goes on.
 */
class AppMenuNetGate {
    /**
     * @param {HTMLElement}                      item
     * @param {function(): Promise<string|null>} unavailableReason - NetGameAvailability.unavailableReason
     */
    static greyWhenUnavailable(item, unavailableReason) {
        unavailableReason().then((reason) => {
            if (reason !== null) {
                item.classList.add('app-menu-item-disabled');
            }
        });
    }

    /**
     * @param {AppMenuDisplay}                   display
     * @param {function(): Promise<string|null>} unavailableReason
     * @param {AppSettings}                      settings          - holding the nickname (AppMenuNicknamePrompt.SETTING_KEY)
     * @param {function(string)}                 onReady           - receives the nickname
     */
    static async enter(display, unavailableReason, settings, onReady) {
        const reason = await unavailableReason();
        if (reason !== null) {
            AppMenuNetMessages.showUnavailable(display, reason);
            return;
        }
        AppMenuNicknamePrompt.ensure(display, settings, onReady);
    }
}

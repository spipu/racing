/**
 * Entering any multiplayer flow needs a nickname: with none stored, a
 * dedicated text entry asks for it first and stores it, then the flow goes
 * on; cancelling it abandons the flow.
 */
class AppMenuNicknamePrompt {
    /**
     * @param {AppMenuDisplay}   display
     * @param {AppSettings}      settings - defining SETTING_KEY
     * @param {function(string)} onReady  - receives the nickname
     */
    static ensure(display, settings, onReady) {
        const nickname = settings.get(AppMenuNicknamePrompt.SETTING_KEY);
        if (nickname !== '') {
            onReady(nickname);
            return;
        }
        const definition = settings.getDefinition(AppMenuNicknamePrompt.SETTING_KEY);
        new AppMenuTextEntryModal(display).open(appTranslator.get('multiplayer.nickname.prompt'), definition, '', (value) => {
            settings.set(AppMenuNicknamePrompt.SETTING_KEY, value);
            onReady(value);
        });
    }
}

AppMenuNicknamePrompt.SETTING_KEY = 'multiplayer.nickname';

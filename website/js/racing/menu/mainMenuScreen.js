/**
 * Main menu, the screen the application starts on: the logo over a simple
 * menu, the help in the corner.
 */
class MainMenuScreen extends AbstractRacingMenuScreen {
    _build() {
        this._container.classList.add('app-menu-screen-home');
        const {titleEl, listEl} = this._buildSimpleMenu('');
        this._addLogo(titleEl);

        this._addListItem(listEl, appTranslator.get('menu.newRace'), () => {
            this._navigator.openCourses();
        });
        this._addListItem(listEl, appTranslator.get('menu.bestLaps'), () => {
            this._navigator.openBestLaps();
        });
        this._addListItem(listEl, appTranslator.get('menu.multiplayer'), () => {
            this._navigator.openMultiplayer();
        });
        this._addListItem(listEl, appTranslator.get('menu.options'), () => {
            this._openModal(new RacingOptionsModal(this._display)).show();
        });
        this._addCornerButtons([{icon: 'help', label: appTranslator.get('menu.help'), action: () => {
            this._openModal(new RacingOptionsModal(this._display)).showHelp();
        }}]);

        this._nav.selectFirst();
    }

    _addLogo(titleEl) {
        AppMenuDom.addText(titleEl, 'racing-logo-word', MainMenuScreen.LOGO_WORDS[0]);
        AppMenuDom.addText(titleEl, 'racing-logo-accent', MainMenuScreen.LOGO_WORDS[1]);
        AppMenuDom.addElement(titleEl, 'span', 'racing-logo-checker');
    }
}

// The brand (RacingMenuNavigator.BRAND) cut where the logo changes colour; not translated.
MainMenuScreen.LOGO_WORDS = Object.freeze(['Spipu-', 'Racing']);

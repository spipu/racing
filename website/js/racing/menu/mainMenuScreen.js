/**
 * Main menu, the screen the application starts on.
 */
class MainMenuScreen extends AbstractRacingMenuScreen {
    _build() {
        const {listEl} = this._buildPanel(appTranslator.get('menu.main'));

        this._addListItem(listEl, appTranslator.get('menu.newRace'), () => {
            this._navigator.openCourses();
        });
        this._addListItem(listEl, appTranslator.get('menu.bestLaps'), () => {
            this._navigator.openBestLaps();
        });
        this._addListItem(listEl, appTranslator.get('menu.options'), () => {
            this._openModal(new RacingOptionsModal(this._display)).show();
        });
        this._addListItem(listEl, appTranslator.get('menu.help'), () => {
            this._openModal(new RacingOptionsModal(this._display)).showHelp();
        });

        this._nav.selectFirst();
    }
}

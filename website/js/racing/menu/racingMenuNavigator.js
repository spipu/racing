/**
 * Entry point of the menu: instantiates the display, opens the database, reads
 * the settings (their language reaches the translator before the first screen
 * is built) and handles the navigation between the screens.
 */
class RacingMenuNavigator {
    constructor() {
        this._display        = new AppMenuDisplay('screen', AppMenuDisplay.LANDSCAPE);
        this._database       = new AppDatabase(RacingDatabaseSchema.build());
        this._mainMenuScreen = new MainMenuScreen(this, this._display);
        this._courseScreen   = new CourseScreen(this, this._display);
        this._carScreen      = new CarScreen(this, this._display);
        this._currentScreen  = null;
        this._gearbox        = RacingMenuNavigator.GEARBOX_AUTOMATIC;
    }

    // A storage failure keeps the default settings, a catalog failure leaves no course to choose: the menu still
    // opens, with a notice.
    start() {
        this._display.init();
        const catalog = racingCatalog.load()
            .then(() => null, (error) => error);
        const storage = this._database.open()
            .then(() => racingSettings.init(this._database))
            .then(() => racingBestTimes.init(this._database))
            .then(() => true, (error) => {
                console.warn('RacingMenuNavigator - storage unavailable: ' + error.message);
                return false;
            });
        Promise.all([catalog, storage])
            .then(([catalogError, storageReady]) => {
                racingSettings.applyToTranslator(appTranslator);
                this.showMainMenu();
                if (catalogError !== null) {
                    new AppMenuModal(this._display).showError(appTranslator.get('menu.catalogUnavailable'), catalogError.message);
                } else if (!storageReady) {
                    new AppMenuModal(this._display).info(appTranslator.get('menu.storageUnavailable'));
                }
            })
            .catch((error) => {
                console.error(error);
            });

        return this;
    }

    showMainMenu() {
        this._switchTo(this._mainMenuScreen);
    }

    openCourses() {
        this._switchTo(this._courseScreen);
    }

    /**
     * @param {{course: string, mirror: boolean}} choice
     */
    openCars(choice) {
        this._switchTo(this._carScreen.setChoice(choice));
    }

    /**
     * Leaves the menus for the race; a load failure brings the car screen back with the error.
     *
     * @param {{course: string, mirror: boolean, car: string, gearbox: string}} selection
     */
    startRace(selection) {
        this._switchTo(null);
        this._display.destroy();
        new RacingGame(this, selection).start().catch((error) => {
            console.error(error);
            this.raceFailed(selection, error);
        });
    }

    // A race that could not load or stopped on an error: back to its car screen, with the error.
    raceFailed(selection, error) {
        this._display.init();
        this.openCars(selection);
        new AppMenuModal(this._display).showError(appTranslator.get('race.failed'), error.message);
    }

    // Back from a race: the course choice, for the next one.
    endRace() {
        this._display.init();
        this.openCourses();
    }

    // Gearbox kept for the session, shown on the car screen.
    getGearbox() {
        return this._gearbox;
    }

    toggleGearbox() {
        this._gearbox = ((this._gearbox === RacingMenuNavigator.GEARBOX_AUTOMATIC) ? RacingMenuNavigator.GEARBOX_MANUAL : RacingMenuNavigator.GEARBOX_AUTOMATIC);

        return this;
    }

    // null leaves the menus without a screen (a race).
    _switchTo(screen) {
        if (this._currentScreen !== null) {
            this._currentScreen.hide();
        }
        this._currentScreen = screen;
        if (screen !== null) {
            screen.show();
        }
    }
}

RacingMenuNavigator.BRAND             = 'Spipu-Racing';
RacingMenuNavigator.GEARBOX_AUTOMATIC = 'automatic';
RacingMenuNavigator.GEARBOX_MANUAL    = 'manual';

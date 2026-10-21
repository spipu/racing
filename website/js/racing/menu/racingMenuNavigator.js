/**
 * Entry point of the menu: instantiates the display, opens the database, reads
 * the settings (their language reaches the translator before the first screen
 * is built) and handles the navigation between the screens. It holds the
 * session this device hosts (RacingHostedSession) from "Create a race" on,
 * across the races and back through the choice of the course (user decision:
 * the session outlives a race), until the main menu or the session's stop, and
 * the session it follows (RacingFollowedSession) from the main's first race on,
 * until it ends.
 */
class RacingMenuNavigator {
    constructor() {
        this._display           = new AppMenuDisplay('screen', AppMenuDisplay.LANDSCAPE);
        this._database          = new AppDatabase(RacingDatabaseSchema.build());
        this._mainMenuScreen    = new MainMenuScreen(this, this._display);
        this._courseScreen      = new CourseScreen(this, this._display);
        this._carScreen         = new CarScreen(this, this._display);
        this._bestLapsScreen    = new BestLapsScreen(this, this._display);
        this._multiplayerScreen = new MultiplayerScreen(this, this._display);
        this._hosted            = null;   // RacingHostedSession from "Create a race" on
        this._currentScreen     = null;
        this._gearbox           = RacingMenuNavigator.GEARBOX_AUTOMATIC;
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
                racingSound.boot();
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

    openBestLaps() {
        this._switchTo(this._bestLapsScreen);
    }

    openCourses() {
        this._switchTo(this._courseScreen);
    }

    openMultiplayer() {
        this._switchTo(this._multiplayerScreen);
    }

    /**
     * "Create a race", its checks passed: the course, the car and the gearbox, then the race built for the session
     * with the lobby over it.
     *
     * @param {string} nickname
     */
    openSessionCourses(nickname) {
        this._hosted = new RacingHostedSession(nickname);
        this.openCourses();
    }

    // Back from the course choice: in a session, its stop, asked first when players are in.
    leaveCourses() {
        if (this._hosted === null) {
            this.showMainMenu();
            return;
        }
        const leave = () => {
            this._hosted.stop();
            this._hosted = null;
            this.openMultiplayer();
        };
        if (!this._hosted.hasPlayers()) {
            leave();
            return;
        }
        new AppMenuModal(this._display).confirm(appTranslator.get('multiplayer.pause.stopConfirm'), leave);
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
        new RacingGame(this, selection, this._hosted).start().catch((error) => {
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

    // Back from a finished race to the choice of the course.
    endRaceToCourses() {
        this._display.init();
        this.openCourses();
    }

    // Back from a race: the main menu, the session stopped.
    endRace() {
        this.sessionStopped();
        this._display.init();
        this.showMainMenu();
    }

    // Left from the start lobby, the session stopped there: the car screen, a new session on the next start.
    leaveSessionStart(selection) {
        this._display.init();
        this.openCars(selection);
    }

    // The session is over: the next race runs alone.
    sessionStopped() {
        if (this._hosted !== null) {
            this._hosted.stop();
            this._hosted = null;
        }
    }

    /**
     * A sub's lobby got the main's race to build: the menus go, the race the main sent is built.
     *
     * @param {NetGameSubSession} session
     * @param {object}            level   - its levelLoad message
     */
    joinSharedRace(session, level) {
        this._switchTo(null);
        this._display.destroy();
        new RacingFollowedSession(this, session).join(level);
    }

    /**
     * The followed session is over: the Multiplayer screen again, with why when the main or the link ended it.
     *
     * @param {string|null} reason - NetGameProtocol.END_*, null when this device left it
     */
    leftFollowedSession(reason) {
        this._display.init();
        this.openMultiplayer();
        if (reason !== null) {
            AppMenuNetMessages.showEnd(this._display, reason);
        }
    }

    // The main's race could not be built or stopped on an error: the session is left, with the error.
    leftFollowedSessionOnError(error) {
        this._display.init();
        this.openMultiplayer();
        new AppMenuModal(this._display).showError(appTranslator.get('race.failed'), error.message);
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

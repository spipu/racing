/**
 * The flow of a race every device shares, as DoomGame: the exported data loaded, the race built and shown, its
 * frames, the pause menu over the frozen race (RacingPauseModal: Escape, or the pause button of the gamepad or of the
 * touch controls), the results (RacingResultsModal) over the race that goes on after the finish, the car driving
 * itself, and the best times of this device's own player — driven on the role of the device (RacingMainRole simulates
 * the race), never on which it is. The local player's commands are sampled from the controls (RacingControls,
 * RacingCommandSampler); the one-shot events of the race reach the presentation (RacingPresentation) as they come.
 */
class RacingGame {
    /**
     * @param {RacingMenuNavigator} navigator
     * @param {{course: string, mirror: boolean, car: string, gearbox: string}} selection
     */
    constructor(navigator, selection) {
        this._navigator       = navigator;
        this._selection       = selection;
        this._roster          = new RacingPlayerRoster().setLocal(new RacingPlayer(RacingGame.LOCAL_PLAYER_ID));
        this._turnEvents      = new RacingTurnEvents();
        this._role            = new RacingMainRole(this._roster, this._turnEvents);
        this._presentation    = new RacingPresentation(selection);
        this._controls        = null;
        this._commandSampler  = null;
        this._results         = null;
        this._resultsDisplay  = null;
        this._running         = false;
        this._paused          = false;
        this._pauseWasDown    = true;
        this._pauseDisplay    = null;
        this._pauseModal      = null;
        this._animateCallback = (timestamp) => this._guard(this._animate, timestamp);
        this._turnEvents.addListener((event) => this._presentation.playTurnEvent(event));
    }

    async start() {
        const base      = RacingGame.ASSETS;
        const selection = this._selection;
        const sky       = (base + 'skies/' + selection.course + '.png');
        // The record of this device, none before a first lap (no record of the original: user decision).
        const stored = (racingBestTimes.isReady() ? racingBestTimes.get(selection.course, selection.mirror, selection.car).catch(() => null) : Promise.resolve(null));
        // The sky is checked here: the texture loader has no error path, a missing image would hang the race.
        const [course, cars, palettes, race, physics, multiplayerGrids, , best] = await Promise.all([
            appBootstrap.fetchJsonAsync(base + 'courses/' + selection.course + '.json'),
            appBootstrap.fetchJsonAsync(base + 'cars.json'),
            appBootstrap.fetchJsonAsync(base + 'palettes.json'),
            appBootstrap.fetchJsonAsync(base + 'race.json'),
            appBootstrap.fetchJsonAsync(base + 'physics.json'),
            appBootstrap.fetchJsonAsync(base + 'multiplayer_grids.json'),
            appBootstrap.fetchAsync(sky),
            stored,
            racingSound.loadAsync()
        ]);

        const players     = this._roster.getAll();
        const multiplayer = (players.length > 1);
        const laps        = ((multiplayer) ? racingSettings.getMultiplayerLaps() : racingSettings.getSoloLaps());
        loader.reset();
        loader.beginBatch();
        this._presentation.build({course, cars, palettes, race, physics, players, viewed: this._roster.getLocal(), multiplayer});
        this._role.adoptRace({course, race, physics, multiplayerGrids, selection, multiplayer, laps, lapJingles: racingSound.laps},
            (result) => this._guard(this._finish, result), (lap) => this._saveRecord(lap.lapMs, null, lap.checkpointsMs));
        this._role.enterRace(((best !== null) && (best.lapMs !== null)) ? {lapMs: best.lapMs, checkpointsMs: (best.checkpointsMs ?? [null, null])} : null);

        const skyId = loader.textures().load(sky);
        // Called from the image load: an error there would not reach the promise of start().
        loader.setCallback(() => {
            loader.clearCallback();
            this._guard(this._begin, skyId);
        });
        loader.endBatch();
    }

    quit() {
        if (!this._running) {
            return;
        }
        this._teardown();
        this._navigator.endRace();
    }

    // The race scene, its pause menu and its listener go: the menus come back.
    _teardown() {
        this._running = false;
        if (this._pauseModal !== null) {
            this._closePause();
        }
        if (this._results !== null) {
            this._closeResults();
        }
        this._presentation.teardown();
        if (this._controls !== null) {
            this._controls.teardown();
        }
        new ScreenWakeLock().release();
        loader.reset();
    }

    _begin(skyId) {
        this._presentation.showRace(skyId, this._roster.getLocal());
        this._controls       = new RacingControls(this._presentation.getDisplay(), (this._selection.gearbox === RacingMenuNavigator.GEARBOX_MANUAL));
        this._commandSampler = new RacingCommandSampler(this._controls);
        this._presentation.bindControls(this._controls);
        this._running        = true;
        // Driven with a gamepad, the screen gets no touch to keep it awake.
        new ScreenWakeLock().init();
        requestAnimationFrame(this._animateCallback);
    }

    // --- Pause menu ---

    // From the root of the pause only: the stacked options handle Escape as one step back.
    _togglePause() {
        if (!this._running || (this._results !== null)) {
            return;
        }
        if (!this._paused) {
            this._enterPause();
            return;
        }
        if (this._pauseModal.isAtRoot()) {
            this._leavePause();
        }
    }

    // The race stops under the menu: simulation, controls, touch controls, sounds.
    _enterPause() {
        this._paused = true;
        this._controls.setVirtualPadVisible(false);
        this._presentation.setSoundPaused(true);
        this._pauseDisplay = new AppMenuDisplay('screen').init(true);
        this._pauseModal   = new RacingPauseModal(this._pauseDisplay)
            .setOnResume(() => this._leavePause())
            .setOnRestart(() => this._restart())
            .setOnQuit(() => this.quit())
            .show(() => this._pauseTitle());
    }

    // The settings changed in the pause apply on resume, a renderer change on the next live frame.
    _leavePause() {
        this._closePause();
        this._paused       = false;
        this._pauseWasDown = true;
        this._presentation.getEngine().resetDeltaClock();
        this._controls.applySettings().setVirtualPadVisible(true);
        this._presentation.setSoundPaused(false);
    }

    // --- Finish ---

    // The records of this device, the results over the race that goes on, without the touch controls.
    _finish(result) {
        this._presentation.showResults();
        this._controls.setVirtualPadVisible(false);
        // The best lap was saved when it was done: the records shown are those of the race.
        this._saveRecord(null, result.raceMs, null).then((records) => {
            if (!this._running) {
                return;
            }
            this._resultsDisplay = new AppMenuDisplay('screen').init(true);
            this._results = new RacingResultsModal(this._resultsDisplay)
                .setOnRestart(() => this._restart())
                .setOnCourses(() => {
                    this._teardown();
                    this._navigator.endRaceToCourses();
                })
                .setOnQuit(() => this.quit())
                .show(this._resultsTitle(), result, {newLap: result.newRecord, newRace: records.newRace});
        });
    }

    // Into the best times of this device: a lap as soon as it beats the record, the race time at the finish.
    _saveRecord(lapMs, raceMs, checkpointsMs) {
        const selection = this._selection;
        if (!racingBestTimes.isReady()) {
            return Promise.resolve({newLap: false, newRace: false});
        }

        return racingBestTimes.record(selection.course, selection.mirror, selection.car, lapMs, raceMs, checkpointsMs).catch((error) => {
            console.warn('RacingGame - best times not saved: ' + error.message);
            return {newLap: false, newRace: false};
        });
    }

    _closeResults() {
        this._results.close();
        this._resultsDisplay.destroy();
        this._results        = null;
        this._resultsDisplay = null;
    }

    _resultsTitle() {
        const course = racingCatalog.getCourse(this._selection.course).name;
        const car    = racingCatalog.getCars().find((entry) => (entry.code === this._selection.car)).name;

        return appTranslator.get('race.results.title', {
            course: ((this._selection.mirror) ? appTranslator.get('course.mirror', {course: course}) : course),
            car:    car
        });
    }

    _closePause() {
        this._pauseModal.close();
        this._pauseDisplay.destroy();
        this._pauseModal   = null;
        this._pauseDisplay = null;
    }

    // From the start grid again, with the same course, car and gearbox.
    _restart() {
        this._teardown();
        this._navigator.startRace(this._selection);
    }

    _pauseTitle() {
        const course = racingCatalog.getCourse(this._selection.course).name;
        const car    = racingCatalog.getCars().find((entry) => (entry.code === this._selection.car)).name;

        return appTranslator.get('race.pause.title', {
            course: ((this._selection.mirror) ? appTranslator.get('course.mirror', {course: course}) : course),
            car:    car
        });
    }

    // Any error of the race stops it and brings the menus back with the error.
    _guard(method, argument) {
        try {
            method.call(this, argument);
        } catch (error) {
            console.error(error);
            this._teardown();
            this._navigator.raceFailed(this._selection, error);
        }
    }

    _animate(timestamp) {
        if (!this._running) {
            return;
        }
        const engine = this._presentation.getEngine();
        engine.calculateDeltaTime(timestamp);
        // Read on paused frames too, to keep the edge state: the pause button closes the menu from its root.
        const pauseDown = this._controls.readButtonPause();
        if (pauseDown && !this._pauseWasDown) {
            this._togglePause();
        }
        this._pauseWasDown = pauseDown;
        // Frozen under the pause; the race goes on under the results.
        if (this._paused) {
            this._presentation.presentFrozen();
            requestAnimationFrame(this._animateCallback);
            return;
        }
        const ticks = (engine.getDeltaTime() / RacingGame.TICK_MS);
        // Collected every frame; the role samples the command when its turn needs it.
        this._commandSampler.collect();
        this._presentation.readViewToggles();
        this._role.advance(ticks, this._commandSampler);
        this._presentation.present(ticks, (this._results !== null));

        requestAnimationFrame(this._animateCallback);
    }
}

RacingGame.ASSETS                        = '/assets/virtual_racing/';
RacingGame.SCENERY_UNITS_PER_METRE       = 32;
RacingGame.SCENERY_UNITS_PER_ENTITY_UNIT = 2;
RacingGame.HEIGHT_UNITS_PER_SCENERY_UNIT = 8;
RacingGame.CAR_UNITS_PER_SCENERY_UNIT    = 32;
RacingGame.ANGLE_UNITS                   = 65536;
RacingGame.TICK_MS                       = 50;
RacingGame.MS_PER_SECOND                 = 1000;
RacingGame.VIRTUAL_WIDTH                 = 1920;
RacingGame.VIRTUAL_HEIGHT                = 1080;
RacingGame.METRES_PER_ENTITY_UNIT        = (RacingGame.SCENERY_UNITS_PER_ENTITY_UNIT / RacingGame.SCENERY_UNITS_PER_METRE);
RacingGame.METRES_PER_HEIGHT_UNIT        = (1 / (RacingGame.HEIGHT_UNITS_PER_SCENERY_UNIT * RacingGame.SCENERY_UNITS_PER_METRE));
RacingGame.LOCAL_PLAYER_ID               = RacingPlayer.MAIN_ID;

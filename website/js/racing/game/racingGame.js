/**
 * The flow of a race every device shares, as DoomGame: the exported data loaded, the race built and shown, its
 * frames, the pause menu over the frozen race (RacingPauseModal: Escape, or the pause button of the gamepad or of the
 * touch controls), the results (RacingResultsModal alone, RacingStandingsModal in a session) over the race that goes on
 * after the finish, the car driving
 * itself, and the best times of this device's own player — driven on the role of the device (RacingMainRole simulates
 * the race), never on which it is. The local player's commands are sampled from the controls (RacingControls,
 * RacingCommandSampler); the one-shot events of the race reach the presentation (RacingPresentation) as they come.
 * A race the device hosts a session for (RacingHostedSession) is built for every slot, renders with WebGL and shows
 * frozen under its start lobby until Start; its pause reaches the session. A race of a session this device follows
 * (RacingFollowedSession) is the main's, built as the main sent it, followed by RacingSubRole. In a session, the pause
 * of any player stops the race for everyone (user decision), and no turn runs before every player's command is in.
 */
class RacingGame {
    /**
     * @param {RacingMenuNavigator} navigator
     * @param {{course: string, mirror: boolean, car: string, gearbox: string}} selection
     * @param {RacingHostedSession|null}   hosted   - the session this device hosts, null for a race alone
     * @param {RacingFollowedSession|null} followed - the session this device follows, null for a race of its own
     */
    constructor(navigator, selection, hosted = null, followed = null) {
        const sub = ((followed !== null) ? followed.getSession() : null);

        this._navigator       = navigator;
        this._selection       = selection;
        this._hosted          = hosted;
        this._followed        = followed;
        this._multiplayer     = ((hosted !== null) || (followed !== null));
        this._roster          = new RacingPlayerRoster()
            .setLocal(new RacingPlayer(((sub !== null) ? sub.getViewedPlayerId() : RacingGame.LOCAL_PLAYER_ID)));
        this._turnEvents      = new RacingTurnEvents();
        this._role            = ((sub !== null) ? new RacingSubRole(this._roster, sub) : new RacingMainRole(this._roster, this._turnEvents));
        this._presentation    = new RacingPresentation(selection);
        this._level           = null;    // {course, mirror, car, gearbox, laps} of the race, as the subs build it
        this._controls        = null;
        this._commandSampler  = null;
        this._results         = null;
        this._resultsDisplay  = null;
        this._running         = false;
        this._paused          = false;
        this._frozen          = false;
        this._held            = false;   // another player's pause holds the race
        this._left            = false;   // left before it was shown
        this._pauseWasDown    = true;
        this._pauseDisplay    = null;
        this._pauseModal      = null;
        this._animateCallback = (timestamp) => this._guard(this._animate, timestamp);
        this._turnEvents.addListener((event) => this._presentation.playTurnEvent(event));
    }

    /**
     * @param {object|null} level - on a sub, the main's race: its levelLoad message ({laps, players, ...})
     */
    async start(level = null) {
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
        // Left during the load (the main sent another race, the session ended): it is never built.
        if (this._left) {
            return;
        }

        const multiplayer = this._multiplayer;
        const laps        = ((level !== null) ? level.laps : ((multiplayer) ? racingSettings.getMultiplayerLaps() : racingSettings.getSoloLaps()));
        const slots       = ((multiplayer) ? Array.from({length: RacingHostedSession.CAPACITY}, (unused, i) => (i + RacingPlayer.MAIN_ID)) : [RacingGame.LOCAL_PLAYER_ID]);
        // A sub holds every player of the main's race, posed by its states.
        for (const player of ((level !== null) ? level.players : [])) {
            if (this._roster.getById(player.id) === null) {
                this._roster.add(new RacingPlayer(player.id));
            }
        }
        this._level = {course: selection.course, mirror: selection.mirror, car: selection.car, gearbox: selection.gearbox, laps: laps};
        loader.reset();
        loader.beginBatch();
        this._presentation.setOutcome(this._role.getOutcome()).setNicknames((id) => this._role.getNickname(id))
            .build({course, cars, palettes, race, physics, roster: this._roster, slots, multiplayer});
        this._role.adoptRace({course, race, physics, multiplayerGrids, selection, multiplayer, laps, lapJingles: racingSound.laps},
            (result) => this._guard(this._finish, result), (lap) => this._saveRecord(lap.lapMs, null, lap.checkpointsMs));
        const noSplits = new Array(RacingRaceControl.CHECKPOINTS).fill(null);
        this._role.enterRace((((best !== null) && (best.lapMs !== null)) ? {lapMs: best.lapMs, checkpointsMs: (best.checkpointsMs ?? noSplits)} : null));

        const skyId = loader.textures().load(sky);
        // Called from the image load: an error there would not reach the promise of start().
        loader.setCallback(() => {
            loader.clearCallback();
            this._guard(this._begin, skyId);
        });
        loader.endBatch();
    }

    // Leaving the race: the main menu, the session stopped on the main; the Multiplayer screen, the session left on a sub.
    quit() {
        if (!this._running) {
            return;
        }
        this._teardown();
        this._role.leave();
        if (this._followed !== null) {
            this._followed.playerLeft();
            return;
        }
        this._navigator.endRace();
    }

    // A sub's race goes: the main sent another, or the session ended. Before it is shown, it never will be.
    leaveRace() {
        if (!this._running) {
            this._left = true;
            return;
        }
        this._teardown();
    }

    getRole() {
        return this._role;
    }

    getPresentation() {
        return this._presentation;
    }

    // Under the start lobby: nothing moves, the pause does not open.
    freeze() {
        this._frozen = true;
        this._controls.setVirtualPadVisible(false);
    }

    unfreeze() {
        this._frozen       = false;
        this._pauseWasDown = true;
        this._presentation.getEngine().resetDeltaClock();
        this._controls.setVirtualPadVisible(true);
    }

    // The session stopped from the pause: the race goes on alone.
    sessionStopped() {
        this._hosted = null;
        this._presentation.setForcedRenderer(null).setPingSource(null);
        this._navigator.sessionStopped();
    }

    // The race scene, its pause menu and its listener go: the menus come back.
    _teardown() {
        this._running = false;
        if (this._hosted !== null) {
            this._hosted.detach();
        }
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
        if (this._left) {
            return;
        }
        if (this._multiplayer) {
            this._presentation.setForcedRenderer(RacingGame.SESSION_RENDERER);
        }
        this._presentation.showRace(skyId, this._roster.getLocal());
        this._controls       = new RacingControls(this._presentation.getDisplay(), (this._selection.gearbox === RacingMenuNavigator.GEARBOX_MANUAL));
        this._commandSampler = new RacingCommandSampler(this._controls);
        this._presentation.bindControls(this._controls);
        this._running        = true;
        // Driven with a gamepad, the screen gets no touch to keep it awake.
        new ScreenWakeLock().init();
        if (this._hosted !== null) {
            this._hosted.attach(this).showStartLobby(() => {
                this._teardown();
                this._navigator.leaveSessionStart(this._selection);
            });
        }
        this._role.levelStarted(this._level);
        requestAnimationFrame(this._animateCallback);
    }

    // --- Pause menu ---

    // From the root of the pause only: the stacked options handle Escape as one step back.
    _togglePause() {
        if (!this._running || (this._results !== null) || this._frozen) {
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
        this._role.setLocalPaused(true);
        this._controls.setVirtualPadVisible(false);
        this._presentation.setSoundPaused(true);
        this._pauseDisplay = new AppMenuDisplay('screen').init(true);
        this._pauseModal   = new RacingPauseModal(this._pauseDisplay)
            .setOnResume(() => this._leavePause())
            .setOnRestart(((this._role.restartsRace()) ? () => this._restart() : null))
            .setOnQuit(() => this.quit())
            .setSessionContext((this._hosted !== null) ? this._hosted.pauseContext() : null)
            .show(() => this._pauseTitle());
    }

    // The settings changed in the pause apply on resume, a renderer change on the next live frame.
    _leavePause() {
        this._closePause();
        this._paused       = false;
        this._pauseWasDown = true;
        this._role.setLocalPaused(false);
        this._presentation.getEngine().resetDeltaClock();
        this._controls.applySettings().setVirtualPadVisible(true);
        this._presentation.setSoundPaused(this._held);
    }

    // Another player's pause holds the race here: its frames freeze, its sounds with them.
    _trackHeld() {
        const held = this._role.isHeld();
        if (held === this._held) {
            return;
        }
        this._held = held;
        if (!this._paused) {
            this._presentation.setSoundPaused(held);
        }
        if (!held) {
            this._presentation.getEngine().resetDeltaClock();
        }
    }

    // --- Finish ---

    // The records of this device, the results over the race that goes on, without the touch controls. A race of
    // several players shows the standings, filled until it is over; a race stopped before the last lap makes no record.
    _finish(result) {
        this._presentation.showResults();
        this._controls.setVirtualPadVisible(false);
        const saved = ((result.classified !== false) ? this._saveRecord(null, result.raceMs, null) : Promise.resolve({newLap: false, newRace: false}));
        // The best lap was saved when it was done: the records shown are those of the race.
        saved.then((records) => {
            if (!this._running) {
                return;
            }
            if (this._multiplayer) {
                this._showStandings();
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

    // The main presses on once the race is over; a sub waits for it.
    _showStandings() {
        this._resultsDisplay = new AppMenuDisplay('screen').init(true);
        this._results = new RacingStandingsModal(this._resultsDisplay);
        if (this._role.restartsRace()) {
            this._results.setActions(() => this._restart(), () => this._toCourses(), () => this.quit());
        }
        this._results.show(this._resultsTitle(), () => this._standings());
    }

    // The standings as the modal shows them, from what every device has: the races, the end of the race, the lobby.
    _standings() {
        const outcome = this._role.getOutcome();
        const onTrack = this._roster.getAll().filter((player) => (player.getRace() !== null));
        const rows    = outcome.standings(onTrack).map((entry, index) => {
            const race     = entry.race;
            const finished = ((race !== null) && race.finished && !race.stopped);
            let status     = RacingStandingsModal.RACING;
            if (race === null) {
                status = RacingStandingsModal.ABANDON;
            } else if (finished) {
                status = RacingStandingsModal.FINISHED;
            } else if (race.stopped) {
                status = RacingStandingsModal.STOPPED;
            }
            return {
                place:     ((race !== null) ? (index + 1) : null),
                nickname:  this._role.getNickname(entry.id),
                color:     RacingCarColors.cssOfSlot(entry.id),
                status:    status,
                raceMs:    ((race !== null) ? RacingRaceControl.raceMs(race) : null),
                bestLapMs: (((race !== null) && (race.lapTimes.length > 0)) ? Math.min(...race.lapTimes) : null),
                laps:      ((race !== null) ? race.lapTimes.length : 0),
                own:       (entry.id === this._roster.getLocal().getId())
            };
        });

        return {rows: rows, over: outcome.over};
    }

    // The subs wait in the lobby while the main picks the next course.
    _toCourses() {
        this._role.announcePhase({type: RacingNetProtocol.LOBBY_RETURN});
        this._teardown();
        this._navigator.endRaceToCourses();
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
            if (this._followed !== null) {
                this._followed.raceFailed(error);
                return;
            }
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
        if (this._hosted !== null) {
            this._hosted.update(timestamp);
        }
        this._trackHeld();
        // Frozen under the pause, the start lobby, another player's pause and a turn waiting for a player; the race
        // goes on under the results.
        if (this._paused || this._frozen || this._held || !this._role.isTurnReady(timestamp)) {
            this._presentation.presentFrozen();
            requestAnimationFrame(this._animateCallback);
            return;
        }
        const ticks = (engine.getDeltaTime() / RacingGame.TICK_MS);
        // Collected every frame; the role samples the command when its turn needs it.
        this._commandSampler.collect();
        this._presentation.readViewToggles();
        this._presentation.present(this._role.advance(ticks, this._commandSampler, timestamp), (this._results !== null));
        if (this._results instanceof RacingStandingsModal) {
            this._results.refresh();
        }

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
// A multiplayer session renders with WebGL, as doom_js.
RacingGame.SESSION_RENDERER              = 'webgl';

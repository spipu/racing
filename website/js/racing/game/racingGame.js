/**
 * A race on a course: loads the exported data, builds the scene in the engine
 * (one instance per scenery cell, the player's car, the sky panorama), drives
 * the car with the physics of the original transposed to the frame time
 * (RacingCarContinuousPhysics) and renders it every display frame through
 * the camera views of the original (RacingCamera). Escape, or the pause button
 * of the gamepad or of the touch controls, opens the pause menu over the frozen
 * race (RacingPauseModal), as doom_js does. The Time Attack race of the
 * original runs around the car (RacingRaceControl: start, laps, times, finish),
 * with the pit crew (RacingPitCrew), the sound effects (racingSound) and the
 * engine note (RacingEngineSound); after the finish, the results
 * (RacingResultsModal) over the race that goes on, the car driving itself.
 *
 * The physics runs on the unmirrored course: a mirrored race flips the scene
 * along x and the steering.
 */
class RacingGame {
    /**
     * @param {RacingMenuNavigator} navigator
     * @param {{course: string, mirror: boolean, car: string, gearbox: string}} selection
     */
    constructor(navigator, selection) {
        this._navigator = navigator;
        this._selection = selection;
        this._screen    = null;
        this._engine    = null;
        this._camera    = null;
        this._car       = null;
        this._objects   = null;
        this._physics   = null;
        this._controls  = null;
        this._crew      = null;
        this._crewVoice = null;
        this._crewDone  = {repaired: 0, finished: 0, releaseIn: null};
        this._race      = null;
        this._engineSound    = null;
        this._hud            = null;
        this._results        = null;
        this._resultsDisplay = null;
        this._instances    = [];
        this._running      = false;
        this._paused       = false;
        this._pauseDisplay = null;
        this._pauseModal   = null;
        this._skyId        = null;
        this._rendererCode = null;
        this._side         = ((selection.mirror) ? -1 : 1);
        this._onFrame      = (timestamp) => this._guard(this._frame, timestamp);
        this._onKey        = (event) => {
            if (event.code === 'Escape') {
                event.preventDefault();
                this._togglePause();
            }
        };
    }

    async start() {
        const base = RacingGame.ASSETS;
        const sky  = (base + 'skies/' + this._selection.course + '.png');
        // The sky is checked here: the texture loader has no error path, a missing image would hang the race.
        const selection = this._selection;
        // The record of this device, none before a first lap (no record of the original: user decision).
        const stored = (racingBestTimes.isReady() ? racingBestTimes.get(selection.course, selection.mirror, selection.car).catch(() => null) : Promise.resolve(null));
        const [course, cars, palettes, race, physics, , best] = await Promise.all([
            appBootstrap.fetchJsonAsync(base + 'courses/' + this._selection.course + '.json'),
            appBootstrap.fetchJsonAsync(base + 'cars.json'),
            appBootstrap.fetchJsonAsync(base + 'palettes.json'),
            appBootstrap.fetchJsonAsync(base + 'race.json'),
            appBootstrap.fetchJsonAsync(base + 'physics.json'),
            appBootstrap.fetchAsync(sky),
            stored,
            racingSound.loadAsync()
        ]);
        const palette   = new RacingPalette(palettes, this._selection.course, this._selection.car);
        const converter = new RacingModelConverter(palette);
        const mirror    = this._selection.mirror;
        const scenery   = (1 / RacingGame.SCENERY_UNITS_PER_METRE);

        loader.reset();
        loader.beginBatch();
        for (const model of Object.values(course.models)) {
            const data     = converter.toObjectData(model, scenery, mirror);
            const objectId = loader.objects().loadFromData(null, data);
            loader.instances().loadFromData(null, RacingCarView.instanceData(objectId));
        }
        const car = cars.cars.find((entry) => (entry.code === this._selection.car));
        if (car === undefined) {
            throw new Error('RacingGame - unknown car ' + this._selection.car);
        }
        const wheels  = new RacingWheelModels(cars, car);
        this._car     = new RacingCarView(converter, cars, car, wheels, (scenery / RacingGame.CAR_UNITS_PER_SCENERY_UNIT), mirror);
        this._objects = new RacingCourseObjects(converter, course, (scenery / RacingGame.CAR_UNITS_PER_SCENERY_UNIT), mirror);
        this._crew    = new RacingPitCrew(RacingGame.ASSETS, converter, wheels, race.pit, car, this._selection.course, (scenery / RacingGame.CAR_UNITS_PER_SCENERY_UNIT), mirror);
        this._physics = this._startPhysics(course, race, physics);
        this._race    = this._startRace(race, best);
        this._camera  = new RacingCamera(physics.cars[this._selection.car].viewTransitions);

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
        if (this._engineSound !== null) {
            this._engineSound.destroy();
            this._engineSound = null;
        }
        racingSound.stopAll();
        new ScreenWakeLock().release();
        document.removeEventListener('keydown', this._onKey);
        if (this._screen !== null) {
            this._screen.destroyContainer();
        }
        loader.reset();
    }

    // On the first place of the race start grid.
    _startPhysics(course, race, physics) {
        const index  = racingCatalog.getCourseIndex(this._selection.course);
        const result = new RacingCarContinuousPhysics(physics, this._selection.car, (this._selection.gearbox === RacingMenuNavigator.GEARBOX_MANUAL), {
            index:     index,
            collision: new RacingCourseCollision(course.collision),
            ...race.courses[this._selection.course],
            pit:       RacingCarPhysics.coursePit(race, this._selection.course),
        });
        const [x, height, z, heading] = race.startGrids[this._selection.car].race[index][RacingGame.START_PLACE];
        result.laps = racingSettings.getSoloLaps();
        // Damage on every course (user decision: the original damages the cars on Acropolis and Highland only, $D19C).
        result.damaging = true;
        // After a wall or a crash the player steers (user decision: the original drives the car back to its line 2 s).
        result.drivenBackOnTrack = false;
        // The crew's own pace sets the stop, its last mechanic the repair (user decision: the original works 120 ticks).
        result.pitWorkByCrew = true;

        return result.place(x, height, z, heading);
    }

    // The race of the original around the car, against the record of this device (null before any lap).
    _startRace(race, best) {
        const course = race.courses[this._selection.course];
        const record = (((best !== null) && (best.lapMs !== null)) ? {lapMs: best.lapMs, checkpointsMs: (best.checkpointsMs ?? [null, null])} : null);

        return new RacingRaceControl(this._physics, course, record, RacingGame.PIT_START_COURSES.includes(this._selection.course), racingSound.laps,
            race.checkpointJingles)
            .setOnSound((command) => racingSound.send(command))
            .setCrewSoundsByClips(true)
            .setOnRecord((lap) => this._saveRecord(lap.lapMs, null, lap.checkpointsMs))
            .setOnFinish((result) => this._guard(this._finish, result));
    }

    _begin(skyId) {
        this._skyId = skyId;
        this._buildDisplay();
        this._car.bind();
        this._objects.bind();
        this._crew.bind()
            .setOnWheel((wheel, off) => this._car.setWheelOff(wheel, off))
            .setOnWrench((mechanic) => {
                this._crewVoice ??= (RacingGame.CREW_VOICE + mechanic);
            })
            .setOnRepaired(() => this._crewRepaired())
            .setOnFinished(() => this._crewFinished());
        if ((racingSound.getEngine() !== null) && racingSound.hasEngineVoice()) {
            this._engineSound = new RacingEngineSound(racingSound.getEngine(), this._selection.car);
        }
        this._controls  = new RacingControls(this._screen.getDisplay(), (this._selection.gearbox === RacingMenuNavigator.GEARBOX_MANUAL));
        const parts     = new Set([...this._car.getAllInstances(), ...this._objects.getAllInstances(), ...this._crew.getAllInstances()]);
        this._instances = loader.instances().getAll().filter((instance) => ((instance !== undefined) && !parts.has(instance)));
        this._placeCar(0);
        this._running   = true;
        // Driven with a gamepad, the screen gets no touch to keep it awake.
        new ScreenWakeLock().init();
        document.addEventListener('keydown', this._onKey);
        requestAnimationFrame(this._onFrame);
    }

    // The screen, the engine and the HUD; built again when the renderer changes in the pause options.
    _buildDisplay() {
        this._rendererCode = racingSettings.getRenderer();
        this._screen       = new ScreenManager('screen', {fullscreen: true, virtualWidth: RacingGame.VIRTUAL_WIDTH, virtualHeight: RacingGame.VIRTUAL_HEIGHT});
        this._engine       = new Engine3d(this._screen, new Object3dRendererList().getRenderer(this._rendererCode));
        this._engine.setFov(this._horizontalFov())
            .setZBuffer(RacingGame.NEAR, RacingGame.FAR)
            .setBackground(...racingCatalog.getCourse(this._selection.course).skyColor)
            .setLightAmbient(RacingGame.AMBIENT)
            .setSky(this._sky(this._skyId));
        const course = racingCatalog.getCourse(this._selection.course).name;
        this._hud = new RacingHud(this._engine).bindRace(this._race, this._physics, {
            car:    this._selection.car,
            course: ((this._selection.mirror) ? appTranslator.get('course.mirror', {course: course}) : course),
            manual: (this._selection.gearbox === RacingMenuNavigator.GEARBOX_MANUAL)
        });
        this._screen.bindHud(this._hud);
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

    // The race stops under the menu: physics, controls, touch controls.
    _enterPause() {
        this._paused = true;
        this._controls.setVirtualPadVisible(false);
        this._setSoundRunning(false);
        this._pauseDisplay = new AppMenuDisplay('screen').init(true);
        this._pauseModal   = new RacingPauseModal(this._pauseDisplay)
            .setOnResume(() => this._leavePause())
            .setOnRestart(() => this._restart())
            .setOnQuit(() => this.quit())
            .show(() => this._pauseTitle());
    }

    // The settings changed in the pause apply on resume, a renderer change rebuilding the screen.
    _leavePause() {
        this._closePause();
        this._paused = false;
        if (racingSettings.getRenderer() !== this._rendererCode) {
            this._screen.destroyContainer();
            this._buildDisplay();
            this._controls.bindDisplay(this._screen.getDisplay());
        }
        this._engine.resetDeltaClock();
        this._controls.applySettings().setVirtualPadVisible(true);
        this._setSoundRunning(true);
    }

    // The pause silences every voice ($8507), the engine with them.
    _setSoundRunning(running) {
        racingSound.setPaused(!running);
        if (this._engineSound !== null) {
            this._engineSound.setRunning(running);
        }
    }

    // --- Finish ---

    // The records of this device, the results over the race that goes on (user decision: the original closes the
    // blinds and stops every voice, $F3): their music over the engine, lowered; no HUD, no touch controls.
    _finish(result) {
        if (this._engineSound !== null) {
            this._engineSound.setLevelShare(RacingGame.RESULTS_ENGINE_SHARE);
        }
        racingSound.stopAll().send(RacingGame.JINGLE_RESULTS);
        this._controls.setVirtualPadVisible(false);
        this._hud.setVisible(false);
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

    // The panorama wraps once around the horizon, as wide in angle as high: its horizon row sits at elevation 0.
    _sky(skyId) {
        const sky       = racingCatalog.getSky();
        const perRadian = (sky.width / (2 * Math.PI));

        return {
            loaderId:    skyId,
            wrap:        1,
            top:         (sky.horizonRow / perRadian),
            bottom:      (-(sky.height - sky.horizonRow) / perRadian),
            mirrorBelow: false,
            followRoll:  true
        };
    }

    _frame(timestamp) {
        if (!this._running) {
            return;
        }
        this._engine.calculateDeltaTime(timestamp);
        // Read on paused frames too: the pause button closes the menu from its root, and keeps its press edge.
        const input = this._controls.read();
        if (input.quit) {
            this._togglePause();
        }
        // Frozen under the pause; the race goes on under the results.
        const frozen = this._paused;
        const ticks  = ((frozen) ? 0 : (this._engine.getDeltaTime() / RacingGame.TICK_MS));
        if (!frozen) {
            this._simulate(input, ticks);
            this._race.update(ticks);
            this._sounds(ticks);
        }
        this._updateCrew(ticks);
        this._placeCar(ticks);
        this._startCrew();
        this._objects.animate(ticks);

        const engine = this._engine;
        engine.setCamera(this._camera);
        engine.lightsCalculatePosition();
        engine.drawInit();
        this._draw(this._instances);
        this._draw(this._objects.getInstances());
        this._draw(this._crew.getInstances());
        // The original has no depth buffer and paints the cockpit last: it stays over the road it dips into. In its own
        // depth layer, the cockpit gets a near plane close enough for the roof right above the eye.
        const cockpit = this._camera.isCockpitShown();
        if (cockpit) {
            engine.clearDepth().setZBuffer(RacingGame.COCKPIT_NEAR, RacingGame.COCKPIT_FAR);
        }
        this._draw(this._car.getInstances());
        if (cockpit) {
            engine.setZBuffer(RacingGame.NEAR, RacingGame.FAR);
        }
        engine.drawFinish();
        this._screen.update();

        requestAnimationFrame(this._onFrame);
    }

    // The crew stands at the box while the original shows it ($C026 not -1), its wheels and bursts as its clips go:
    // the bursts of one frame make one sound (the mechanics in step would add up). Away, it is back to its first pose.
    _updateCrew(ticks) {
        const shown = (this._physics.pitCrewFrame >= 0);
        if (!shown && this._crew.isStarted()) {
            this._crew.reset();
        }
        this._crewVoice = null;
        this._crew.show(shown).update(ticks);
        if (this._crewVoice !== null) {
            racingSound.send(RacingRaceControl.SOUND_WRENCH, this._crewVoice);
        }
        const done = this._crewDone;
        if (done.releaseIn !== null) {
            done.releaseIn -= ticks;
            if (done.releaseIn <= 0) {
                done.releaseIn = null;
                this._physics.releaseFromPit();
            }
        }
    }

    // The car repaired once the last mechanic reaches the repair (the original's frame 20, $AB88).
    _crewRepaired() {
        this._crewDone.repaired++;
        if ((this._crewDone.repaired === RacingPitCrew.CLIPS.length) && (this._physics.damage !== 0)) {
            this._physics.setDamage(0);
        }
    }

    // The car leaves 4 ticks after the last mechanic is done, as the original after its last frame (tick 116 of 120).
    _crewFinished() {
        this._crewDone.finished++;
        if (this._crewDone.finished === RacingPitCrew.CLIPS.length) {
            this._crewDone.releaseIn = ((RacingPitCrewSchedule.RELEASE_DELAY * RacingGame.MS_PER_SECOND) / RacingGame.TICK_MS);
        }
    }

    // The crew starts with the pit start sequence, all at once as the original, or the work of a stop, each mechanic
    // as drawn; on the car's wheels as just placed.
    _startCrew() {
        const physics = this._physics;
        if (!this._crew.isStarted() && (physics.pitCrewFrame >= 0) && (this._race.crewRunning || (physics.pitState === RacingCarPhysics.PIT_WORK))) {
            const schedule = ((this._race.crewRunning) ? RacingPitCrewSchedule.start() : RacingPitCrewSchedule.draw(Math.random));
            this._crewDone = {repaired: 0, finished: 0, releaseIn: null};
            this._crew.start(schedule, RacingGame.WHEELS.map((wheel) => this._car.hubMatrix(wheel, Mat4.create())));
        }
    }

    // The commands of the tick, the engine note.
    _sounds(ticks) {
        const physics = this._physics;
        for (const command of physics.sounds) {
            racingSound.send(command);
        }
        physics.sounds.length = 0;
        if (this._engineSound !== null) {
            this._engineSound.update(ticks, physics.rpm, ((physics.roadFlags & RacingGame.ROAD_TUNNEL) !== 0));
        }
    }

    _draw(instances) {
        for (const instance of instances) {
            if (this._engine.isInView(instance)) {
                this._engine.drawInstance(instance);
            }
        }
    }

    _simulate(input, ticks) {
        // After the line, the original holds the close chase view ($6B04: $C048 = 1).
        if (this._race.finished) {
            this._camera.setView(RacingGame.FINISH_VIEW);
        } else if (input.view) {
            this._camera.cycleView();
        }
        if (this._selection.mirror) {
            input.steer = -input.steer;
            if (input.steerAxis !== null) {
                input.steerAxis = -input.steerAxis;
            }
        }
        this._physics.step(input, ticks);
    }

    // The vertical field of the original, widened to the screen.
    _horizontalFov() {
        const vertical = ((RacingCamera.VERTICAL_HALF_FOV_DEGREES * Math.PI) / 180);

        return ((Math.atan((RacingGame.VIRTUAL_WIDTH / RacingGame.VIRTUAL_HEIGHT) * Math.tan(vertical)) * 180) / Math.PI);
    }

    // Entity units: x / z in collision units (2 scenery units), height in 1/8 scenery unit; the original moves
    // along (sin(-h), cos(-h)), the engine's yaw along (sin(yaw), cos(yaw)).
    // The height, smoothed by half a tick, lags up to a metre under a steep climb at full speed: the original paints the
    // car over the road, the depth buffer would hide it, so it is drawn on the road (user decision).
    _placeCar(ticks) {
        const physics  = this._physics;
        const side     = this._side;
        const position = [
            (physics.x * RacingGame.METRES_PER_ENTITY_UNIT * side),
            (Math.max(physics.height, physics.roadHeight()) * RacingGame.METRES_PER_HEIGHT_UNIT),
            (physics.z * RacingGame.METRES_PER_ENTITY_UNIT)
        ];
        // $2984 turns the camera and the body by the heading plus the shown slip (+$3C + +$96), not by +$40, which a
        // wall deflection swings round.
        const yaw     = (-RacingGame._degrees(physics.heading + physics.shownSlip) * side);
        const pitch   = RacingGame._degrees(physics.pitch);
        const roll    = (RacingGame._degrees(physics.roll) * side);
        const cockpit = this._camera.isCockpitShown();
        const pose    = this._bodyPose(physics, side, cockpit);
        this._car.setCockpit(cockpit)
            .setDamage(physics.damage)
            .setEffects(physics.effectFrames, (physics.crashRecovery === 0), physics.smokeX)
            .animate(ticks, physics.displaySpeed, physics.steer, physics.yawRate)
            .place(position, yaw, pitch, roll, pose);
        this._camera.follow(ticks, position, yaw, pitch, roll, ((cockpit) ? pose : null));
    }

    // $2984 / $70AA: a crash lifts the body by +$9C x 16 / 256 m and tumbles it (+$44 pitch); the slip and the shock
    // yaw it (+$46), the turn and the crash roll it ((+$4A + +$4C) / 4); 1/65536 turn. The cockpit shell ($2ADE) is
    // lifted and yawed the same, the eye with it (RacingCamera.follow), not tumbled, and only the turn rolls it: +$4C / 2.
    _bodyPose(physics, side, cockpit) {
        return {
            lift:  (physics.crashPose[0] / RacingGame.LIFT_UNITS_PER_METRE),
            yaw:   (RacingGame._degrees(physics.bodyYaw) * side),
            pitch: ((cockpit) ? 0 : RacingGame._degrees(physics.bodyPitch)),
            roll:  (-RacingGame._degrees((cockpit) ? (physics.slipInput / 2) : ((physics.bodyRoll + physics.slipInput) / 4)) * side)
        };
    }

    // An angle of the original, in 1/65536 turn.
    static _degrees(value) {
        return ((value * 360) / RacingGame.ANGLE_UNITS);
    }
}

RacingGame.ASSETS                         = '/assets/virtual_racing/';
RacingGame.SCENERY_UNITS_PER_METRE        = 32;
RacingGame.SCENERY_UNITS_PER_ENTITY_UNIT  = 2;
RacingGame.HEIGHT_UNITS_PER_SCENERY_UNIT  = 8;
RacingGame.CAR_UNITS_PER_SCENERY_UNIT     = 32;
RacingGame.ANGLE_UNITS                    = 65536;
RacingGame.TICK_MS                        = 50;
RacingGame.MS_PER_SECOND                  = 1000;
RacingGame.VIRTUAL_WIDTH                  = 1920;
RacingGame.VIRTUAL_HEIGHT                 = 1080;
RacingGame.NEAR                           = 0.5;
RacingGame.FAR                            = 2000;
RacingGame.COCKPIT_NEAR                   = 0.01;
RacingGame.COCKPIT_FAR                    = 10;
RacingGame.AMBIENT                        = [255, 255, 255];
RacingGame.LIFT_UNITS_PER_METRE           = 16;
RacingGame.METRES_PER_ENTITY_UNIT         = (RacingGame.SCENERY_UNITS_PER_ENTITY_UNIT / RacingGame.SCENERY_UNITS_PER_METRE);
RacingGame.METRES_PER_HEIGHT_UNIT         = (1 / (RacingGame.HEIGHT_UNITS_PER_SCENERY_UNIT * RacingGame.SCENERY_UNITS_PER_METRE));
// The player starts on the first place of the grid.
RacingGame.START_PLACE                    = 0;
// The car's wheels (RacingCarView.setWheelOff), and the sound channel of a mechanic's wheel gun ('crew0').
RacingGame.WHEELS                         = [0, 1, 2, 3];
RacingGame.CREW_VOICE                     = 'crew';
// Big Forest starts in the pit box, with the mechanics ($6AB4).
RacingGame.PIT_START_COURSES              = ['big_forest'];
RacingGame.JINGLE_RESULTS                 = '8E';
RacingGame.RESULTS_ENGINE_SHARE           = 0.5;
RacingGame.FINISH_VIEW                    = 1;
// Road flag bit 4 under the car: a tunnel, the engine echoes.
RacingGame.ROAD_TUNNEL                    = 0x10;

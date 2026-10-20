/**
 * What a device shows and plays of the race, through the car of one player: the scene in the engine (one instance
 * per scenery cell, the car, the course's moving objects, the pit crew, the sky panorama), the camera views of the
 * original (RacingCamera), the HUD and its map, the sound effects (racingSound) and the engine note
 * (RacingEngineSound). As DoomPresentation, it never knows the simulation: it reads only the state every device has,
 * the car's (RacingCarState) and its race's display, and plays the one-shot events as they are emitted.
 *
 * A mirrored race flips the scene along x.
 */
class RacingPresentation {
    /**
     * @param {{course: string, mirror: boolean, car: string, gearbox: string}} selection
     */
    constructor(selection) {
        this._selection    = selection;
        this._side         = ((selection.mirror) ? -1 : 1);
        this._screen       = null;
        this._engine       = null;
        this._camera       = null;
        this._car          = null;
        this._objects      = null;
        this._crew         = null;
        this._crewVoice    = null;
        this._crewSchedule = null;      // of a passage started this step, until the car is placed
        this._engineSound  = null;
        this._hud          = null;
        this._hudMap       = null;
        this._instances    = [];
        this._skyId        = null;
        this._rendererCode = null;
        this._eyeLean      = 0;
        this._player       = null;
        this._controls     = null;
        this._viewWasDown  = true;      // a view button held as the race starts does not switch the view
    }

    /**
     * @param {RacingControls} controls - the view button read here, the touch controls laid on the display
     */
    bindControls(controls) {
        this._controls = controls;

        return this;
    }

    /**
     * Inside the loader batch: the scenery, the car, the course's objects, the crew, the camera and the map.
     *
     * @param {object} data - {course, cars, palettes, race, physics}: the exports of the course and of the game
     */
    build(data) {
        const selection = this._selection;
        const converter = new RacingModelConverter(new RacingPalette(data.palettes, selection.course, selection.car));
        const mirror    = selection.mirror;
        const scenery   = (1 / RacingGame.SCENERY_UNITS_PER_METRE);
        const carScale  = (scenery / RacingGame.CAR_UNITS_PER_SCENERY_UNIT);
        for (const model of Object.values(data.course.models)) {
            const objectId = loader.objects().loadFromData(null, converter.toObjectData(model, scenery, mirror));
            loader.instances().loadFromData(null, RacingCarView.instanceData(objectId));
        }
        const car = data.cars.cars.find((entry) => (entry.code === selection.car));
        if (car === undefined) {
            throw new Error('RacingPresentation - unknown car ' + selection.car);
        }
        const wheels  = new RacingWheelModels(data.cars, car);
        this._car     = new RacingCarView(converter, data.cars, car, wheels, carScale, mirror);
        this._objects = new RacingCourseObjects(converter, data.course, carScale, mirror);
        this._crew    = new RacingPitCrew(RacingGame.ASSETS, converter, wheels, data.race.pit, car, selection.course, carScale, mirror);
        this._camera  = new RacingCamera(data.physics.cars[selection.car].viewTransitions, racingSettings.getStartView());
        this._hudMap  = new RacingHudMap(data.course.map, data.race.courses[selection.course].racePath, data.course.collision.toScenery, mirror);
    }

    /**
     * The scene loaded: the screen and the engine, the parts bound, shown through the player's car.
     *
     * @param {int}          skyId
     * @param {RacingPlayer} player
     */
    showRace(skyId, player) {
        this._skyId  = skyId;
        this._player = player;
        this._buildDisplay();
        this._car.bind();
        this._objects.bind();
        this._crew.bind()
            .setOnWheel((wheel, off) => this._car.setWheelOff(wheel, off))
            .setOnWrench((mechanic) => {
                this._crewVoice ??= (RacingPresentation.CREW_VOICE + mechanic);
            });
        if ((racingSound.getEngine() !== null) && racingSound.hasEngineVoice()) {
            this._engineSound = new RacingEngineSound(racingSound.getEngine(), this._selection.car);
        }
        const parts     = new Set([...this._car.getAllInstances(), ...this._objects.getAllInstances(), ...this._crew.getAllInstances()]);
        this._instances = loader.instances().getAll().filter((instance) => ((instance !== undefined) && !parts.has(instance)));
        this._placeCar(0);
    }

    getEngine() {
        return this._engine;
    }

    /**
     * @returns {HTMLElement} the display the touch controls are laid on
     */
    getDisplay() {
        return this._screen.getDisplay();
    }

    /**
     * The screen, the engine and the HUD built again when the renderer setting changed (in the pause options), since a
     * canvas keeps one context type for its whole life: applied on the first live frame no menu covers.
     *
     * @param {boolean} menuOpen - a menu still covers the screen
     */
    applyRendererSetting(menuOpen) {
        if ((racingSettings.getRenderer() === this._rendererCode) || menuOpen) {
            return;
        }
        this._screen.destroyContainer();
        this._buildDisplay();
        this._controls.bindDisplay(this._screen.getDisplay());
    }

    /**
     * The pause silences every voice ($8507), the engine with them.
     *
     * @param {boolean} paused
     */
    setSoundPaused(paused) {
        racingSound.setPaused(paused);
        if (this._engineSound !== null) {
            this._engineSound.setRunning(!paused);
        }
    }

    /**
     * The results over the race that goes on (user decision: the original closes the blinds and stops every voice, $F3):
     * their music over the engine, lowered, no HUD.
     */
    showResults() {
        if (this._engineSound !== null) {
            this._engineSound.setLevelShare(RacingPresentation.RESULTS_ENGINE_SHARE);
        }
        racingSound.stopAll().send(RacingPresentation.JINGLE_RESULTS);
        this._hud.setVisible(false);
    }

    // The voices stop, the screen goes.
    teardown() {
        if (this._engineSound !== null) {
            this._engineSound.destroy();
            this._engineSound = null;
        }
        racingSound.stopAll();
        if (this._screen !== null) {
            this._screen.destroyContainer();
        }
    }

    // Before the step of a live frame, as the original reads the view button before its tick.
    readViewToggles() {
        const viewDown = this._controls.readButtonView();
        // After the line, the original holds the close chase view ($6B04: $C048 = 1).
        if (this._player.getRace().finished) {
            this._camera.setView(RacingPresentation.FINISH_VIEW);
        } else if (viewDown && !this._viewWasDown) {
            this._camera.cycleView();
        }
        this._viewWasDown = viewDown;
    }

    /**
     * A live frame, after the step: the engine note, the crew, the car placed, the scene drawn.
     *
     * @param {number}  ticks    - time elapsed, in original ticks
     * @param {boolean} menuOpen - a menu covers the screen (the results run over live frames)
     */
    present(ticks, menuOpen) {
        // Before every push onto the engine, which a swap replaces.
        this.applyRendererSetting(menuOpen);
        const state = this._player.getCarState();
        if (this._engineSound !== null) {
            this._engineSound.update(ticks, state.rpm, ((state.roadFlags & RacingPresentation.ROAD_TUNNEL) !== 0));
        }
        this._updateCrew(state, ticks);
        this._placeCar(ticks);
        this._startCrew();
        this._objects.animate(ticks);
        this._draw();
    }

    // Frozen frame (pause): redrawn since a resize wipes the canvas, nothing moves.
    presentFrozen() {
        this._draw();
    }

    /**
     * Played as the simulation emits them: the sounds of the viewed car at once, in the step's order; a crew's start
     * once the car is placed.
     *
     * @param {object} event - see RacingTurnEvents
     */
    playTurnEvent(event) {
        if (event.playerId !== this._player.getId()) {
            return;
        }
        if (event.type === RacingTurnEvents.SOUND) {
            racingSound.send(event.command);
        } else if (event.type === RacingTurnEvents.CREW_STARTED) {
            this._crewSchedule = event.schedule;
        }
    }

    // The screen, the engine and the HUD.
    _buildDisplay() {
        const selection    = this._selection;
        this._rendererCode = racingSettings.getRenderer();
        this._screen       = new ScreenManager('screen', {fullscreen: true, virtualWidth: RacingGame.VIRTUAL_WIDTH, virtualHeight: RacingGame.VIRTUAL_HEIGHT});
        this._engine       = new Engine3d(this._screen, new Object3dRendererList().getRenderer(this._rendererCode));
        this._engine.setFov(this._horizontalFov())
            .setZBuffer(RacingPresentation.NEAR, RacingPresentation.FAR)
            .setBackground(...racingCatalog.getCourse(selection.course).skyColor)
            .setLightAmbient(RacingPresentation.AMBIENT)
            .setSky(this._sky(this._skyId));
        const course = racingCatalog.getCourse(selection.course).name;
        this._hud = new RacingHud(this._engine).bindRace(this._player.getRace(), this._player.getCarState(), {
            car:    selection.car,
            course: ((selection.mirror) ? appTranslator.get('course.mirror', {course: course}) : course),
            manual: (selection.gearbox === RacingMenuNavigator.GEARBOX_MANUAL),
            map:    this._hudMap
        });
        this._screen.bindHud(this._hud);
    }

    _draw() {
        const engine = this._engine;
        engine.setCamera(this._camera);
        engine.lightsCalculatePosition();
        engine.drawInit();
        this._drawInstances(this._instances);
        this._drawInstances(this._objects.getInstances());
        this._drawInstances(this._crew.getInstances());
        // The original has no depth buffer and paints the cockpit last: it stays over the road it dips into. In its own
        // depth layer, the cockpit gets a near plane close enough for the roof right above the eye.
        const cockpit = this._camera.isCockpitShown();
        if (cockpit) {
            engine.clearDepth().setZBuffer(RacingPresentation.COCKPIT_NEAR, RacingPresentation.COCKPIT_FAR);
        }
        this._drawInstances(this._car.getInstances());
        if (cockpit) {
            engine.setZBuffer(RacingPresentation.NEAR, RacingPresentation.FAR);
        }
        engine.drawFinish();
        this._screen.update();
    }

    _drawInstances(instances) {
        for (const instance of instances) {
            if (this._engine.isInView(instance)) {
                this._engine.drawInstance(instance);
            }
        }
    }

    // The crew stands at the box while the original shows it ($C026 not -1), its wheels and bursts as its clips go:
    // the bursts of one frame make one sound (the mechanics in step would add up). Away, it is back to its first pose.
    _updateCrew(state, ticks) {
        const shown = (state.pitCrewFrame >= 0);
        if (!shown && this._crew.isStarted()) {
            this._crew.reset();
        }
        this._crewVoice = null;
        this._crew.show(shown).update(ticks);
        if (this._crewVoice !== null) {
            racingSound.send(RacingRaceControl.SOUND_WRENCH, this._crewVoice);
        }
    }

    // A passage of the crew starts its mechanics as the simulation scheduled them, on the car's wheels as just placed.
    _startCrew() {
        if (this._crewSchedule === null) {
            return;
        }
        this._crew.start(this._crewSchedule, RacingPresentation.WHEELS.map((wheel) => this._car.hubMatrix(wheel, Mat4.create())));
        this._crewSchedule = null;
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
        const state    = this._player.getCarState();
        const side     = this._side;
        const position = [
            (state.x * RacingGame.METRES_PER_ENTITY_UNIT * side),
            (state.height * RacingGame.METRES_PER_HEIGHT_UNIT),
            (state.z * RacingGame.METRES_PER_ENTITY_UNIT)
        ];
        // $2984 turns the camera and the body by the heading plus the shown slip (+$3C + +$96), not by +$40, which a
        // wall deflection swings round.
        const yaw   = (-RacingPresentation._degrees(state.heading + state.shownSlip) * side);
        const pitch = RacingPresentation._degrees(state.pitch);
        const roll  = (RacingPresentation._degrees(state.roll) * side);
        const pose  = this._bodyPose(state, side);
        this._car.setCockpit(this._camera.isCockpitShown())
            .setDamage(state.damage)
            .setEffects(state.effectFrames, (state.crashRecovery === 0), state.smokeX)
            .animate(ticks, state.displaySpeed, state.steer, state.yawRate)
            .place(position, yaw, pitch, roll, pose);
        this._camera.follow(ticks, position, yaw, pitch, roll, pose, this._cockpitLean(ticks, state, side));
    }

    // Not in the original (user decision): the cockpit eye leans into the turn like on a motorbike, by the steering
    // (+$8E) and the speed above 100 km/h; +$8E drops to 0 on release, so the lean then comes back at a bounded rate.
    _cockpitLean(ticks, state, side) {
        const top    = ((state.maxSpeed * RacingCarPhysics.DISPLAY_FACTOR) >> 8);
        const share  = Math.max(0, Math.min(1, ((state.displaySpeed - RacingPresentation.COCKPIT_LEAN_FROM_KMH) / (top - RacingPresentation.COCKPIT_LEAN_FROM_KMH))));
        const steer  = Math.max(-1, Math.min(1, (state.steer / RacingPresentation.COCKPIT_LEAN_FULL_STEER)));
        const target = (-steer * share * RacingPresentation.COCKPIT_LEAN_DEGREES * side);
        const lean   = this._eyeLean;
        if (((lean === 0) || (Math.sign(target) === Math.sign(lean))) && (Math.abs(target) >= Math.abs(lean))) {
            this._eyeLean = target;

            return target;
        }
        const step = ((RacingPresentation.COCKPIT_LEAN_DEGREES / RacingPresentation.COCKPIT_LEAN_RETURN_SECONDS) * ((ticks * RacingGame.TICK_MS) / RacingGame.MS_PER_SECOND));
        this._eyeLean = (lean + Math.max(-step, Math.min(step, (target - lean))));

        return this._eyeLean;
    }

    // $2984 / $70AA: a crash lifts the body by +$9C x 16 / 256 m and tumbles it (+$44 pitch); the slip and the shock
    // yaw it (+$46), the turn and the crash roll it ((+$4A + +$4C) / 4); 1/65536 turn.
    _bodyPose(state, side) {
        return {
            lift:  (state.crashLift / RacingPresentation.LIFT_UNITS_PER_METRE),
            yaw:   (RacingPresentation._degrees(state.bodyYaw) * side),
            pitch: RacingPresentation._degrees(state.bodyPitch),
            roll:  (-RacingPresentation._degrees((state.bodyRoll + state.slipInput) / 4) * side)
        };
    }

    // An angle of the original, in 1/65536 turn.
    static _degrees(value) {
        return ((value * 360) / RacingGame.ANGLE_UNITS);
    }
}

RacingPresentation.NEAR                        = 0.5;
RacingPresentation.FAR                         = 2000;
RacingPresentation.COCKPIT_NEAR                = 0.01;
RacingPresentation.COCKPIT_FAR                 = 10;
RacingPresentation.COCKPIT_LEAN_DEGREES        = 8;
RacingPresentation.COCKPIT_LEAN_RETURN_SECONDS = 0.25;
RacingPresentation.COCKPIT_LEAN_FROM_KMH       = 100;
RacingPresentation.COCKPIT_LEAN_FULL_STEER     = (RacingCarPhysics.STEER_SPEED_MAX << 8);
RacingPresentation.AMBIENT                     = [255, 255, 255];
RacingPresentation.LIFT_UNITS_PER_METRE        = 16;
// The car's wheels (RacingCarView.setWheelOff), and the sound channel of a mechanic's wheel gun ('crew0').
RacingPresentation.WHEELS                      = [0, 1, 2, 3];
RacingPresentation.CREW_VOICE                  = 'crew';
RacingPresentation.JINGLE_RESULTS              = '8E';
RacingPresentation.RESULTS_ENGINE_SHARE        = 0.5;
RacingPresentation.FINISH_VIEW                 = 1;
// Road flag bit 4 under the car: a tunnel, the engine echoes.
RacingPresentation.ROAD_TUNNEL                 = 0x10;

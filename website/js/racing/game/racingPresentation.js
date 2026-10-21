/**
 * What a device shows and plays of the race, through the car of one player: the scene in the engine (one instance
 * per scenery cell, the players' cars, the course's moving objects, the pit crew, the sky panorama), the camera views
 * of the original (RacingCamera), the HUD and its map, the sound effects (racingSound) and the engine note
 * (RacingEngineSound) of the viewed car. As DoomPresentation, it never knows the simulation: it reads only the state
 * every device has, the cars' (RacingCarState) and the viewed race's display, and plays the one-shot events as they
 * are emitted.
 *
 * In a race of several players, each car wears the colour of its player's slot (RacingCarColors); the other players'
 * cars are seen from outside, their nicknames over them (RacingCarTags), their engines and noises heard from where they
 * are (RacingCarSounds). Each pit box has its crew (RacingPitBoxes: a second box in a race of several players),
 * which works on the car whose stop at that box started last. A mirrored race flips the scene along x.
 */
class RacingPresentation {
    /**
     * @param {{course: string, mirror: boolean, car: string, gearbox: string}} selection
     */
    constructor(selection) {
        this._selection      = selection;
        this._side           = ((selection.mirror) ? -1 : 1);
        this._screen         = null;
        this._engine         = null;
        this._camera         = null;
        this._car            = null;       // the viewed player's car
        this._cars           = new Map();  // player id → RacingCarView, the viewed one included
        this._roster         = null;
        this._objects        = null;
        // By pit box: its index, its crew, the player whose car it works on, the schedule of a passage started this step
        // (until the car is placed), the voice of its gun's burst this frame.
        this._crews          = [];
        this._engineSound    = null;
        this._hud            = null;
        this._hudMap         = null;
        this._instances      = [];
        this._skyId          = null;
        this._rendererCode   = null;
        this._forcedRenderer = null;       // renderer imposed over the setting, null = the setting's
        this._eyeLean        = 0;
        this._player         = null;
        this._controls       = null;
        this._viewWasDown    = true;       // a view button held as the race starts does not switch the view
        this._pingSource     = null;       // () => round trip in ms or null, during a session
        this._outcome        = null;       // RacingRaceOutcome: the time left after the first finish
        this._multiplayer    = false;
        this._nicknameOf     = () => '';
        this._tags           = null;       // RacingCarTags, in a race of several players
        this._carSounds      = null;       // RacingCarSounds, in a race of several players with the engine voice
        this._positions      = new Map();  // player id → where its car is drawn, metres
        this._others         = [];         // the other cars in camera space, rebuilt only when a player comes or goes
        this._othersOf       = null;       // the roster's list they were built from
        this._noticeText     = null;       // message of the session over the race, null = none
        this._noticeEl       = null;
    }

    /**
     * @param {RacingControls} controls - the view button read here, the touch controls laid on the display
     */
    bindControls(controls) {
        this._controls = controls;

        return this;
    }

    /**
     * Inside the loader batch: the scenery, the players' cars, the course's objects, the crew, the camera and the map.
     *
     * @param {object}             data             - the exports of the course and of the game, and the race's players
     * @param {object}             data.course
     * @param {object}             data.cars
     * @param {object}             data.palettes
     * @param {object}             data.race
     * @param {object}             data.physics
     * @param {RacingPlayerRoster} data.roster      - the players of the race, the local one viewed with its cockpit
     * @param {int[]}              data.slots       - the slots a car is built for: every slot of a session (a sub may
     *                                                enter its lobby once the race is built, as doom builds the body of
     *                                                every slot), the local player's alone
     * @param {boolean}            data.multiplayer - the cars wear the colours of their slots
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
        this._multiplayer = data.multiplayer;
        const wheels  = new RacingWheelModels(data.cars, car);
        const viewed  = data.roster.getLocal();
        this._roster  = data.roster;
        this._tags    = ((data.multiplayer) ? new RacingCarTags((id) => this._nicknameOf(id)) : null);
        for (const slot of data.slots) {
            const palette = new RacingPalette(data.palettes, selection.course, selection.car);
            if (data.multiplayer) {
                palette.paintLivery(RacingCarColors.liveryOf(selection.car), RacingCarColors.ofSlot(slot));
            }
            this._cars.set(slot, new RacingCarView(new RacingModelConverter(palette), data.cars, car, wheels, carScale, mirror, (slot === viewed.getId())));
        }
        this._car     = this._cars.get(viewed.getId());
        this._objects = new RacingCourseObjects(converter, data.course, carScale, mirror);
        const boxes   = RacingPitBoxes.of(data.race, selection.course, new RacingCourseCollision(data.course.collision), data.multiplayer);
        this._crews   = boxes.map((box, index) => ({
            index:    index,
            crew:     new RacingPitCrew(RacingGame.ASSETS, converter, wheels, data.race.pit, car, box.base, carScale, mirror),
            player:   viewed,
            schedule: null,
            voice:    null,
        }));
        this._camera  = new RacingCamera(data.physics.cars[selection.car].viewTransitions, racingSettings.getStartView());
        this._hudMap  = new RacingHudMap(data.course.map, data.race.courses[selection.course].racePath, data.course.collision.toScenery, mirror)
            .bindPlayers(data.roster, data.multiplayer);
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
        for (const view of this._cars.values()) {
            view.bind();
        }
        this._objects.bind();
        for (const box of this._crews) {
            box.crew.bind()
                .setOnWheel((wheel, off) => this._cars.get(box.player.getId()).setWheelOff(wheel, off))
                .setOnWrench((mechanic) => {
                    box.voice ??= (RacingPresentation.CREW_VOICE + mechanic);
                });
        }
        const voiced = ((racingSound.getEngine() !== null) && racingSound.hasEngineVoice());
        if (voiced) {
            this._engineSound = new RacingEngineSound(racingSound.getEngine(), this._selection.car);
        }
        // The other cars' noises play without the engine voice.
        if (this._multiplayer && (racingSound.getEngine() !== null)) {
            this._carSounds = new RacingCarSounds(((voiced) ? racingSound.getEngine() : null), this._selection.car);
        }
        const cars      = Array.from(this._cars.values()).flatMap((view) => view.getAllInstances());
        const crews     = this._crews.flatMap((box) => box.crew.getAllInstances());
        const parts     = new Set([...cars, ...this._objects.getAllInstances(), ...crews]);
        this._instances = loader.instances().getAll().filter((instance) => ((instance !== undefined) && !parts.has(instance)));
        this._placeCars(0);
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
     * A renderer imposed whatever the setting says (a multiplayer session renders with WebGL); the stored setting is
     * left untouched and applies again once released. Applied on the next live frame.
     *
     * @param {string|null} code - null releases it
     */
    setForcedRenderer(code) {
        this._forcedRenderer = code;

        return this;
    }

    /**
     * The screen, the engine and the HUD built again when the renderer setting changed (in the pause options), since a
     * canvas keeps one context type for its whole life: applied on the first live frame no menu covers.
     *
     * @param {boolean} menuOpen - a menu still covers the screen
     */
    applyRendererSetting(menuOpen) {
        if ((this._wantedRenderer() === this._rendererCode) || menuOpen) {
            return;
        }
        this._screen.destroyContainer();
        this._buildDisplay();
        this._controls.bindDisplay(this._screen.getDisplay());
    }

    /**
     * @param {RacingRaceOutcome} outcome - the end of the race, its countdown on the HUD
     */
    setOutcome(outcome) {
        this._outcome = outcome;

        return this;
    }

    /**
     * @param {function(int): string} nicknameOf - the label over another player's car
     */
    setNicknames(nicknameOf) {
        this._nicknameOf = nicknameOf;

        return this;
    }

    /**
     * @param {function(): (number|null)|null} source - the ping shown beside the fps, null outside a session
     */
    setPingSource(source) {
        this._pingSource = source;
        if (this._hud !== null) {
            this._hud.bindPingSource(source);
        }

        return this;
    }

    /**
     * A message of the session shown over the race until replaced (a turn waiting for a player, a pause), kept across
     * a renderer swap.
     *
     * @param {string|null} text - null hides it
     */
    setNotice(text) {
        this._noticeText = text;
        if ((this._screen === null) || ((this._noticeEl === null) && (text === null))) {
            return this;
        }
        if (this._noticeEl === null) {
            // Over the HUD, sized by the display as the HUD is.
            const layer    = AppMenuDom.addElement(this._screen.getDisplay(), 'div', 'racing-game-notice-layer');
            this._noticeEl = AppMenuDom.addElement(layer, 'div', 'racing-game-notice');
        }
        this._noticeEl.textContent   = (text ?? '');
        this._noticeEl.style.display = ((text !== null) ? '' : 'none');

        return this;
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
        if (this._carSounds !== null) {
            this._carSounds.setRunning(!paused);
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
        if (this._carSounds !== null) {
            this._carSounds.setLevelShare(RacingPresentation.RESULTS_ENGINE_SHARE);
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
        if (this._carSounds !== null) {
            this._carSounds.destroy();
            this._carSounds = null;
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
     * A live frame, after the step: the engine note, the crew, the cars placed, the scene drawn.
     *
     * @param {number}  ticks    - time elapsed, in original ticks
     * @param {boolean} menuOpen - a menu covers the screen (the results run over live frames)
     */
    present(ticks, menuOpen) {
        // Before every push onto the engine, which a swap replaces.
        this.applyRendererSetting(menuOpen);
        const state = this._player.getCarState();
        if (this._engineSound !== null) {
            this._engineSound.update(ticks, state.rpm, state.isInTunnel());
        }
        for (const box of this._crews) {
            this._updateCrew(box, ticks);
        }
        this._placeCars(ticks);
        for (const box of this._crews) {
            this._startCrew(box);
        }
        this._objects.animate(ticks);
        this._draw();
        this._presentOthers(ticks);
    }

    // After the scene is drawn, its camera set: the other players' cars labelled and heard from where they are.
    _presentOthers(ticks) {
        if (!this._multiplayer) {
            return;
        }
        const others = this._otherCars();
        const m      = this._engine.viewMatrix.v;
        for (const car of others) {
            this._inCameraSpace((this._positions.get(car.id) ?? RacingPresentation.ORIGIN), car.camera);
            car.distance = Math.hypot(car.camera[0], car.camera[1], car.camera[2]);
            // The point over the car: the view is linear, its up axis is the matrix's second row.
            for (let axis = 0; axis < car.tag.length; axis++) {
                car.tag[axis] = (car.camera[axis] + (m[1][axis] * RacingPresentation.TAG_HEIGHT));
            }
        }
        if (this._carSounds !== null) {
            this._carSounds.update(ticks, others);
        }
        this._tags.update(this._engine, others);
    }

    // One entry by other player, kept from frame to frame.
    _otherCars() {
        const all = this._roster.getAll();
        if (all !== this._othersOf) {
            this._othersOf = all;
            this._others   = all.filter((player) => (player !== this._player)).map((player) => ({
                id:       player.getId(),
                state:    player.getCarState(),
                camera:   [0, 0, 0],
                tag:      [0, 0, 0],
                distance: 0,
                near:     false
            }));
        }

        return this._others;
    }

    // A point in the world, metres, in camera space: [right, up, ahead].
    _inCameraSpace(p, out) {
        const m = this._engine.viewMatrix.v;
        out[0] = ((m[0][0] * p[0]) + (m[1][0] * p[1]) + (m[2][0] * p[2]) + m[3][0]);
        out[1] = ((m[0][1] * p[0]) + (m[1][1] * p[1]) + (m[2][1] * p[2]) + m[3][1]);
        out[2] = ((m[0][2] * p[0]) + (m[1][2] * p[1]) + (m[2][2] * p[2]) + m[3][2]);

        return out;
    }

    // Frozen frame (pause): redrawn since a resize wipes the canvas, nothing moves.
    presentFrozen() {
        this._draw();
    }

    /**
     * Played as the simulation emits them: the sounds of the viewed car at once, in the step's order; the start of the
     * crew of a car's box, whichever car, once the cars are placed.
     *
     * @param {object} event - see RacingTurnEvents
     */
    playTurnEvent(event) {
        if (event.type === RacingTurnEvents.CREW_STARTED) {
            const player = this._roster.getById(event.playerId);
            if (player === null) {
                return;
            }
            const box    = this._crews[player.getCarState().pitBox];
            box.schedule = event.schedule;
            box.player   = player;
        } else if ((event.type === RacingTurnEvents.SOUND) && (event.playerId === this._player.getId())) {
            racingSound.send(event.command);
        } else if ((event.type === RacingTurnEvents.SOUND) && (this._carSounds !== null)
            && RacingPresentation.CAR_SOUNDS.includes(event.command) && this._positions.has(event.playerId)) {
            this._carSounds.play(event.playerId, event.command, this._inCameraSpace(this._positions.get(event.playerId), [0, 0, 0]));
        }
    }

    // The screen, the engine, the HUD, the session's notice and the nicknames.
    _buildDisplay() {
        const selection    = this._selection;
        this._rendererCode = this._wantedRenderer();
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
        }).bindPingSource(this._pingSource).bindOutcome(this._outcome).bindRoster(((this._multiplayer) ? this._roster : null));
        this._screen.bindHud(this._hud);
        this._noticeEl = null;
        this.setNotice(this._noticeText);
        if (this._tags !== null) {
            this._tags.build(this._screen.getDisplay(), this._screen.getCanvas());
        }
    }

    _wantedRenderer() {
        return (this._forcedRenderer ?? racingSettings.getRenderer());
    }

    _draw() {
        const engine = this._engine;
        engine.setCamera(this._camera);
        engine.lightsCalculatePosition();
        engine.drawInit();
        this._drawInstances(this._instances);
        this._drawInstances(this._objects.getInstances());
        for (const box of this._crews) {
            this._drawInstances(box.crew.getInstances());
        }
        for (const player of this._roster.getAll()) {
            if (player !== this._player) {
                this._drawInstances(this._cars.get(player.getId()).getInstances());
            }
        }
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

    // The crew stands at the box while the original shows it ($C026 not -1) for the car it works on, stopped at that
    // box, its wheels and bursts as its clips go: the bursts of one frame make one sound (the mechanics in step would
    // add up), heard on the viewed car only. Away, it is back to its first pose.
    _updateCrew(box, ticks) {
        const state = box.player.getCarState();
        const shown = ((this._roster.getById(box.player.getId()) !== null) && (state.pitCrewFrame >= 0) && (state.pitBox === box.index));
        if (!shown && box.crew.isStarted()) {
            box.crew.reset();
        }
        box.voice = null;
        box.crew.show(shown).update(ticks);
        if ((box.voice !== null) && (box.player === this._player)) {
            racingSound.send(RacingRaceControl.SOUND_WRENCH, box.voice);
        }
    }

    // A passage of the crew starts its mechanics as the simulation scheduled them, on the car's wheels as just placed.
    _startCrew(box) {
        if (box.schedule === null) {
            return;
        }
        const car = this._cars.get(box.player.getId());
        box.crew.start(box.schedule, RacingPresentation.WHEELS.map((wheel) => car.hubMatrix(wheel, Mat4.create())));
        box.schedule = null;
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

    _placeCars(ticks) {
        for (const player of this._roster.getAll()) {
            this._positions.set(player.getId(), this._placeCar(ticks, player.getCarState(), this._cars.get(player.getId()), (player === this._player)));
        }
    }

    // Entity units: x / z in collision units (2 scenery units), height in 1/8 scenery unit; the original moves
    // along (sin(-h), cos(-h)), the engine's yaw along (sin(yaw), cos(yaw)).
    // The height, smoothed by half a tick, lags up to a metre under a steep climb at full speed: the original paints the
    // car over the road, the depth buffer would hide it, so it is drawn on the road (user decision). The camera follows
    // the viewed car. Returns where the car is drawn.
    _placeCar(ticks, state, view, viewed) {
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
        view.setCockpit(viewed && this._camera.isCockpitShown())
            .setDamage(state.damage)
            .setEffects(state.effectFrames, (state.crashRecovery === 0), state.smokeX)
            .animate(ticks, state.displaySpeed, state.steer, state.yawRate, state.heading, state.autoDriven)
            .place(position, yaw, pitch, roll, pose);
        if (viewed) {
            this._camera.follow(ticks, position, yaw, pitch, roll, pose, this._cockpitLean(ticks, state, side));
        }

        return position;
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
// The noises of a car, heard from the other players' cars too; the race's voices and music are each player's own.
RacingPresentation.CAR_SOUNDS                  = [
    RacingCarPhysics.SOUND_CRASH, RacingCarPhysics.SOUND_SKID, RacingCarPhysics.SOUND_SPIN, RacingCarPhysics.SOUND_WHEELSPIN,
    RacingCarPhysics.SOUND_WALL, RacingCarPhysics.SOUND_SPARKS, RacingCarPhysics.SOUND_CONTACT, RacingCarPhysics.SOUND_SQUEAL,
    RacingCarPhysics.SOUND_SQUEAL_CUT, RacingCarPhysics.SOUND_GRASS
];
RacingPresentation.ORIGIN                      = [0, 0, 0];
// Metres over a car's place where its nickname stands.
RacingPresentation.TAG_HEIGHT                  = 1.6;

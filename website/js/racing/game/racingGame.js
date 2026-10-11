/**
 * A race on a course: loads the exported data, builds the scene in the engine
 * (one instance per scenery cell, the player's car, the sky panorama), drives
 * the car with the physics of the original transposed to the frame time
 * (RacingCarContinuousPhysics) and renders it every display frame through
 * the camera views of the original (RacingCamera). Escape returns to the menus.
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
        this._physics   = null;
        this._controls  = null;
        this._instances = [];
        this._running   = false;
        this._side      = ((selection.mirror) ? -1 : 1);
        this._onFrame   = (timestamp) => this._guard(this._frame, timestamp);
        this._onKey     = (event) => {
            if (event.code === 'Escape') {
                event.preventDefault();
                this.quit();
            }
        };
    }

    async start() {
        const base = RacingGame.ASSETS;
        const sky  = (base + 'skies/' + this._selection.course + '.png');
        // The sky is checked here: the texture loader has no error path, a missing image would hang the race.
        const [course, cars, palettes, race, physics] = await Promise.all([
            appBootstrap.fetchJsonAsync(base + 'courses/' + this._selection.course + '.json'),
            appBootstrap.fetchJsonAsync(base + 'cars.json'),
            appBootstrap.fetchJsonAsync(base + 'palettes.json'),
            appBootstrap.fetchJsonAsync(base + 'race.json'),
            appBootstrap.fetchJsonAsync(base + 'physics.json'),
            appBootstrap.fetchAsync(sky)
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
        this._car     = new RacingCarView(converter, cars, car, (scenery / RacingGame.CAR_UNITS_PER_SCENERY_UNIT), mirror);
        this._physics = this._startPhysics(course, race, physics);
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

    // The race scene and its listener go: the menus come back.
    _teardown() {
        this._running = false;
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
        });
        const [x, height, z, heading] = race.startGrids[this._selection.car].race[index][RacingGame.START_PLACE];

        return result.place(x, height, z, heading);
    }

    _begin(skyId) {
        this._screen = new ScreenManager('screen', {fullscreen: true, virtualWidth: RacingGame.VIRTUAL_WIDTH, virtualHeight: RacingGame.VIRTUAL_HEIGHT});
        this._engine = new Engine3d(this._screen, new Object3dRendererList().getRenderer(racingSettings.getRenderer()));
        this._engine.setFov(this._horizontalFov())
            .setZBuffer(RacingGame.NEAR, RacingGame.FAR)
            .setBackground(...racingCatalog.getCourse(this._selection.course).skyColor)
            .setLightAmbient(RacingGame.AMBIENT)
            .setSky(this._sky(skyId));
        this._screen.bindHud(new RacingHud(this._engine));

        this._car.bind();
        this._controls  = new RacingControls();
        const parts     = new Set(this._car.getAllInstances());
        this._instances = loader.instances().getAll().filter((instance) => ((instance !== undefined) && !parts.has(instance)));
        this._placeCar(0);
        this._running   = true;
        // Driven with a gamepad, the screen gets no touch to keep it awake.
        new ScreenWakeLock().init();
        document.addEventListener('keydown', this._onKey);
        requestAnimationFrame(this._onFrame);
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
        const engine = this._engine;
        engine.calculateDeltaTime(timestamp);
        const ticks = (engine.getDeltaTime() / RacingGame.TICK_MS);
        this._simulate(ticks);
        if (!this._running) {
            return;
        }
        this._placeCar(ticks);

        engine.setCamera(this._camera);
        engine.lightsCalculatePosition();
        engine.drawInit();
        this._draw(this._instances);
        this._draw(this._car.getInstances());
        engine.drawFinish();
        this._screen.update();

        requestAnimationFrame(this._onFrame);
    }

    _draw(instances) {
        for (const instance of instances) {
            if (this._engine.isInView(instance)) {
                this._engine.drawInstance(instance);
            }
        }
    }

    _simulate(ticks) {
        const input = this._controls.read();
        if (input.quit) {
            this.quit();
            return;
        }
        if (input.view) {
            this._camera.cycleView();
        }
        if (this._selection.mirror) {
            input.steer = -input.steer;
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
    _placeCar(ticks) {
        const physics  = this._physics;
        const side     = this._side;
        const position = [
            (physics.x * RacingGame.METRES_PER_ENTITY_UNIT * side),
            (physics.height * RacingGame.METRES_PER_HEIGHT_UNIT),
            (physics.z * RacingGame.METRES_PER_ENTITY_UNIT)
        ];
        // $2984 turns the camera and the body by the heading plus the shown slip (+$3C + +$96), not by +$40, which a
        // wall deflection swings round.
        const yaw   = (-RacingGame._degrees(physics.heading + physics.shownSlip) * side);
        const pitch = RacingGame._degrees(physics.pitch);
        const roll  = (RacingGame._degrees(physics.roll) * side);
        this._car.setCockpit(this._camera.getView() === RacingCamera.VIEW_COCKPIT)
            .setEffects(physics.effectFrames, (physics.crashRecovery === 0))
            .animate(ticks, physics.displaySpeed, physics.steer, physics.yawRate)
            .place(position, yaw, pitch, roll, this._bodyPose(physics, side));
        this._camera.follow(ticks, position, yaw, pitch, roll);
    }

    // $2984 / $70AA: a crash lifts the body by +$9C x 16 / 256 m and tumbles it (+$44 pitch); the slip and the shock
    // yaw it (+$46), the turn and the crash roll it ((+$4A + +$4C) / 4); 1/65536 turn.
    _bodyPose(physics, side) {
        return {
            lift:  (physics.crashPose[0] / RacingGame.LIFT_UNITS_PER_METRE),
            yaw:   (RacingGame._degrees(physics.bodyYaw) * side),
            pitch: RacingGame._degrees(physics.bodyPitch),
            roll:  (-RacingGame._degrees((physics.bodyRoll + physics.slipInput) / 4) * side)
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
RacingGame.VIRTUAL_WIDTH                  = 1920;
RacingGame.VIRTUAL_HEIGHT                 = 1080;
RacingGame.NEAR                           = 0.1;
RacingGame.FAR                            = 2000;
RacingGame.AMBIENT                        = [255, 255, 255];
RacingGame.LIFT_UNITS_PER_METRE           = 16;
RacingGame.METRES_PER_ENTITY_UNIT         = (RacingGame.SCENERY_UNITS_PER_ENTITY_UNIT / RacingGame.SCENERY_UNITS_PER_METRE);
RacingGame.METRES_PER_HEIGHT_UNIT         = (1 / (RacingGame.HEIGHT_UNITS_PER_SCENERY_UNIT * RacingGame.SCENERY_UNITS_PER_METRE));
// The player starts on the first place of the grid.
RacingGame.START_PLACE                    = 0;

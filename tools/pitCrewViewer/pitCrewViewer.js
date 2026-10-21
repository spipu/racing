/**
 * Viewer of the pit crew as the game plays it (RacingPitCrew around a RacingCarView on the Big Forest box), to check
 * the models (website/assets/virtual_racing/models/) on screen: the four mechanics around any car, any time of the
 * clips, image by image or at any speed, each mechanic looked at closer, turned and zoomed with the mouse.
 */
class PitCrewViewer {
    constructor() {
        this._engine  = null;
        this._screen  = null;
        this._race    = null;
        this._scenes  = new Map();
        this._scene   = null;
        this._box     = null;
        this._focus   = PitCrewViewer.ALL;
        this._time    = 0;
        this._playing = true;
        this._speed   = 1;
        this._showCar = true;
        this._loop    = true;
        this._log     = [];
        this._view    = {yaw: PitCrewViewer.VIEW_YAW, pitch: PitCrewViewer.VIEW_PITCH, distance: PitCrewViewer.VIEW_DISTANCE, drag: null};
    }

    load() {
        Promise.all(['race.json', 'cars.json', 'palettes.json'].map((file) => fetch(PitCrewViewer.DATA + file).then((response) => response.json())))
            .then(([race, cars, palettes]) => this._loadScenes(race, cars, palettes));
    }

    // A car on the box and its crew, for each car, loaded together.
    _loadScenes(race, cars, palettes) {
        const [x, y, z] = race.pit.mechanicBases[PitCrewViewer.COURSE];
        this._box  = [(x * RacingGame.METRES_PER_ENTITY_UNIT), (y * RacingGame.METRES_PER_HEIGHT_UNIT), (z * RacingGame.METRES_PER_ENTITY_UNIT)];
        this._race = race;
        loader.reset();
        loader.beginBatch();
        for (const car of cars.cars) {
            const converter = new RacingModelConverter(new RacingPalette(palettes, PitCrewViewer.COURSE, car.code));
            const wheels    = new RacingWheelModels(cars, car);
            this._scenes.set(car.code, {
                car:  car,
                view: new RacingCarView(converter, cars, car, wheels, PitCrewViewer.METRES, false, false),
                crew: new RacingPitCrew(PitCrewViewer.DATA, converter, wheels, race.pit, car, PitCrewViewer.COURSE, PitCrewViewer.METRES, false),
            });
        }
        loader.objects().loadFromData('ground', this._groundData());
        loader.setCallback(() => {
            loader.clearCallback();
            this._start(cars);
        });
        loader.endBatch();
    }

    _start(cars) {
        // Every instance made before a car is placed: the loader sets new ones as loaded.
        for (const scene of this._scenes.values()) {
            scene.view.bind();
            scene.crew.bind()
                .setOnWheel((wheel, off) => {
                    scene.view.setWheelOff(wheel, off);
                    this._note((off ? 'wheel off ' : 'wheel on ') + wheel);
                })
                .setOnWrench((mechanic) => this._note('wrench ' + RacingPitCrew.CLIPS[mechanic]))
                .setOnRepaired((mechanic) => this._note('repaired ' + RacingPitCrew.CLIPS[mechanic]))
                .setOnFinished((mechanic) => this._note('finished ' + RacingPitCrew.CLIPS[mechanic]));
        }
        this._screen = new ScreenManager('screen', {fullscreen: true, virtualWidth: PitCrewViewer.VIRTUAL_WIDTH, virtualHeight: PitCrewViewer.VIRTUAL_HEIGHT});
        this._engine = new Engine3d(this._screen, new Object3dRendererList().getRenderer('webgl'));
        this._engine.setBackground(...PitCrewViewer.BACKGROUND);
        this._engine.setFov(PitCrewViewer.FOV);
        this._engine.setZBuffer(PitCrewViewer.NEAR, PitCrewViewer.FAR);
        this._engine.setLightAmbient(PitCrewViewer.AMBIENT);
        for (const light of PitCrewViewer.LIGHTS) {
            this._engine.addLight(new Light(light.color, light.intensity, light.position.map((value, k) => (value + this._box[k]))));
        }
        // The screen draws a HUD over the scene: the engine's own, with the frame rate.
        this._screen.bindHud(new HudDebug(this._engine).addDescription('Pit crew viewer'));

        this._bindControls(cars);
        this._chooseCar(cars.cars[0].code);
        let last = null;
        const frame = (timestamp) => {
            const dt = ((last === null) ? 0 : Math.min(((timestamp - last) / RacingGame.MS_PER_SECOND), PitCrewViewer.LONGEST_FRAME));
            last = timestamp;
            this._step((this._playing) ? (dt * this._speed) : 0);
            this._draw();
            requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
    }

    _chooseCar(code) {
        this._scene = this._scenes.get(code);
        this._restart(this._time);
    }

    // The crew from the start of the clips to a time, as the game starts it: on the car's wheels as placed.
    _restart(time) {
        const {view, crew} = this._scene;
        crew.reset();
        for (let wheel = 0; wheel < PitCrewViewer.WHEELS; wheel++) {
            view.setWheelOff(wheel, false);
        }
        this._placeCar();
        crew.show(true).start(RacingPitCrewSchedule.start(), RacingPitCrew.CLIPS.map((clip, wheel) => view.hubMatrix(wheel, Mat4.create())));
        this._log.length = 0;
        this._time       = 0;
        for (let t = 0; t < time; t += PitCrewViewer.SEEK_STEP) {
            this._advance(Math.min(PitCrewViewer.SEEK_STEP, (time - t)));
        }
        this._showState();
    }

    _step(seconds) {
        this._advance(seconds);
        if (this._loop && this._playing && (this._time >= PitCrewViewer.DURATION)) {
            this._restart(0);
        }
        this._showState();
    }

    _advance(seconds) {
        this._time += seconds;
        this._scene.crew.update((seconds * RacingGame.MS_PER_SECOND) / RacingGame.TICK_MS);
    }

    // The car still on the box, as the game places it at the pit start.
    _placeCar() {
        this._scene.view.setDamage(0).setEffects(null, true, null).animate(0, 0, 0, 0).place(this._box, 0, 0, 0, PitCrewViewer.STILL_POSE);
    }

    _note(text) {
        this._log.push(this._time.toFixed(2) + ' ' + text);
    }

    _showState() {
        PitCrewViewer._element('time').value = this._time;
        PitCrewViewer._element('state').textContent = [(this._scene.car.code + '  t ' + this._time.toFixed(2) + ' s  image ' + PitCrewViewer._imageAt(this._time)), ...this._log.slice(-PitCrewViewer.EVENTS_SHOWN)].join('\n');
    }

    _draw() {
        const engine = this._engine;
        const view   = this._view;
        const target = this._target();
        engine.drawInit();
        engine.matrixIdentity();
        engine.matrixTranslate(0, 0, view.distance);
        engine.matrixRotateX(-view.pitch);
        engine.matrixRotateY(-view.yaw);
        engine.matrixTranslate(...target.map((value) => -value));
        engine.lightsCalculatePosition();
        engine.drawObject(loader.objects().getByCode('ground'));
        if (this._showCar) {
            this._placeCar();
            this._scene.view.getInstances().forEach((instance) => engine.drawInstance(instance));
        }
        this._scene.crew.getInstances().forEach((instance) => engine.drawInstance(instance));
        engine.drawFinish();
        this._screen.update();
    }

    // Where the camera looks: the car's middle, or the mechanic looked at (its place on the box).
    _target() {
        const n = RacingPitCrew.CLIPS.indexOf(this._focus);
        if (n < 0) {
            return this._box.map((value, k) => (value + PitCrewViewer.CAR_MIDDLE[k]));
        }
        const [dx, dz] = this._race.pit.mechanicOffsets[this._scene.car.code][n];

        return [(this._box[0] + (dx * RacingGame.METRES_PER_ENTITY_UNIT)), (this._box[1] + PitCrewViewer.CAR_MIDDLE[1]), (this._box[2] - (dz * RacingGame.METRES_PER_ENTITY_UNIT))];
    }

    _bindControls(cars) {
        const element = PitCrewViewer._element;
        const toggle  = (id, get, set) => element(id).addEventListener('click', () => {
            set(!get());
            element(id).classList.toggle('on', get());
        });
        const choices = (id, names, chosen, choose) => {
            for (const name of names) {
                const button = document.createElement('button');
                button.textContent = name;
                button.classList.toggle('on', (name === chosen));
                button.addEventListener('click', () => {
                    choose(name);
                    element(id).querySelectorAll('button').forEach((b) => b.classList.toggle('on', (b === button)));
                });
                element(id).appendChild(button);
            }
        };
        const pause   = () => {
            this._playing = false;
            element('play').classList.remove('on');
        };
        const toImage = (direction) => {
            pause();
            this._restart(PitCrewViewer._keyTime(Math.min((PitCrewViewer.KEYS - 1), Math.max(0, (PitCrewViewer._imageAt(this._time) + direction)))));
        };

        choices('clips', [PitCrewViewer.ALL, ...RacingPitCrew.CLIPS], this._focus, (name) => { this._focus = name; });
        choices('cars', cars.cars.map((car) => car.code), cars.cars[0].code, (code) => this._chooseCar(code));
        toggle('play', () => this._playing, (on) => { this._playing = on; });
        toggle('car', () => this._showCar, (on) => { this._showCar = on; });
        toggle('loop', () => this._loop, (on) => { this._loop = on; });
        element('previous').addEventListener('click', () => toImage(-1));
        element('next').addEventListener('click', () => toImage(1));
        element('speed').addEventListener('input', () => {
            this._speed = Number(element('speed').value);
            element('speedValue').textContent = this._speed.toFixed(2);
        });
        element('time').max = PitCrewViewer.DURATION;
        element('time').addEventListener('input', () => {
            pause();
            this._restart(Number(element('time').value));
        });
        this._bindMouse(element('screen'));
    }

    // Drag: turn around the target; wheel: zoom.
    _bindMouse(canvas) {
        const view = this._view;
        canvas.addEventListener('pointerdown', (event) => { view.drag = [event.clientX, event.clientY]; });
        window.addEventListener('pointerup', () => { view.drag = null; });
        window.addEventListener('pointermove', (event) => {
            if (view.drag === null) {
                return;
            }
            view.yaw  += ((event.clientX - view.drag[0]) * PitCrewViewer.DEGREES_PER_PIXEL);
            view.pitch = Math.max(PitCrewViewer.PITCH_RANGE[0], Math.min(PitCrewViewer.PITCH_RANGE[1], (view.pitch + ((event.clientY - view.drag[1]) * PitCrewViewer.DEGREES_PER_PIXEL))));
            view.drag  = [event.clientX, event.clientY];
        });
        canvas.addEventListener('wheel', (event) => {
            const factor  = ((event.deltaY > 0) ? PitCrewViewer.ZOOM_STEP : (1 / PitCrewViewer.ZOOM_STEP));
            view.distance = Math.max(PitCrewViewer.DISTANCE_RANGE[0], Math.min(PitCrewViewer.DISTANCE_RANGE[1], (view.distance * factor)));
            event.preventDefault();
        }, {passive: false});
    }

    // Tiles in two greys around the box, at its height.
    _groundData() {
        const points = [];
        const faces  = [];
        const size   = PitCrewViewer.TILE;
        const count  = PitCrewViewer.TILES;
        const half   = ((count * size) / 2);
        const [bx, by, bz] = this._box;
        for (let j = 0; j < count; j++) {
            for (let i = 0; i < count; i++) {
                const x    = (bx + (i * size) - half);
                const z    = (bz + (j * size) - half + PitCrewViewer.CAR_MIDDLE[2]);
                const base = (points.length + 1);
                const grey = PitCrewViewer.GROUND[(i + j) % 2];
                points.push([x, by, z], [(x + size), by, z], [(x + size), by, (z + size)], [x, by, (z + size)]);
                faces.push({pts: [base, (base + 2), (base + 1)], color: [...grey]}, {pts: [base, (base + 3), (base + 2)], color: [...grey]});
            }
        }

        return {points, faces};
    }

    static _element(id) {
        return document.getElementById(id);
    }

    // Time of an image of the original: its first tick, image = (ticks x $3BBB) >> 16 (RacingCarPhysics.crewFrame).
    static _keyTime(image) {
        return ((Math.ceil((image * PitCrewViewer.FRAME_ONE) / PitCrewViewer.FRAME_RATE) * RacingGame.TICK_MS) / RacingGame.MS_PER_SECOND);
    }

    static _imageAt(time) {
        let image = 0;
        while (((image + 1) < PitCrewViewer.KEYS) && (PitCrewViewer._keyTime(image + 1) <= (time + PitCrewViewer.TIME_EPSILON))) {
            image++;
        }

        return image;
    }
}

// The game's data, served from the repository root.
PitCrewViewer.DATA              = '/website/assets/virtual_racing/';
PitCrewViewer.COURSE            = 'big_forest';
PitCrewViewer.METRES            = (1 / 1024);
PitCrewViewer.WHEELS            = 4;
PitCrewViewer.ALL               = 'all four';
PitCrewViewer.STILL_POSE        = {lift: 0, yaw: 0, pitch: 0, roll: 0};
// The clips: 28 images of the original, the last at 5.8 s.
PitCrewViewer.KEYS              = 28;
PitCrewViewer.DURATION          = 5.8;
PitCrewViewer.FRAME_RATE        = 0x3BBB;
PitCrewViewer.FRAME_ONE         = 0x10000;
PitCrewViewer.TIME_EPSILON      = 1e-6;
// Seconds between two updates when going to a time.
PitCrewViewer.SEEK_STEP         = (1 / 60);
PitCrewViewer.LONGEST_FRAME     = 0.05;
PitCrewViewer.EVENTS_SHOWN      = 6;
PitCrewViewer.VIRTUAL_WIDTH     = 1920;
PitCrewViewer.VIRTUAL_HEIGHT    = 1080;
PitCrewViewer.BACKGROUND        = [30, 34, 40];
PitCrewViewer.FOV               = 45;
PitCrewViewer.NEAR              = 0.1;
PitCrewViewer.FAR               = 100;
PitCrewViewer.AMBIENT           = [110, 110, 110];
// Lights around the box (metres from it).
PitCrewViewer.LIGHTS            = [
    {color: [255, 255, 240], intensity: 20, position: [3, 6, -4]},
    {color: [140, 160, 255], intensity: 14, position: [-4, 4, 3]},
];
// Camera: around the middle of the car (metres from the box), its angles in degrees.
PitCrewViewer.CAR_MIDDLE        = [0, 0.6, -1.2];
PitCrewViewer.VIEW_YAW          = -35;
PitCrewViewer.VIEW_PITCH        = 22;
PitCrewViewer.VIEW_DISTANCE     = 7.5;
PitCrewViewer.PITCH_RANGE       = [-5, 85];
PitCrewViewer.DISTANCE_RANGE    = [1.5, 20];
PitCrewViewer.DEGREES_PER_PIXEL = 0.3;
PitCrewViewer.ZOOM_STEP         = 1.1;
PitCrewViewer.TILE              = 0.5;
PitCrewViewer.TILES             = 30;
PitCrewViewer.GROUND            = [[70, 74, 80], [86, 90, 96]];

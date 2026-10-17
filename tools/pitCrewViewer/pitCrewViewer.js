/**
 * Viewer of the pit crew models (website/assets/virtual_racing/models/), to check them on screen: one mechanic or the
 * four around a car of the game, any time of the clips, image by image or at any speed, turned and zoomed with the
 * mouse.
 */
class PitCrewViewer {
    constructor() {
        this._engine  = null;
        this._screen  = null;
        this._race    = null;
        this._crew    = [];
        this._cars    = new Map();
        this._car     = null;
        this._shown   = PitCrewViewer.CLIPS[0];
        this._playing = true;
        this._speed   = 1;
        this._showCar = true;
        this._loop    = true;
        this._view    = {yaw: PitCrewViewer.VIEW_YAW, pitch: PitCrewViewer.VIEW_PITCH, distance: PitCrewViewer.VIEW_DISTANCE, drag: null};
    }

    load() {
        loader.reset();
        loader.beginBatch();
        loader.animatedModels().loadByCode('mechanic', (PitCrewViewer.MODELS + 'pit_mechanic.gltf'));
        loader.staticModels().loadByCode('wrench', (PitCrewViewer.MODELS + 'pit_wrench.gltf'));
        loader.setCallback(() => {
            loader.clearCallback();
            Promise.all(['race.json', 'cars.json', 'palettes.json'].map((file) => fetch(PitCrewViewer.DATA + file).then((response) => response.json())))
                .then(([race, cars, palettes]) => this._start(race, cars, palettes));
        });
        loader.endBatch();
    }

    _start(race, cars, palettes) {
        const model = loader.animatedModels().getByCode('mechanic');
        const wrench = loader.staticModels().getByCode('wrench').toObjectData();
        this._race  = race;
        this._crew  = PitCrewViewer.CLIPS.map((name) => new PitCrewMember(name, model, loader.instances().get(loader.instances().loadFromData(null, RacingCarView.instanceData(loader.objects().loadFromData(null, wrench))))));
        for (const car of cars.cars) {
            this._cars.set(car.code, new PitCrewCar(cars, palettes, car));
        }
        this._chooseCar(cars.cars[0].code);

        this._screen = new ScreenManager('screen', {fullscreen: true, virtualWidth: PitCrewViewer.VIRTUAL_WIDTH, virtualHeight: PitCrewViewer.VIRTUAL_HEIGHT});
        this._engine = new Engine3d(this._screen, new Object3dRendererList().getRenderer('webgl'));
        this._engine.setBackground(...PitCrewViewer.BACKGROUND);
        this._engine.setFov(PitCrewViewer.FOV);
        this._engine.setZBuffer(PitCrewViewer.NEAR, PitCrewViewer.FAR);
        this._engine.setLightAmbient(PitCrewViewer.AMBIENT);
        for (const light of PitCrewViewer.LIGHTS) {
            this._engine.addLight(new Light(light.color, light.intensity, light.position));
        }
        // The screen draws a HUD over the scene: the engine's own, with the frame rate.
        this._screen.bindHud(new HudDebug(this._engine).addDescription('Pit crew viewer'));
        loader.objects().loadFromData('ground', PitCrewViewer._groundData());

        this._bindControls(cars);
        this._restart(0);
        let last = null;
        const frame = (timestamp) => {
            const dt = ((last === null) ? 0 : Math.min(((timestamp - last) / 1000), PitCrewViewer.LONGEST_FRAME));
            last = timestamp;
            this._step((this._playing) ? (dt * this._speed) : 0);
            this._draw();
            requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
    }

    _chooseCar(code) {
        this._car = this._cars.get(code);
        this._crew.forEach((member, n) => member.placeAround(this._car, this._race.pit.mechanicOffsets[code][n]));
    }

    _restart(time) {
        for (const member of this._crew) {
            member.restart(time, PitCrewViewer.SEEK_STEP);
        }
        this._showState();
    }

    _step(dt) {
        for (const member of this._crew) {
            member.update(dt);
        }
        if (this._loop && this._playing && (this._crew[0].getTime() >= PitCrewViewer.DURATION)) {
            this._restart(0);
        }
        this._showState();
    }

    _showState() {
        const time   = this._crew[0].getTime();
        const member = this._crew.find((m) => (m.getName() === this._shown));
        PitCrewViewer._element('time').value = time;
        PitCrewViewer._element('state').textContent = [(this._shown + '  t ' + time.toFixed(2) + ' s  image ' + PitCrewViewer._imageAt(time)), ...((member) ? member.getLog().slice(-PitCrewViewer.EVENTS_SHOWN) : [])].join('\n');
    }

    _draw() {
        const engine = this._engine;
        const view   = this._view;
        engine.drawInit();
        engine.matrixIdentity();
        engine.matrixTranslate(0, 0, view.distance);
        engine.matrixRotateX(-view.pitch);
        engine.matrixRotateY(-view.yaw);
        engine.matrixTranslate(...PitCrewViewer.TARGET.map((value) => -value));
        engine.lightsCalculatePosition();
        engine.drawObject(loader.objects().getByCode('ground'));
        const shown = this._crew.filter((member) => ((this._shown === PitCrewViewer.ALL) || (member.getName() === this._shown)));
        if (this._showCar) {
            engine.drawInstance(this._car.getBody());
            for (const member of this._crew) {
                if (!shown.includes(member) || member.isCarWheelOn()) {
                    engine.drawInstance(this._car.getWheel(member.getName()));
                }
            }
        }
        for (const member of shown) {
            member.getInstances().forEach((instance) => engine.drawInstance(instance));
        }
        engine.drawFinish();
        this._screen.update();
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
            this._restart(PitCrewViewer._keyTime(Math.min((PitCrewViewer.KEYS - 1), Math.max(0, (PitCrewViewer._imageAt(this._crew[0].getTime()) + direction)))));
        };

        choices('clips', [...PitCrewViewer.CLIPS, PitCrewViewer.ALL], this._shown, (name) => { this._shown = name; });
        choices('cars', cars.cars.map((car) => car.code), cars.cars[0].code, (code) => {
            this._chooseCar(code);
            this._restart(this._crew[0].getTime());
        });
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

    // Drag: turn around the car; wheel: zoom.
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

    static _element(id) {
        return document.getElementById(id);
    }

    // Time of an image of the original (its first tick at 30 images a second shown 7 by 7 at 20 ticks a second).
    static _keyTime(image) {
        return (Math.ceil((PitCrewViewer.TICKS_PER_IMAGE * image) / PitCrewViewer.IMAGES_PER_TICKS) * PitCrewViewer.TICK);
    }

    static _imageAt(time) {
        let image = 0;
        while (((image + 1) < PitCrewViewer.KEYS) && (PitCrewViewer._keyTime(image + 1) <= (time + PitCrewViewer.TIME_EPSILON))) {
            image++;
        }

        return image;
    }

    // Tiles in two greys around the car.
    static _groundData() {
        const points = [];
        const faces  = [];
        const size   = PitCrewViewer.TILE;
        const count  = PitCrewViewer.TILES;
        const half   = ((count * size) / 2);
        for (let j = 0; j < count; j++) {
            for (let i = 0; i < count; i++) {
                const x    = ((i * size) - half);
                const z    = ((j * size) - half + PitCrewViewer.TARGET[2]);
                const base = (points.length + 1);
                const grey = PitCrewViewer.GROUND[(i + j) % 2];
                points.push([x, 0, z], [(x + size), 0, z], [(x + size), 0, (z + size)], [x, 0, (z + size)]);
                faces.push({pts: [base, (base + 2), (base + 1)], color: [...grey]}, {pts: [base, (base + 3), (base + 2)], color: [...grey]});
            }
        }

        return {points, faces};
    }
}

PitCrewViewer.DATA              = '/website/assets/virtual_racing/';
PitCrewViewer.MODELS            = (PitCrewViewer.DATA + 'models/');
PitCrewViewer.CLIPS             = ['rearRight', 'frontRight', 'rearLeft', 'frontLeft'];
PitCrewViewer.ALL               = 'all four';
// The clips: 28 images of the original, the last at 5.8 s.
PitCrewViewer.KEYS              = 28;
PitCrewViewer.DURATION          = 5.8;
PitCrewViewer.TICK              = 0.05;
PitCrewViewer.TICKS_PER_IMAGE   = 30;
PitCrewViewer.IMAGES_PER_TICKS  = 7;
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
PitCrewViewer.LIGHTS            = [
    {color: [255, 255, 240], intensity: 20, position: [3, 6, -4]},
    {color: [140, 160, 255], intensity: 14, position: [-4, 4, 3]},
];
// Camera: around the middle of the car (metres), its angles in degrees.
PitCrewViewer.TARGET            = [0, 0.6, -1.2];
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

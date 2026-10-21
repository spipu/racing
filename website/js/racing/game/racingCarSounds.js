/**
 * The sounds of the other players' cars (user decision 2026-10-19, as doom_js hears the other players): their noises —
 * skids, crashes, walls, sparks, grass — and, when the engine voice can play, their engines, lowered with the distance
 * and placed left or right by where each car is from the camera; the viewed car's own stay centred
 * (RacingPresentation). The engines are capped to the ENGINES closest cars within reach, each keeping its voice while
 * it stays among them. Nothing is allocated per frame.
 */
class RacingCarSounds {
    /**
     * @param {SoundEngine|null} engine - null: no engine voice (its AudioWorklet did not load), the noises only
     * @param {string}           car    - car code: every car of the race is the same, so is its voice (user decision)
     */
    constructor(engine, car) {
        const voices = ((engine !== null) ? RacingCarSounds.ENGINES : 0);
        this._voices = Array.from({length: voices}, () => new RacingEngineSound(engine, car, true));
        this._owners = new Array(voices).fill(null);   // by voice: the player id it sounds, null when free
    }

    /**
     * @param {number} ticks - time elapsed, in original ticks
     * @param {{id: int, state: RacingCarState, camera: number[], distance: number, near: boolean}[]} cars - the other
     *        cars in camera space; `near` is written here
     */
    update(ticks, cars) {
        if (this._voices.length === 0) {
            return;
        }
        this._pickNearest(cars);
        for (let index = 0; index < this._owners.length; index++) {
            const owner = this._owners[index];
            if ((owner !== null) && !RacingCarSounds._isNear(cars, owner)) {
                this._owners[index] = null;
            }
        }
        for (const car of cars) {
            if (car.near && !this._owners.includes(car.id)) {
                this._owners[this._owners.indexOf(null)] = car.id;
            }
        }
        for (let index = 0; index < this._voices.length; index++) {
            const car = RacingCarSounds._carOf(cars, this._owners[index]);
            if (car === null) {
                this._voices[index].setPlacement(0, 0);
                continue;
            }
            this._voices[index].update(ticks, car.state.rpm, car.state.isInTunnel())
                .setPlacement(RacingCarSounds.gainAt(car.distance), RacingCarSounds.panOf(car.camera));
        }
    }

    // The ENGINES closest cars within reach, marked near.
    _pickNearest(cars) {
        for (const car of cars) {
            car.near = false;
        }
        for (let picked = 0; picked < this._voices.length; picked++) {
            let closest = null;
            for (const car of cars) {
                if (!car.near && (car.distance < RacingCarSounds.FAR) && ((closest === null) || (car.distance < closest.distance))) {
                    closest = car;
                }
            }
            if (closest === null) {
                return;
            }
            closest.near = true;
        }
    }

    static _isNear(cars, id) {
        const car = RacingCarSounds._carOf(cars, id);

        return ((car !== null) && car.near);
    }

    static _carOf(cars, id) {
        for (const car of cars) {
            if (car.id === id) {
                return car;
            }
        }

        return null;
    }

    /**
     * A noise of another player's car, from where it is now.
     *
     * @param {int}      id
     * @param {string}   command - sound command id of the original
     * @param {number[]} camera  - the car in camera space
     */
    play(id, command, camera) {
        racingSound.sendFrom(id, command, RacingCarSounds.gainAt(Math.hypot(...camera)), RacingCarSounds.panOf(camera));
    }

    setRunning(running) {
        this._voices.forEach((voice) => voice.setRunning(running));

        return this;
    }

    setLevelShare(share) {
        this._voices.forEach((voice) => voice.setLevelShare(share));

        return this;
    }

    destroy() {
        this._voices.forEach((voice) => voice.destroy());
        this._voices = [];
        this._owners = [];
    }

    /**
     * @param {number} distance - metres
     * @returns {number} full up to NEAR, none from FAR, linear between
     */
    static gainAt(distance) {
        return Math.max(0, Math.min(1, ((RacingCarSounds.FAR - distance) / (RacingCarSounds.FAR - RacingCarSounds.NEAR))));
    }

    // The side the car is on, from the camera's right.
    static panOf(camera) {
        const across = Math.hypot(camera[0], camera[2]);

        return ((across > 0) ? (camera[0] / across) : 0);
    }
}

// The engines heard at once: their AudioWorklets cost, to be measured on device (user decision).
RacingCarSounds.ENGINES = 3;
// Metres from the camera.
RacingCarSounds.NEAR    = 10;
RacingCarSounds.FAR     = 200;

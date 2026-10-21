/**
 * The sounds of the other players' cars (user decision 2026-10-19, as doom_js hears the other players): their engines
 * and their noises — skids, crashes, walls, sparks, grass —, lowered with the distance and placed left or right by
 * where each car is from the camera; the viewed car's own stay centred (RacingPresentation). The engines are capped
 * to the ENGINES closest cars within reach, each keeping its voice while it stays among them.
 */
class RacingCarSounds {
    /**
     * @param {SoundEngine} engine
     * @param {string}      car - car code: every car of the race is the same, so is its voice (user decision)
     */
    constructor(engine, car) {
        this._voices   = Array.from({length: RacingCarSounds.ENGINES}, () => new RacingEngineSound(engine, car, true));
        this._assigned = new Map();   // player id → index of its voice
    }

    /**
     * @param {number} ticks - time elapsed, in original ticks
     * @param {{id: int, state: RacingCarState, camera: number[]}[]} cars - the other cars, each in camera space
     */
    update(ticks, cars) {
        const near = cars.map((car) => ({car: car, distance: Math.hypot(...car.camera)}))
            .filter((entry) => (entry.distance < RacingCarSounds.FAR))
            .sort((a, b) => (a.distance - b.distance))
            .slice(0, this._voices.length);
        const kept = new Set(near.map((entry) => entry.car.id));
        for (const id of Array.from(this._assigned.keys())) {
            if (!kept.has(id)) {
                this._assigned.delete(id);
            }
        }
        const free = this._voices.map((voice, index) => index).filter((index) => !Array.from(this._assigned.values()).includes(index));
        for (const entry of near) {
            if (!this._assigned.has(entry.car.id)) {
                this._assigned.set(entry.car.id, free.shift());
            }
            const state = entry.car.state;
            this._voices[this._assigned.get(entry.car.id)]
                .update(ticks, state.rpm, ((state.roadFlags & RacingPresentation.ROAD_TUNNEL) !== 0))
                .setPlacement(RacingCarSounds.gainAt(entry.distance), RacingCarSounds.panOf(entry.car.camera));
        }
        for (const index of free) {
            this._voices[index].setPlacement(0, 0);
        }
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

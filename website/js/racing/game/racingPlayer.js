/**
 * One player of the race: the car the simulation drives for it (its physics, only on the device that simulates the
 * race), the display of its race, and the drawable state of its car (RacingCarState), whoever writes it.
 */
class RacingPlayer {
    /**
     * @param {int} id - its slot, unique within the race, stable for its whole length
     */
    constructor(id) {
        this._id       = id;
        this._physics  = null;
        this._race     = null;
        this._carState = new RacingCarState();
    }

    getId() {
        return this._id;
    }

    /**
     * Its car takes its place in the race.
     *
     * @param {RacingCarPhysics}  physics
     * @param {RacingRaceControl} race
     */
    enterRace(physics, race) {
        this._physics = physics;
        this._race    = race;

        return this;
    }

    /**
     * @returns {RacingCarPhysics|null} null before the race, or where the race is not simulated
     */
    getPhysics() {
        return this._physics;
    }

    /**
     * @returns {RacingRaceControl|null} the display of its race (start signs, lights, times, messages, blinds)
     */
    getRace() {
        return this._race;
    }

    /**
     * @returns {RacingCarState} what the presentation draws and plays of the car, whoever writes it
     */
    getCarState() {
        return this._carState;
    }
}

// The main's own player: slot 1, and the whole roster of a race alone.
RacingPlayer.MAIN_ID = 1;

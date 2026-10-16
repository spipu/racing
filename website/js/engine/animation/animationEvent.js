/**
 * A mark at an instant of an animation clip, reported to the game when the
 * playing time crosses it (a footstep, an object taken in a hand…).
 */
class AnimationEvent {
    /**
     * @param {number} time - seconds
     * @param {string} name
     * @param {object} data - free parameters, frozen
     */
    constructor(time, name, data = {}) {
        this._time = time;
        this._name = name;
        this._data = Object.freeze({...data});
        Object.freeze(this);
    }

    getTime() {
        return this._time;
    }

    getName() {
        return this._name;
    }

    getData() {
        return this._data;
    }
}

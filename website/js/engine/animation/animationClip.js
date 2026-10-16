/**
 * A named animation (a glTF animation): channels over the joints of a
 * skeleton and events sorted by time. Fixed once built and shared by every
 * instance; the readers keep their own cursors (createCursors).
 */
class AnimationClip {
    /**
     * @param {string}             name
     * @param {AnimationChannel[]} channels
     * @param {AnimationEvent[]}   events - in any order
     */
    constructor(name, channels, events = []) {
        const ends = [...channels.map((channel) => channel.getSampler().getEndTime()), ...events.map((event) => event.getTime())];

        this._name     = name;
        this._channels = Object.freeze([...channels]);
        this._events   = Object.freeze([...events].sort((a, b) => (a.getTime() - b.getTime())));
        this._duration = Math.max(0, ...ends);
        Object.freeze(this);
    }

    getName() {
        return this._name;
    }

    // The last key or event.
    getDuration() {
        return this._duration;
    }

    getChannels() {
        return this._channels;
    }

    getEvents() {
        return this._events;
    }

    /**
     * @returns {{key: int}[]} one cursor per channel, for one reader of the clip
     */
    createCursors() {
        return this._channels.map(() => AnimationSampler.createCursor());
    }

    /**
     * Writes the clip at t into the pose; the joints it does not animate keep their values.
     *
     * @param {SkeletonPose} pose
     * @param {number}       t
     * @param {{key: int}[]} cursors - from createCursors
     */
    applyTo(pose, t, cursors) {
        for (let c = 0; c < this._channels.length; c++) {
            this._channels[c].applyTo(pose, t, cursors[c]);
        }

        return pose;
    }

    /**
     * The events crossed from t0 to t1, t0 excluded unless includeStart (the first step of a playing).
     *
     * @param {number}           t0
     * @param {number}           t1
     * @param {AnimationEvent[]} out          - emptied, then filled in time order
     * @param {boolean}          includeStart
     */
    eventsBetween(t0, t1, out, includeStart = false) {
        out.length = 0;
        for (const event of this._events) {
            const time = event.getTime();
            if (time > t1) {
                break;
            }
            if ((time > t0) || (includeStart && (time === t0))) {
                out.push(event);
            }
        }

        return out;
    }
}

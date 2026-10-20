/**
 * What one player asks of the simulation for one turn, as UserCommand of the engine — plain data, the only boundary
 * between the control devices and the simulation: no key code, button index, stick axis nor device setting ever
 * crosses it.
 *
 *   - named buttons, pressed or not: the pedals, the steering buttons, the gear changes
 *   - the steering stick, -1 (right) to +1 (left), 0 at rest
 *
 * Button edges are never stored here: whoever consumes a command derives them from the same player's previous one.
 * The steering is the one the player sees: on a mirrored course, the simulation turns it back.
 */
class RacingCommand {
    constructor() {
        this._buttons   = new Set();
        this._steerAxis = 0;
    }

    press(button) {
        this._buttons.add(button);

        return this;
    }

    setSteerAxis(axis) {
        this._steerAxis = axis;

        return this;
    }

    isPressed(button) {
        return this._buttons.has(button);
    }

    getSteerAxis() {
        return this._steerAxis;
    }

    /**
     * @param {string}             button
     * @param {RacingCommand|null} previous - the same player's previous command
     * @returns {boolean} pressed now, not in the previous command
     */
    isJustPressed(button, previous) {
        return (this.isPressed(button) && ((previous === null) || !previous.isPressed(button)));
    }
}

RacingCommand.ACCELERATE  = 'accelerate';
RacingCommand.BRAKE       = 'brake';
RacingCommand.STEER_LEFT  = 'steerLeft';
RacingCommand.STEER_RIGHT = 'steerRight';
RacingCommand.GEAR_UP     = 'gearUp';
RacingCommand.GEAR_DOWN   = 'gearDown';

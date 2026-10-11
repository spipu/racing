/**
 * Race controls from the device chosen in the settings (the automatic choice
 * reads both the keyboard and the gamepad), with the player's bindings
 * (RacingSettings keyboard.* / pad.*). The original pad is digital: the stick
 * steers past a threshold. Gear and view presses count once per press.
 */
class RacingControls {
    constructor() {
        this._keyboard = new AppInputKeyboard();
        this._gamepad  = new AppInputGamepad();
        this._held     = new Set();
        racingSettings.applyBindings(this._keyboard, this._gamepad);
    }

    /**
     * @returns {{accelerate: boolean, brake: boolean, steer: int, gearUp: boolean, gearDown: boolean, view: boolean, quit: boolean}}
     *          steer: +1 left, -1 right; gearUp / gearDown / view / quit: pressed since the last read
     */
    read() {
        const padOn  = this._gamepad.isAvailable();
        const choice = RacingControls.deviceChoice(padOn);
        const keys   = (choice !== RacingSettings.DEVICE_GAMEPAD);
        const pad    = (padOn && (choice !== RacingSettings.DEVICE_KEYBOARD));
        const held   = (action) => ((keys && this._keyboard.readAction(action)) || (pad && this._gamepad.readAction(action)));
        const stick  = ((pad) ? this._gamepad.readSlot('steer') : 0);
        const left   = (held('steerLeft') || (stick <= -RacingControls.STICK_THRESHOLD));
        const right  = (held('steerRight') || (stick >= RacingControls.STICK_THRESHOLD));

        return {
            accelerate: held('accelerate'),
            brake:      held('brake'),
            steer:      (((left) ? 1 : 0) - ((right) ? 1 : 0)),
            gearUp:     this._press('gearUp', held('gearUp')),
            gearDown:   this._press('gearDown', held('gearDown')),
            view:       this._press('view', held('view')),
            quit:       this._press('pause', held('pause')),
        };
    }

    /**
     * @param {boolean} padOn - a gamepad is connected
     * @returns {string[]} the devices that can be chosen
     */
    static availableDevices(padOn) {
        return ((padOn) ? [RacingSettings.DEVICE_KEYBOARD, RacingSettings.DEVICE_GAMEPAD] : [RacingSettings.DEVICE_KEYBOARD]);
    }

    /**
     * @param {boolean} padOn - a gamepad is connected
     * @returns {string} the saved device, the automatic choice when it is not available
     */
    static deviceChoice(padOn) {
        const saved = racingSettings.getControlsDevice();

        return ((RacingControls.availableDevices(padOn).includes(saved)) ? saved : RacingSettings.DEVICE_AUTO);
    }

    /**
     * @param {boolean} padOn - a gamepad is connected
     * @returns {string} the device the player drives with, the gamepad first for the automatic choice
     */
    static deviceInUse(padOn) {
        const choice = RacingControls.deviceChoice(padOn);
        if (choice !== RacingSettings.DEVICE_AUTO) {
            return choice;
        }

        return ((padOn) ? RacingSettings.DEVICE_GAMEPAD : RacingSettings.DEVICE_KEYBOARD);
    }

    _press(action, down) {
        const pressed = (down && !this._held.has(action));
        if (down) {
            this._held.add(action);
        } else {
            this._held.delete(action);
        }

        return pressed;
    }
}

RacingControls.STICK_THRESHOLD = 0.5;

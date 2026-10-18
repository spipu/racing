/**
 * Race controls from one device at a time, chosen as doom_js does (Inputs):
 * the device forced in the settings while it is available, otherwise the
 * first available of gamepad > touch controls > keyboard. The keyboard is
 * offered off touch-only devices, the touch controls on them, the gamepad once
 * detected. The player's bindings come from RacingSettings (keyboard.* / pad.*).
 * Buttons steer all or nothing like the original digital pad; a stick steers in
 * proportion to its deflection. Gear, view and pause presses count once per press.
 */
class RacingControls {
    /**
     * @param {HTMLElement} display - the race display, which receives the touch controls
     * @param {boolean}     manual  - manual gearbox: the touch controls show the gear buttons
     */
    constructor(display, manual) {
        this._keyboard       = new AppInputKeyboard();
        this._gamepad        = new AppInputGamepad();
        this._virtualGamepad = new AppInputVirtualGamepad(RacingControls.VIRTUAL_PAD_LAYOUT);
        this._held           = new Set();
        this._device         = null;
        this._padSuppressed  = false;
        this._virtualGamepad.allowControl('gearUp', manual).allowControl('gearDown', manual).bindDisplay(display);
        this.applySettings();
    }

    // The bindings and the device, read again after a change in the pause options.
    applySettings() {
        racingSettings.applyBindings(this._keyboard, this._gamepad);
        this._virtualGamepad.setDeadZone('move', racingSettings.getVirtualPadDeadZone());
        this._device = null;
        this._selectDevice();

        return this;
    }

    /**
     * Rebuilds the touch controls into the display of a screen built again (a renderer changed in the pause).
     * @param {HTMLElement} display
     */
    bindDisplay(display) {
        this._virtualGamepad.bindDisplay(display);

        return this;
    }

    /**
     * Hides (or restores) the touch controls while a menu covers the race. The suppression is remembered, so a
     * device change during the pause cannot bring them back over the menu.
     * @param {boolean} visible
     */
    setVirtualPadVisible(visible) {
        this._padSuppressed = (visible !== true);
        this._applyVirtualPadVisibility();

        return this;
    }

    /**
     * @returns {{accelerate: boolean, brake: boolean, steer: int, steerAxis: (number|null), gearUp: boolean, gearDown: boolean, view: boolean, quit: boolean}}
     *          steer: +1 left, -1 right; steerAxis: stick deflection from -1 (right) to +1 (left), null when a button
     *          steers or the stick is at rest; gearUp / gearDown / view / quit: pressed since the last read
     */
    read() {
        this._selectDevice();
        const held  = (action) => this._readAction(action);
        const stick = this._readSteer();
        const left  = held('steerLeft');
        const right = held('steerRight');
        const axis  = ((!left && !right && (stick !== 0)) ? -stick : null);

        return {
            accelerate: held('accelerate'),
            brake:      held('brake'),
            steer:      ((axis !== null) ? Math.sign(axis) : (((left) ? 1 : 0) - ((right) ? 1 : 0))),
            steerAxis:  axis,
            gearUp:     this._press('gearUp', held('gearUp')),
            gearDown:   this._press('gearDown', held('gearDown')),
            view:       this._press('view', held('view')),
            quit:       this._press('pause', held('pause')),
        };
    }

    /**
     * @param {boolean} padOn - a gamepad is connected
     * @returns {string[]} the devices usable right now, in the order shown to the player
     */
    static availableDevices(padOn) {
        const touchOnly = RacingControls.isTouchOnlyDevice();

        return RacingControls.DEVICES.filter((device) => (
            ((device === RacingSettings.DEVICE_KEYBOARD) && !touchOnly)
            || ((device === RacingSettings.DEVICE_VIRTUAL_PAD) && touchOnly)
            || ((device === RacingSettings.DEVICE_GAMEPAD) && padOn)
        ));
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
     * @returns {string} the device the player drives with
     */
    static deviceInUse(padOn) {
        const choice = RacingControls.deviceChoice(padOn);
        if (choice !== RacingSettings.DEVICE_AUTO) {
            return choice;
        }
        const available = RacingControls.availableDevices(padOn);

        return RacingControls.AUTO_PRIORITY.find((device) => available.includes(device));
    }

    // Primary pointer, not `any-pointer`: the latter reports *possible*
    // capabilities, so Android/Samsung falsely claim a fine pointer with no mouse.
    static isTouchOnlyDevice() {
        return (window.matchMedia('(pointer: coarse)').matches && (navigator.maxTouchPoints > 0));
    }

    // Only the device in use shows the touch controls; a gamepad plugged in or out switches the device.
    _selectDevice() {
        const device = RacingControls.deviceInUse(this._gamepad.isAvailable());
        if (device === this._device) {
            return;
        }
        this._device = device;
        this._applyVirtualPadVisibility();
    }

    _applyVirtualPadVisibility() {
        this._virtualGamepad.setVisible(!this._padSuppressed && (this._device === RacingSettings.DEVICE_VIRTUAL_PAD));
    }

    _readAction(action) {
        if (this._device === RacingSettings.DEVICE_GAMEPAD) {
            return this._gamepad.readAction(action);
        }
        if (this._device === RacingSettings.DEVICE_VIRTUAL_PAD) {
            return this._virtualGamepad.readButton(action);
        }

        return this._keyboard.readAction(action);
    }

    _readSteer() {
        if (this._device === RacingSettings.DEVICE_GAMEPAD) {
            return this._gamepad.readSlot('steer');
        }
        if (this._device === RacingSettings.DEVICE_VIRTUAL_PAD) {
            return this._virtualGamepad.readMoveX();
        }

        return 0;
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

// Order in which the devices are listed to the player.
RacingControls.DEVICES         = [RacingSettings.DEVICE_KEYBOARD, RacingSettings.DEVICE_GAMEPAD, RacingSettings.DEVICE_VIRTUAL_PAD];
RacingControls.AUTO_PRIORITY   = [RacingSettings.DEVICE_GAMEPAD, RacingSettings.DEVICE_VIRTUAL_PAD, RacingSettings.DEVICE_KEYBOARD];

// --- Touch controls layout, in fractions of the letterboxed display ---

// Icon drawings in a 24×24 box; the menu icon is doom_js's.
RacingControls.VIRTUAL_PAD_ICONS = {
    menu:       {shapes: '<rect x="4" y="6.2" width="16" height="2.6" rx="1.3"/>'
                       + '<rect x="4" y="10.7" width="16" height="2.6" rx="1.3"/>'
                       + '<rect x="4" y="15.2" width="16" height="2.6" rx="1.3"/>'},
    view:       {shapes: '<path d="M2 12 C6 5.5 18 5.5 22 12 C18 18.5 6 18.5 2 12 Z" fill="none" stroke="currentColor" stroke-width="1.7"/>'
                       + '<circle cx="12" cy="12" r="3.4"/>'},
    accelerate: {shapes: '<path d="M12 4 L20 18 H4 Z"/>'},
    brake:      {shapes: '<path d="M12 20 L4 6 H20 Z"/>'},
    gearUp:     {shapes: '<rect x="10.6" y="4" width="2.8" height="16" rx="1.4"/>'
                       + '<rect x="4" y="10.6" width="16" height="2.8" rx="1.4"/>'},
    gearDown:   {shapes: '<rect x="4" y="10.6" width="16" height="2.8" rx="1.4"/>'}
};

// Pause then view at the top, right of the rev counter (it ends at 37.1 % of the
// height from the left edge, measured), at the HUD margin of 2.5 % of the height
// from the top and between each other (x in widths: × 1080 / 1920); one row in
// the bottom-right corner under the map (it ends at 76.4 % of the height,
// measured), at the same margins: accelerate in the corner under the right thumb,
// brake to its left; gear up right above accelerate and gear down above brake,
// same width, at the same margin, shipped hidden and shown by the manual gearbox.
RacingControls.VIRTUAL_PAD_BUTTONS = {
    pause:      {x: 0.2225, y: 0.025, w: 0.079, h: 0.112, icon: 'menu'},
    view:       {x: 0.3156, y: 0.025, w: 0.079, h: 0.112, icon: 'view'},
    gearUp:     {x: 0.876, y: 0.652, w: 0.110, h: 0.112, icon: 'gearUp', allowed: false},
    gearDown:   {x: 0.752, y: 0.652, w: 0.110, h: 0.112, icon: 'gearDown', allowed: false},
    accelerate: {x: 0.876, y: 0.789, w: 0.110, h: 0.186, icon: 'accelerate'},
    brake:      {x: 0.752, y: 0.789, w: 0.110, h: 0.186, icon: 'brake'}
};

RacingControls.VIRTUAL_PAD_LAYOUT = {
    // Bottom-left quadrant, left thumb, as doom_js's move stick.
    moveArea:    {x: 0, y: 0.5, w: 0.5, h: 0.5},
    aimArea:     null,
    // Resting outline in the bottom-left corner, 2.5 % of the height from both edges like the HUD blocks:
    // centre at radius + margin, x = 0.225 × 1080 / 1920.
    stickHints:  {move: {x: 0.127, y: 0.775}},
    // Larger than doom_js's sticks: a longer travel steers more finely.
    stickRadius: 0.2,
    buttons:     RacingControls.VIRTUAL_PAD_BUTTONS,
    icons:       RacingControls.VIRTUAL_PAD_ICONS
};

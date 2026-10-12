/**
 * Options modal of the menus: show() opens the options root (settings topics,
 * controls, reset), showHelp() opens the standalone help page. Adds to
 * AppMenuSettingsModal the Controls page (device choice, then the settings of
 * the device in use; their key, button and axis captures are the socle's).
 */
class RacingOptionsModal extends AppMenuSettingsModal {
    /**
     * @param {AppMenuDisplay} display
     */
    constructor(display) {
        super(display, racingSettings);

        this._gamepad      = new AppInputGamepad();
        this._shownDevices = null;
    }

    show() {
        return this._open(false, 'menu.options', () => this._buildRoot());
    }

    showHelp() {
        return this._open(true, 'menu.help', () => this._buildHelp());
    }

    // --- Pages ---

    _buildRoot() {
        const list = this._addList();
        this._addTopic(list, 'options.display', 'display.');
        this._addTopic(list, 'options.sound', 'sound.');
        this._addTopic(list, 'options.multiplayer', 'multiplayer.');
        this._nav.addItemIn(list, appTranslator.get('options.controls'), () => this._pushPage('options.controls', () => this._buildControls()));
        this._nav.addItemIn(list, appTranslator.get('options.reset'), () => this._confirmReset());
        this._nav.addItemIn(list, appTranslator.get('options.clearBestTimes'), () => this._confirmClearBestTimes());
        this._nav.selectFirst();
    }

    _addTopic(list, titleCode, prefix) {
        this._nav.addItemIn(list, appTranslator.get(titleCode), () => this._pushPage(titleCode, () => this._buildSettingsList(racingSettings.getDefinitions(prefix))));
    }

    // The device line, then the settings of the device in use; the page follows a gamepad plugged in or out.
    _buildControls() {
        const padOn  = this._gamepad.isAvailable();
        const list   = this._addList();
        const device = this._nav.addItemIn(list, appTranslator.get('settings.controls.device'), () => {
            this._stepDevice(1);
        }, (dir) => {
            this._stepDevice(dir);
        });
        AppMenuDom.addText(device, 'app-menu-item-value', this._deviceChoiceLabel(RacingControls.deviceChoice(padOn)));

        this._shownDevices = this._devicesState();
        for (const definition of racingSettings.getDefinitions(RacingOptionsModal.SETTING_PREFIXES[RacingControls.deviceInUse(padOn)])) {
            this._addSettingItem(list, definition);
        }
        this._nav.selectFirst();

        this._setPageTimer(() => {
            if (this._devicesState() !== this._shownDevices) {
                this._renderPage();
            }
        }, RacingOptionsModal.DEVICE_REFRESH_MS);
    }

    // The settings listed below follow the device: the page is rebuilt.
    _stepDevice(dir) {
        const padOn   = this._gamepad.isAvailable();
        const choices = [RacingSettings.DEVICE_AUTO, ...RacingControls.availableDevices(padOn)];
        const index   = choices.indexOf(RacingControls.deviceChoice(padOn));
        racingSettings.set(RacingSettings.DEVICE_KEY, choices[((index + dir + choices.length) % choices.length)]);
        this._renderPage();
    }

    // What the page shows depends on: the devices offered, the one in use, the gamepad's name.
    _devicesState() {
        const padOn = this._gamepad.isAvailable();

        return [RacingControls.availableDevices(padOn).join(','), RacingControls.deviceInUse(padOn), (this._gamepad.getName() ?? '')].join('|');
    }

    _deviceChoiceLabel(choice) {
        if (choice === RacingSettings.DEVICE_AUTO) {
            return appTranslator.get('device.auto', {device: this._deviceLabel(RacingControls.deviceInUse(this._gamepad.isAvailable()))});
        }

        return this._deviceLabel(choice);
    }

    _deviceLabel(device) {
        if (device === RacingSettings.DEVICE_VIRTUAL_PAD) {
            return appTranslator.get('device.virtualPad');
        }
        if (device === RacingSettings.DEVICE_GAMEPAD) {
            return appTranslator.get('device.gamepad', {name: AppInputGamepad.displayName(this._gamepad.getName() ?? '')});
        }

        return appTranslator.get('device.keyboard');
    }

    // Wipes every saved setting after a confirmation.
    _confirmReset() {
        this._confirm(appTranslator.get('options.resetConfirm'), () => {
            racingSettings.resetAll();
            this._applySettings();
            this._renderPage();
        }, null, appTranslator.get('menu.back'));
    }

    // Wipes every best time after a confirmation; the settings stay.
    _confirmClearBestTimes() {
        this._confirm(appTranslator.get('options.clearBestTimesConfirm'), () => {
            racingBestTimes.clearAll().catch((error) => {
                new AppMenuModal(this._display).showError(appTranslator.get('options.clearBestTimesFailed'), error.message);
            });
        }, null, appTranslator.get('menu.back'));
    }

    // The current binding of every action, device by device, then About.
    _buildHelp() {
        this._addBindings(appTranslator.get('device.keyboard'), 'keyboard.');
        this._addBindings(appTranslator.get('device.gamepadAny'), 'pad.');
        this._addLines(['help.pauseKey']);
        this._addHeading(appTranslator.get('help.about'));
        this._addLines(['help.about.what', 'help.about.sega', 'help.about.author']);
        this._addLines(['help.about.copyright'], {year: new Date().getFullYear()});
    }

    // --- Settings hooks ---

    _applySettings() {
        racingSettings.applyToTranslator(appTranslator);
    }

    _rebuildsPage(definition) {
        return (definition.key === RacingSettings.LANGUAGE_KEY);
    }
}

RacingOptionsModal.DEVICE_REFRESH_MS = 500;
// Settings key prefix of each device.
RacingOptionsModal.SETTING_PREFIXES  = {[RacingSettings.DEVICE_KEYBOARD]: 'keyboard.', [RacingSettings.DEVICE_GAMEPAD]: 'pad.', [RacingSettings.DEVICE_VIRTUAL_PAD]: 'virtual_pad.'};

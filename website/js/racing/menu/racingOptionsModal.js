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
        this._inGame       = false;
    }

    // Opened from the race pause: the multiplayer settings are left out, as doom_js does in game.
    setInGame(inGame) {
        this._inGame = (inGame === true);

        return this;
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
        this._addTopic(list, 'options.race', 'race.');
        this._addTopic(list, 'options.sound', 'sound.');
        if (!this._inGame) {
            this._addTopic(list, 'options.multiplayer', 'multiplayer.');
        }
        this._nav.addItemIn(list, appTranslator.get('options.controls'), () => this._pushPage('options.controls', () => this._buildControls()));
        this._nav.addItemIn(list, appTranslator.get('options.reset'), () => this._confirmReset());
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

    // How a race goes, then About; the controls themselves are in the options.
    _buildHelp() {
        for (const [heading, lines] of RacingOptionsModal.HELP) {
            this._addHeading(appTranslator.get(heading));
            this._addLines(lines);
        }
        this._addHeading(appTranslator.get('help.about'));
        this._addLines(['help.about.what', 'help.about.sega', 'help.about.commercial', 'help.about.author']);
        this._addLines(['help.about.copyright'], {year: new Date().getFullYear()});
    }

    // --- Settings hooks ---

    _applySettings() {
        racingSettings.applyToTranslator(appTranslator);
        racingSound.applyVolume();
    }

    _rebuildsPage(definition) {
        return (definition.key === RacingSettings.LANGUAGE_KEY);
    }
}

RacingOptionsModal.DEVICE_REFRESH_MS = 500;
// The help page: each heading and its lines.
RacingOptionsModal.HELP = [
    ['help.race', ['help.race.solo', 'help.race.laps']],
    ['help.start', ['help.start.pits', 'help.start.lights']],
    ['help.times', ['help.times.lap', 'help.times.checkpoints', 'help.times.records']],
    ['help.driving', ['help.driving.gearbox', 'help.driving.grip', 'help.driving.walls', 'help.driving.reverse', 'help.driving.views', 'help.pauseKey']],
    ['help.damage', ['help.damage.crash', 'help.damage.pits', 'help.damage.noPits']],
    ['help.finish', ['help.finish.results']],
];
// Settings key prefix of each device.
RacingOptionsModal.SETTING_PREFIXES  = {[RacingSettings.DEVICE_KEYBOARD]: 'keyboard.', [RacingSettings.DEVICE_GAMEPAD]: 'pad.', [RacingSettings.DEVICE_VIRTUAL_PAD]: 'virtual_pad.'};

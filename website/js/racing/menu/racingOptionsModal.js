/**
 * Options modal of the menus: show() opens the tabs (display, race, sound,
 * multiplayer outside a race, controls) with the reset button, showHelp()
 * opens the standalone help page. Adds to AppMenuSettingsModal the Controls
 * tab (device choice, then the settings of the device in use; their key,
 * button and axis captures are the socle's).
 */
class RacingOptionsModal extends AppMenuSettingsModal {
    /**
     * @param {AppMenuDisplay} display
     */
    constructor(display) {
        super(display, racingSettings);

        this._gamepad        = new AppInputGamepad();
        this._shownDevices   = null;
        this._inGame         = false;
        this._rendererLocked = false;
    }

    // Opened from the race pause: the multiplayer settings are left out, as doom_js does in game.
    setInGame(inGame) {
        this._inGame = (inGame === true);

        return this;
    }

    /**
     * In a multiplayer session the renderer is WebGL whatever the setting: it is not offered, as doom_js does.
     *
     * @param {boolean} locked
     */
    setRendererLocked(locked) {
        this._rendererLocked = (locked === true);

        return this;
    }

    show() {
        const tabs = [
            this._settingsTab('options.display', 'display.'),
            this._settingsTab('options.race', 'race.'),
            this._settingsTab('options.sound', 'sound.')
        ];
        if (!this._inGame) {
            tabs.push(this._settingsTab('options.multiplayer', 'multiplayer.'));
        }
        tabs.push({titleCode: 'options.controls', builder: () => this._buildControls()});

        return this._openTabs('menu.options', tabs, {labelCode: 'options.reset', action: () => this._confirmReset()});
    }

    // The multiplayer settings alone, from the Multiplayer screen and the pause's Multiplayer menu.
    showMultiplayer() {
        return this._open(true, 'multiplayer.options', () => this._buildSettingsList(racingSettings.getDefinitions('multiplayer.')));
    }

    showHelp() {
        return this._open(true, 'menu.help', () => this._buildHelp());
    }

    // --- Pages ---

    _settingsTab(titleCode, prefix) {
        return {titleCode: titleCode, builder: () => this._buildSettingsList(racingSettings.getDefinitions(prefix)
            .filter((definition) => (!this._rendererLocked || (definition.key !== RacingOptionsModal.RENDERER_KEY))))};
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
        AppMenuDom.addValue(device, this._deviceChoiceLabel(RacingControls.deviceChoice(padOn)), true);

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
        }, null, null, true, appTranslator.get('options.resetDetail'));
    }

    // How a race goes, then About; the controls themselves are in the options.
    _buildHelp() {
        for (const [heading, lines] of RacingOptionsModal.HELP) {
            this._addHeading(appTranslator.get(heading));
            this._addLines(lines);
        }
        this._addHeading(appTranslator.get('help.about'));
        this._addLines(['help.about.what', 'help.about.sega', 'help.about.commercial', 'help.about.author', 'help.about.font']);
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
RacingOptionsModal.RENDERER_KEY      = 'display.renderer';
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

/**
 * Persistent game settings, stored in the `setting` store of the spipuracing
 * IndexedDB base. The settings UI is built from DEFINITIONS; the game reads the
 * dedicated getters.
 */
class RacingSettings extends AppSettings {
    static get DEFINITIONS() {
        return [
            {key: 'display.language',     nameCode: 'settings.display.language',       type: 'list', default: 'en', values: [{code: 'en', label: 'English'}, {code: 'fr', label: 'Français'}, {code: 'it', label: 'Italiano'}, {code: 'es', label: 'Español'}]},
            // Codes must match the keys of Object3dRendererList.
            {key: 'display.renderer',     nameCode: 'settings.display.renderer',       type: 'list', default: 'webgl', values: [{code: 'webgl', label: 'WebGL'}, {code: 'full', labelCode: 'value.renderer.softwareTextured'}, {code: 'flat', labelCode: 'value.renderer.softwareFlat'}, {code: 'fast', labelCode: 'value.renderer.softwareWireframe'}]},
            {key: 'display.show_fps',     nameCode: 'settings.display.showFps',        type: 'bool', default: false},
            // 'auto' follows the language: mph in English, km/h otherwise.
            {key: 'display.speed_unit',   nameCode: 'settings.display.speedUnit',      type: 'list', default: RacingSettings.SPEED_UNIT_AUTO, values: [{code: RacingSettings.SPEED_UNIT_AUTO, labelCode: 'value.speedUnit.auto'}, {code: RacingSettings.SPEED_UNIT_KMH, label: 'km/h'}, {code: RacingSettings.SPEED_UNIT_MPH, label: 'mph'}]},
            {key: 'race.laps',            nameCode: 'settings.race.laps',              type: 'list', default: RacingSettings.DEFAULT_LAPS, values: RacingSettings.LAPS_VALUES},
            {key: 'sound.volume_effects', nameCode: 'settings.sound.volumeEffects',    type: 'list', default: '100', values: RacingSettings.VOLUME_VALUES},
            {key: 'multiplayer.nickname', nameCode: 'settings.multiplayer.nickname',   type: 'text', default: '', charset: RacingSettings.NICKNAME_CHARSET, maxLength: RacingSettings.NICKNAME_MAX_LENGTH},
            // Laps of the races the main hosts (phase 8).
            {key: 'multiplayer.laps',     nameCode: 'settings.multiplayer.laps',       type: 'list', default: RacingSettings.DEFAULT_LAPS, values: RacingSettings.LAPS_VALUES},
            // The Controls page offers the devices available only; a device not available counts as the automatic choice.
            {key: 'controls.device',      nameCode: 'settings.controls.device',        type: 'list', default: RacingSettings.DEVICE_AUTO, values: [{code: RacingSettings.DEVICE_AUTO, labelCode: 'device.automatic'}, {code: RacingSettings.DEVICE_KEYBOARD, labelCode: 'device.keyboard'}, {code: RacingSettings.DEVICE_GAMEPAD, labelCode: 'device.gamepadAny'}, {code: RacingSettings.DEVICE_VIRTUAL_PAD, labelCode: 'device.virtualPad'}]},
            // One physical key per action (Escape stays the fixed key leaving the race).
            {key: 'keyboard.steer_left',  nameCode: 'settings.action.steerLeft',       type: 'char', default: 'ArrowLeft',  action: 'steerLeft'},
            {key: 'keyboard.steer_right', nameCode: 'settings.action.steerRight',      type: 'char', default: 'ArrowRight', action: 'steerRight'},
            {key: 'keyboard.accelerate',  nameCode: 'settings.action.accelerate',      type: 'char', default: 'ArrowUp',    action: 'accelerate'},
            {key: 'keyboard.brake',       nameCode: 'settings.action.brake',           type: 'char', default: 'ArrowDown',  action: 'brake'},
            {key: 'keyboard.view',        nameCode: 'settings.action.view',            type: 'char', default: 'KeyC',       action: 'view'},
            {key: 'keyboard.gear_up',     nameCode: 'settings.action.gearUp',          type: 'char', default: 'KeyE',       action: 'gearUp'},
            {key: 'keyboard.gear_down',   nameCode: 'settings.action.gearDown',        type: 'char', default: 'KeyQ',       action: 'gearDown'},
            // W3C standard gamepad layout: stick X = axis 0, R2 = 7, L2 = 6, triangle = 3, R1 = 5, L1 = 4, start = 9.
            {key: 'pad.steer',            nameCode: 'settings.action.steer',           type: 'padAxis',   default: '+0', action: 'steer', direction: 'right'},
            {key: 'pad.accelerate',       nameCode: 'settings.action.accelerate',      type: 'padButton', default: 7,    action: 'accelerate'},
            {key: 'pad.brake',            nameCode: 'settings.action.brake',           type: 'padButton', default: 6,    action: 'brake'},
            {key: 'pad.view',             nameCode: 'settings.action.view',            type: 'padButton', default: 3,    action: 'view'},
            {key: 'pad.gear_up',          nameCode: 'settings.action.gearUp',          type: 'padButton', default: 5,    action: 'gearUp'},
            {key: 'pad.gear_down',        nameCode: 'settings.action.gearDown',        type: 'padButton', default: 4,    action: 'gearDown'},
            {key: 'pad.pause',            nameCode: 'settings.action.pause',           type: 'padButton', default: 9,    action: 'pause'}
        ];
    }

    constructor() {
        super(RacingSettings.DEFINITIONS, RacingDatabaseSchema.SETTING, RacingDatabaseSchema.SETTING_BY_KEY);
    }

    applyToTranslator(translator) {
        translator.setLanguage(this.getDisplayLanguage());

        return this;
    }

    // --- Dedicated getters (game side) ---

    getDisplayLanguage() {
        return this.get(RacingSettings.LANGUAGE_KEY);
    }

    getRenderer() {
        return this.get('display.renderer');
    }

    isFpsShown() {
        return (this.get('display.show_fps') === true);
    }

    /**
     * @returns {string} RacingSettings.SPEED_UNIT_KMH or RacingSettings.SPEED_UNIT_MPH
     */
    getSpeedUnit() {
        const unit = this.get('display.speed_unit');
        if (unit !== RacingSettings.SPEED_UNIT_AUTO) {
            return unit;
        }

        return ((this.getDisplayLanguage() === 'en') ? RacingSettings.SPEED_UNIT_MPH : RacingSettings.SPEED_UNIT_KMH);
    }

    /**
     * @returns {string} RacingSettings.DEVICE_AUTO, DEVICE_KEYBOARD, DEVICE_GAMEPAD or DEVICE_VIRTUAL_PAD, as saved
     */
    getControlsDevice() {
        return this.get(RacingSettings.DEVICE_KEY);
    }

    getEffectsVolume() {
        return this.getPercent('sound.volume_effects');
    }

    getNickname() {
        return this.get('multiplayer.nickname');
    }

    getSoloLaps() {
        return parseInt(this.get('race.laps'), 10);
    }

    // Set by the main for every player.
    getMultiplayerLaps() {
        return parseInt(this.get('multiplayer.laps'), 10);
    }
}

RacingSettings.SPEED_UNIT_AUTO     = 'auto';
RacingSettings.SPEED_UNIT_KMH      = 'kmh';
RacingSettings.SPEED_UNIT_MPH      = 'mph';
RacingSettings.DEVICE_AUTO         = 'auto';
RacingSettings.DEVICE_KEYBOARD     = 'keyboard';
RacingSettings.DEVICE_GAMEPAD      = 'gamepad';
RacingSettings.DEVICE_VIRTUAL_PAD  = 'virtualGamepad';
RacingSettings.LANGUAGE_KEY        = 'display.language';
RacingSettings.DEVICE_KEY          = 'controls.device';
RacingSettings.VOLUME_VALUES       = AppSettings.percentValues([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
RacingSettings.NICKNAME_CHARSET    = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -';
RacingSettings.NICKNAME_MAX_LENGTH = 16;
// Laps of a race: the original offers 5 to 20 in Time Attack, longer races added (user request 2026-10-13).
RacingSettings.LAPS_VALUES         = ['5', '10', '15', '20', '30', '50'].map((code) => ({code: code, label: code}));
RacingSettings.DEFAULT_LAPS        = '5';

const racingSettings = new RacingSettings();

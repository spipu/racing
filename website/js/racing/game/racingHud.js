/**
 * In-race overlay: the frame rate when the setting asks for it (bottom centre).
 */
class RacingHud extends AbstractHud {
    constructor(engine) {
        super(engine);

        this._fpsEl      = null;
        this._fpsValueEl = null;
        this._fpsShown   = null;
    }

    init(container) {
        super.init(container);
        const root = document.createElement('div');
        root.className             = 'racing-hud';
        this._fpsEl                = document.createElement('div');
        this._fpsEl.className      = 'racing-hud-fps';
        this._fpsValueEl           = document.createElement('div');
        this._fpsValueEl.className = 'racing-hud-fps-value';
        this._fpsEl.appendChild(this._fpsValueEl);
        root.appendChild(this._fpsEl);
        container.appendChild(root);
    }

    update() {
        if (this._fpsEl === null) {
            return;
        }
        const visible = racingSettings.isFpsShown();
        this._fpsEl.style.display = ((visible) ? '' : 'none');
        const fps = this._engine.getFps();
        // The text is rewritten only when the value changes.
        if (visible && (fps !== this._fpsShown)) {
            this._fpsShown               = fps;
            this._fpsValueEl.textContent = appTranslator.get('hud.fps', {value: fps});
        }
    }
}

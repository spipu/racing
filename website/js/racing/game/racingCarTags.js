/**
 * The nickname over each other player's car (user decision): a discreet label in the colour of its slot, over the car
 * as the camera sees it, fading out with the distance; never over the viewed car. Laid on the display under the HUD,
 * rebuilt with it (a renderer change); a label is written only when it changes.
 */
class RacingCarTags {
    /**
     * @param {function(int): string} nicknameOf - '' leaves the car without a label
     */
    constructor(nicknameOf) {
        this._nicknameOf = nicknameOf;
        this._root       = null;
        this._tags       = new Map();   // player id → {el, nickname, shown, left, top, opacity, frame}
        this._frame      = 0;
    }

    /**
     * @param {HTMLElement} display - the letterboxed display, the canvas filling it
     * @param {HTMLElement} canvas  - the labels go right over it, under the HUD
     */
    build(display, canvas) {
        this._root = document.createElement('div');
        this._root.className = 'racing-car-tags';
        display.insertBefore(this._root, canvas.nextSibling);
        this._tags = new Map();

        return this;
    }

    /**
     * @param {Engine3d} engine - its camera set for the frame
     * @param {{id: int, tag: number[]}[]} cars - the other cars, the point over each in camera space
     */
    update(engine, cars) {
        this._frame++;
        for (const car of cars) {
            const nickname = this._nicknameOf(car.id);
            if (nickname !== '') {
                this._place(this._tagOf(car.id, nickname), engine, car.tag);
            }
        }
        for (const [id, tag] of this._tags) {
            if (tag.frame !== this._frame) {
                tag.el.remove();
                this._tags.delete(id);
            }
        }
    }

    _place(tag, engine, point) {
        const [cx, cy, cz] = point;
        const distance     = Math.hypot(cx, cy, cz);
        const fading       = ((RacingCarTags.FAR - distance) / (RacingCarTags.FAR - RacingCarTags.FADE_FROM));
        const opacity      = Math.max(0, Math.min(1, fading));
        const shown        = ((cz > RacingCarTags.NEAR) && (opacity > 0));
        tag.frame = this._frame;
        if (shown !== tag.shown) {
            tag.shown            = shown;
            tag.el.style.display = ((shown) ? '' : 'none');
        }
        if (!shown) {
            return;
        }
        // The engine's projection (Object3dRendererFull), as a share of the screen.
        const x    = (((engine.projScaleX * cx) / cz) - engine.projOffsetX);
        const y    = (((-engine.projScaleY * cy) / cz) - engine.projOffsetY);
        const left = RacingCarTags._rounded((x * RacingCarTags.PERCENT) / engine.scrWidth);
        const top  = RacingCarTags._rounded((y * RacingCarTags.PERCENT) / engine.scrHeight);
        const fade = RacingCarTags._rounded(opacity);
        if (left !== tag.left) {
            tag.left          = left;
            tag.el.style.left = (left + '%');
        }
        if (top !== tag.top) {
            tag.top          = top;
            tag.el.style.top = (top + '%');
        }
        if (fade !== tag.opacity) {
            tag.opacity          = fade;
            tag.el.style.opacity = String(fade);
        }
    }

    _tagOf(id, nickname) {
        let tag = this._tags.get(id);
        if (tag === undefined) {
            const el = AppMenuDom.addElement(this._root, 'div', 'racing-car-tag');
            el.style.color = RacingCarColors.cssOfSlot(id);
            tag = {el: el, nickname: null, shown: true, left: null, top: null, opacity: null, frame: 0};
            this._tags.set(id, tag);
        }
        if (nickname !== tag.nickname) {
            tag.nickname       = nickname;
            tag.el.textContent = nickname;
        }

        return tag;
    }

    // To the hundredth: a smaller step is not seen, and would rewrite the style every frame.
    static _rounded(value) {
        return (Math.round(value * RacingCarTags.ROUNDING) / RacingCarTags.ROUNDING);
    }
}

// Metres from the camera: the label is full up to FADE_FROM, gone at FAR; none closer than NEAR.
RacingCarTags.NEAR      = 1;
RacingCarTags.FADE_FROM = 40;
RacingCarTags.FAR       = 150;
RacingCarTags.ROUNDING  = 100;
RacingCarTags.PERCENT   = 100;

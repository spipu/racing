/**
 * The nickname over each other player's car (user decision): a discreet label in the colour of its slot, over the car
 * as the camera sees it, fading out with the distance; never over the viewed car. Laid on the display as plain
 * elements, rebuilt with it (a renderer change).
 */
class RacingCarTags {
    /**
     * @param {function(int): string} nicknameOf - '' leaves the car without a label
     */
    constructor(nicknameOf) {
        this._nicknameOf = nicknameOf;
        this._root       = null;
        this._tags       = new Map();   // player id → {el, shown}
    }

    /**
     * @param {HTMLElement} display - the letterboxed display, the canvas filling it
     */
    build(display) {
        this._root = AppMenuDom.addElement(display, 'div', 'racing-car-tags');
        this._tags = new Map();

        return this;
    }

    /**
     * @param {Engine3d} engine - its camera set for the frame
     * @param {{id: int, camera: number[]}[]} cars - the other cars, the point over each in camera space
     */
    update(engine, cars) {
        const seen = new Set();
        for (const car of cars) {
            const nickname = this._nicknameOf(car.id);
            if (nickname === '') {
                continue;
            }
            seen.add(car.id);
            const tag = this._tag(car.id, nickname);
            const [cx, cy, cz] = car.camera;
            const distance = Math.hypot(cx, cy, cz);
            const opacity  = Math.max(0, Math.min(1, ((RacingCarTags.FAR - distance) / (RacingCarTags.FAR - RacingCarTags.FADE_FROM))));
            const shown    = ((cz > RacingCarTags.NEAR) && (opacity > 0));
            if (shown !== tag.shown) {
                tag.shown            = shown;
                tag.el.style.display = ((shown) ? '' : 'none');
            }
            if (!shown) {
                continue;
            }
            const x = (((engine.projScaleX * cx) / cz) - engine.projOffsetX);
            const y = (((-engine.projScaleY * cy) / cz) - engine.projOffsetY);
            tag.el.style.left    = (((x * 100) / engine.scrWidth) + '%');
            tag.el.style.top     = (((y * 100) / engine.scrHeight) + '%');
            tag.el.style.opacity = String(opacity);
        }
        for (const [id, tag] of this._tags) {
            if (!seen.has(id)) {
                tag.el.remove();
                this._tags.delete(id);
            }
        }
    }

    _tag(id, nickname) {
        let tag = this._tags.get(id);
        if (tag === undefined) {
            tag = {el: AppMenuDom.addText(this._root, 'racing-car-tag', nickname), shown: true};
            tag.el.style.color = RacingCarColors.cssOfSlot(id);
            this._tags.set(id, tag);
        }

        return tag;
    }
}

// Metres from the camera: the label is full up to FADE_FROM, gone at FAR; none closer than NEAR.
RacingCarTags.NEAR      = 1;
RacingCarTags.FADE_FROM = 40;
RacingCarTags.FAR       = 150;

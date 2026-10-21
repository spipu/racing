/**
 * In-race overlay: the information of the original Time Attack HUD in blocks
 * in the corners, sized in cqh of the letterbox (race.md § HUD):
 *   - top left: the rev counter of the car (needle from the smoothed rpm +$7E,
 *     $B06A: a quarter turn from 6000 rpm, its own scale by car), as wide as
 *     the block below it (user request): both in one left column;
 *   - top right: the course, then under it (user request) the fastest lap
 *     (the record of the course and car), the lap time, then the times of the
 *     last laps done (user request): both in one right column; the times as
 *     wide as their longest line in any language, whatever the laps done;
 *   - left, under the rev counter (user request): the lap of the race, the
 *     speed (km/h or mph), the gear with every gearbox, "(A)" beside it in
 *     automatic (the original shows it with a manual one only: user request);
 *   - right, under the times with the last laps all shown, as wide as the
 *     times (user request): the map of the course (RacingHudMap), when the
 *     setting shows it;
 *   - centre: the start (PIT START, 3, 2, 1, GO!, the READY lights), REVERSE,
 *     PIT WORK, the lap message and the checkpoint split, blinking as the
 *     original does; the blinds of the opening and of the finish over all;
 *   - bottom centre: the frame rate when the setting asks for it.
 */
class RacingHud extends AbstractHud {
    constructor(engine) {
        super(engine);

        this._race    = null;
        this._state   = null;
        this._car     = null;
        this._course  = '';
        this._manual  = false;
        this._map     = null;
        this._ping    = null;   // () => round trip in ms or null, during a session
        this._outcome = null;   // RacingRaceOutcome of a race of several players
        this._els     = {};
        this._shown   = {};
        this._lapsShown = -1;
    }

    /**
     * @param {RacingRaceControl} race  - the display of the race shown
     * @param {RacingCarState}    state - its car's
     * @param {{car: string, course: string, manual: boolean, map: RacingHudMap}} info - car code, course name, gearbox, map
     */
    bindRace(race, state, info) {
        this._race    = race;
        this._state   = state;
        this._car     = info.car;
        this._course  = info.course;
        this._manual  = info.manual;
        this._map     = info.map;

        return this;
    }

    /**
     * The ping beside the fps, as doom_js: the worst sub's on the main, the main's on a sub.
     *
     * @param {function(): (number|null)|null} source - null outside a session
     */
    bindPingSource(source) {
        this._ping = source;

        return this;
    }

    /**
     * The time left after the first finish, shown to a player still racing (user decision).
     *
     * @param {RacingRaceOutcome|null} outcome
     */
    bindOutcome(outcome) {
        this._outcome = outcome;

        return this;
    }

    init(container) {
        super.init(container);
        const root = this._add(container, 'racing-hud');
        const els  = this._els;
        els.root   = root;

        const left  = this._add(root, 'racing-hud-left');
        const right = this._add(root, 'racing-hud-right');

        els.tach   = this._add(left, 'racing-hud-block racing-hud-tach');
        this._buildTach(els.tach);

        els.course = this._add(right, 'racing-hud-block racing-hud-course');

        const stack = this._add(right, 'racing-hud-times-stack');
        const times = this._add(stack, 'racing-hud-block racing-hud-times');
        this._add(times, 'racing-hud-label', appTranslator.get('hud.fastestLap'));
        els.record  = this._add(times, 'racing-hud-time racing-hud-record');
        this._add(times, 'racing-hud-label', appTranslator.get('hud.lapTime'));
        els.lapTime = this._add(times, 'racing-hud-time');
        els.lastLaps = this._add(times, 'racing-hud-last-laps');
        this._lapsShown = -1;
        // Hidden, no height: the longest lap line of every language gives the block its width, the same in all.
        for (const label of Object.values(RacingTranslations.CATALOG['hud.lapOf'])) {
            const sizer = this._add(times, 'racing-hud-last-lap racing-hud-sizer');
            this._add(sizer, 'racing-hud-label', label.replace('{lap}', String(RacingSettings.MAX_LAPS)));
            this._add(sizer, 'racing-hud-last-lap-time', RacingHud.SIZER_TIME);
        }

        const status = this._add(left, 'racing-hud-block racing-hud-status');
        const lapRow = this._add(status, 'racing-hud-row');
        this._add(lapRow, 'racing-hud-label', appTranslator.get('hud.laps'));
        els.lap      = this._add(lapRow, 'racing-hud-value');
        els.laps     = this._add(lapRow, 'racing-hud-unit racing-hud-laps');
        const speedRow = this._add(status, 'racing-hud-row');
        this._add(speedRow, 'racing-hud-label', appTranslator.get('hud.speed'));
        els.speed    = this._add(speedRow, 'racing-hud-value racing-hud-speed');
        els.unit     = this._add(speedRow, 'racing-hud-unit');
        els.gearRow  = this._add(status, 'racing-hud-row');
        this._add(els.gearRow, 'racing-hud-label', appTranslator.get('hud.gear'));
        els.gear     = this._add(els.gearRow, 'racing-hud-value racing-hud-gear');
        els.gearbox  = this._add(els.gearRow, 'racing-hud-unit');

        els.map = this._add(stack, 'racing-hud-map');
        this._map.build(els.map);

        const centre = this._add(root, 'racing-hud-centre');
        els.sign     = this._add(centre, 'racing-hud-sign');
        els.lights   = this._add(centre, 'racing-hud-lights');
        els.ready    = this._add(els.lights, 'racing-hud-ready', appTranslator.get('hud.ready'));
        els.lamps    = [RacingHud.ROW_RED, RacingHud.ROW_GREEN].map(() => {
            const row = this._add(els.lights, 'racing-hud-lamps');
            return Array.from({length: RacingHud.LAMPS}, () => this._add(row, 'racing-hud-lamp'));
        });
        els.notice   = this._add(centre, 'racing-hud-notice');
        els.finishIn = this._add(centre, 'racing-hud-finish-in');
        els.pitStart = this._add(root, 'racing-hud-pit-start', appTranslator.get('hud.start.pitStart'));
        els.message  = this._add(centre, 'racing-hud-message');
        els.messageLabel = this._add(els.message, 'racing-hud-message-label');
        els.messageTime  = this._add(els.message, 'racing-hud-message-time');
        els.split    = this._add(centre, 'racing-hud-split');

        els.blinds = this._add(root, 'racing-hud-blinds');
        els.slats  = Array.from({length: RacingHud.SLATS}, () => this._add(els.blinds, 'racing-hud-slat'));

        els.fps      = this._add(root, 'racing-hud-fps');
        els.fpsValue = this._add(els.fps, 'racing-hud-fps-value');
    }

    /**
     * Hides the HUD (the results over the race), the frame counter aside.
     * @param {boolean} visible
     */
    setVisible(visible) {
        this._els.root.classList.toggle('racing-hud-hidden', !visible);

        return this;
    }

    update() {
        const els = this._els;
        if (els.fps === undefined) {
            return;
        }
        this._updateFps();
        if ((this._race === null) || (this._state === null)) {
            return;
        }
        const race  = this._race;
        const state = this._state;

        this._needle(state.smoothRpm);
        this._text('lapTime', RacingTime.format(race.lapMs));
        this._text('record', RacingTime.format((race.record === null) ? null : race.record.lapMs));
        this._updateLastLaps(race.lapTimes);
        this._text('lap', String(Math.min((state.lap + 1), race.laps)));
        this._text('laps', '/' + race.laps);
        const mph = (racingSettings.getSpeedUnit() === RacingSettings.SPEED_UNIT_MPH);
        this._text('speed', String(Math.round(mph ? (state.displaySpeed * RacingHud.MPH_PER_KMH) : state.displaySpeed)));
        this._text('unit', (mph ? 'mph' : 'km/h'));
        this._text('gear', String(state.gear + 1));
        this._text('gearbox', (this._manual ? '' : appTranslator.get('hud.automatic')));
        this._text('course', this._course);
        const mapShown = racingSettings.isMapShown();
        this._display('map', mapShown);
        if (mapShown) {
            this._map.update();
        }

        this._updateStart(race);
        let notice = null;
        if (race.reverse && race.isBlinkOn(false)) {
            notice = appTranslator.get('hud.reverse');
        } else if (race.pitWork && race.isBlinkOn(true)) {
            notice = appTranslator.get('hud.pitWork');
        }
        this._text('notice', (notice ?? ''));
        this._display('notice', (notice !== null));
        const countdown = (((this._outcome !== null) && !race.finished) ? this._outcome.countdownMs : null);
        this._display('finishIn', (countdown !== null));
        if (countdown !== null) {
            this._text('finishIn', appTranslator.get('hud.finishIn', {seconds: Math.ceil(countdown / RacingGame.MS_PER_SECOND)}));
        }

        const message = race.message;
        this._display('message', ((message !== null) && message.shown));
        if (message !== null) {
            this._text('messageLabel', appTranslator.get('hud.message.' + message.kind));
            this._class('messageLabel', 'racing-hud-message-label racing-hud-message-' + message.kind);
            this._text('messageTime', RacingTime.format(message.ms));
        }
        const split = race.split;
        this._display('split', ((split !== null) && split.shown));
        if (split !== null) {
            this._text('split', ((split.ms > 0) ? '+' : ((split.ms < 0) ? '−' : '±')) + RacingTime.format(Math.abs(split.ms)));
            this._class('split', 'racing-hud-split ' + ((split.ms > 0) ? 'racing-hud-slower' : 'racing-hud-faster'));
        }
        this._updateBlinds(race.blinds);
    }

    // --- Parts ---

    _updateStart(race) {
        let sign = race.startSign;
        const pitStart = (race.pitStartSign && race.isBlinkOn(false));
        this._display('pitStart', pitStart);
        if ((sign === RacingRaceControl.SIGN_GO) && !race.isBlinkOn(true)) {
            sign = null;
        }
        const ready = (sign === RacingRaceControl.SIGN_READY);
        this._display('lights', ready);
        this._display('sign', ((sign !== null) && !ready));
        if ((sign !== null) && !ready) {
            this._text('sign', ((typeof sign === 'number') ? String(sign) : appTranslator.get('hud.start.' + sign)));
            this._class('sign', 'racing-hud-sign' + ((typeof sign === 'number') ? ' racing-hud-count' : ''));
        }
        if (ready) {
            this._els.lamps.forEach((row, r) => row.forEach((lamp) => {
                const red   = ((r === RacingHud.ROW_RED) && (race.lights === RacingRaceControl.LIGHTS_RED));
                const green = ((r === RacingHud.ROW_GREEN) && (race.lights === RacingRaceControl.LIGHTS_GREEN));
                lamp.className = 'racing-hud-lamp' + (red ? ' racing-hud-lamp-red' : '') + (green ? ' racing-hud-lamp-green' : '');
            }));
        }
    }

    // The last laps done, oldest first; rebuilt when a lap is added.
    _updateLastLaps(lapTimes) {
        if (lapTimes.length === this._lapsShown) {
            return;
        }
        this._lapsShown = lapTimes.length;
        const list  = this._els.lastLaps;
        const first = Math.max(0, (lapTimes.length - RacingHud.LAST_LAPS));
        list.textContent = '';
        for (let i = first; i < lapTimes.length; i++) {
            const row = this._add(list, 'racing-hud-last-lap');
            this._add(row, 'racing-hud-label', appTranslator.get('hud.lapOf', {lap: (i + 1)}));
            this._add(row, 'racing-hud-last-lap-time', RacingTime.format(lapTimes[i]));
        }
    }

    // A dial of a quarter turn: the needle from the top graduation (horizontal) to the bottom one.
    _buildTach(block) {
        const scale = RacingHud.TACH_SCALES[this._car] ?? RacingHud.TACH_SCALES.formula;
        const svg   = document.createElementNS(RacingHud.SVG, 'svg');
        svg.setAttribute('viewBox', RacingHud.DIAL_VIEW_BOX);
        svg.setAttribute('class', 'racing-hud-dial');
        const path = (d, cls) => {
            const el = document.createElementNS(RacingHud.SVG, 'path');
            el.setAttribute('d', d);
            el.setAttribute('class', cls);
            svg.appendChild(el);
        };
        const at = (angle, radius) => [(RacingHud.DIAL_X + (Math.cos(angle) * radius)), (RacingHud.DIAL_Y + (Math.sin(angle) * radius))];
        const arc = (from, to, radius) => {
            const [x1, y1] = at(from, radius);
            const [x2, y2] = at(to, radius);
            return 'M ' + x1 + ' ' + y1 + ' A ' + radius + ' ' + radius + ' 0 0 1 ' + x2 + ' ' + y2;
        };
        const steps = (scale.labels.length - 1);
        const quarter = (Math.PI / 2);
        const angle   = (i) => ((i / steps) * quarter);
        path(arc(0, quarter, RacingHud.DIAL_RADIUS), 'racing-hud-dial-arc');
        path(arc(angle(scale.red), quarter, RacingHud.DIAL_RADIUS), 'racing-hud-dial-red');
        scale.labels.forEach((label, i) => {
            const [x1, y1] = at(angle(i), (RacingHud.DIAL_RADIUS - RacingHud.DIAL_TICK_LENGTH));
            const [x2, y2] = at(angle(i), RacingHud.DIAL_RADIUS);
            path('M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2, ((i >= scale.red) ? 'racing-hud-dial-tick racing-hud-dial-tick-red' : 'racing-hud-dial-tick'));
            const [tx, ty] = at(angle(i), (RacingHud.DIAL_RADIUS - RacingHud.DIAL_LABEL_INSET));
            const text = document.createElementNS(RacingHud.SVG, 'text');
            text.setAttribute('x', String(tx));
            text.setAttribute('y', String(ty + RacingHud.DIAL_LABEL_BASELINE));
            text.setAttribute('class', 'racing-hud-dial-label');
            text.textContent = String(label);
            svg.appendChild(text);
        });
        const needle = document.createElementNS(RacingHud.SVG, 'line');
        needle.setAttribute('x1', String(RacingHud.DIAL_X));
        needle.setAttribute('y1', String(RacingHud.DIAL_Y));
        needle.setAttribute('x2', String(RacingHud.DIAL_X + RacingHud.DIAL_RADIUS - RacingHud.NEEDLE_GAP));
        needle.setAttribute('y2', String(RacingHud.DIAL_Y));
        needle.setAttribute('class', 'racing-hud-needle');
        svg.appendChild(needle);
        this._els.needle = needle;
        block.appendChild(svg);
        this._add(block, 'racing-hud-label racing-hud-tach-label', appTranslator.get('hud.rpm'));
    }

    // $B06A: $800 + min($800, 1.5 x (bound(+$7E - 6000, 0, 11000) >> 3)) in 1/8192 turn, $800 the top graduation.
    _needle(rpm) {
        const over   = (Math.min(Math.max((rpm - RacingHud.TACH_FROM), 0), RacingHud.TACH_SPAN) >> 3);
        const turn   = Math.min(RacingHud.TACH_QUARTER, (over + (over >> 1)));
        const degree = ((turn * 360) / RacingHud.TACH_TURN);
        const value  = degree.toFixed(1);
        if (this._shown.needle !== value) {
            this._shown.needle = value;
            this._els.needle.setAttribute('transform', 'rotate(' + value + ' ' + RacingHud.DIAL_X + ' ' + RacingHud.DIAL_Y + ')');
        }
    }

    _updateBlinds(closed) {
        const value = closed.toFixed(3);
        if (this._shown.blinds === value) {
            return;
        }
        this._shown.blinds = value;
        this._els.blinds.style.display = ((closed > 0) ? '' : 'none');
        this._els.blinds.className     = ((closed >= 1) ? 'racing-hud-blinds racing-hud-blinds-closed' : 'racing-hud-blinds');
        for (const slat of this._els.slats) {
            slat.style.transform = 'scaleY(' + value + ')';
        }
    }

    _updateFps() {
        const visible = racingSettings.isFpsShown();
        this._display('fps', visible);
        if (visible) {
            const fps  = this._engine.getFps();
            const ping = ((this._ping !== null) ? this._ping() : null);
            this._text('fpsValue', ((ping !== null)
                ? appTranslator.get('hud.fpsPing', {value: fps, ping: Math.round(ping)})
                : appTranslator.get('hud.fps', {value: fps})));
        }
    }

    // --- DOM, rewritten only on a change ---

    _add(parent, className, text = null) {
        const el = document.createElement('div');
        el.className = className;
        if (text !== null) {
            el.textContent = text;
        }
        parent.appendChild(el);

        return el;
    }

    _text(name, text) {
        if (this._shown[name + '.text'] !== text) {
            this._shown[name + '.text'] = text;
            this._els[name].textContent = text;
        }
    }

    _class(name, className) {
        if (this._shown[name + '.class'] !== className) {
            this._shown[name + '.class'] = className;
            this._els[name].className = className;
        }
    }

    _display(name, visible) {
        if (this._shown[name + '.display'] !== visible) {
            this._shown[name + '.display'] = visible;
            this._els[name].style.display = (visible ? '' : 'none');
        }
    }
}

RacingHud.SVG          = 'http://www.w3.org/2000/svg';
RacingHud.MPH_PER_KMH  = 0.621371;
RacingHud.LAMPS        = 5;
RacingHud.LAST_LAPS    = 5;
// Widest lap time the sizer line keeps room for (never shown).
RacingHud.SIZER_TIME   = '99\'99"999';
RacingHud.SLATS        = 12;
// Rev counter: 6000 rpm on the top graduation, a quarter turn ($800 / 8192) for 11000 more (reached about 16900).
RacingHud.TACH_FROM    = 6000;
RacingHud.TACH_SPAN    = 11000;
RacingHud.TACH_QUARTER = 0x800;
RacingHud.TACH_TURN    = 8192;
RacingHud.DIAL_X       = 10;
RacingHud.DIAL_Y       = 10;
RacingHud.DIAL_RADIUS  = 82;
// Dial drawing, in the units of its 100 x 100 view box.
RacingHud.DIAL_VIEW_BOX        = '0 0 100 100';
RacingHud.DIAL_TICK_LENGTH     = 6;
RacingHud.DIAL_LABEL_INSET     = 14;
RacingHud.DIAL_LABEL_BASELINE  = 3;
RacingHud.NEEDLE_GAP           = 2;
// Rows of the READY gantry.
RacingHud.ROW_RED      = 0;
RacingHud.ROW_GREEN    = 1;
// Graduations of each car's dial (x 1000 rpm) and the first one in the red (race.md § HUD).
RacingHud.TACH_SCALES  = {
    formula:   {labels: [6, 8, 10, 12, 14, 16], red: 4},
    stock:     {labels: [4, 5, 6, 7, 8, 9, 10], red: 5},
    prototype: {labels: [4, 6, 8, 10, 12, 14], red: 4},
};

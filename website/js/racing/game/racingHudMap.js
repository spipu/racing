/**
 * Map of the course on the HUD (race.md § HUD): the outline of the ROM ($15668),
 * fixed, scaled to fill its square, and each car on the track as a dot: alone
 * yellow, in a race of several players in the colour of its player's slot
 * (user decision), the viewed car over the others.
 *
 * Every course starts heading 0 (+z, start grids of race.json): +z drawn upwards
 * puts the start upwards (user decision, the original turns the map with the car).
 * The mirror flips x, as the scene. Outline and car in scenery units, the car
 * from its collision units (toScenery).
 */
class RacingHudMap {
    /**
     * @param {{v: number[], f: {i: number[]}[]}} model - course map of the export, in scenery units
     * @param {number[][]} racePath   - [x, z, speed] by progress, collision units; the first point is at the line
     * @param {number}     toScenery  - scenery units in one collision unit
     * @param {boolean}    mirror
     */
    constructor(model, racePath, toScenery, mirror) {
        this._model     = model;
        this._racePath  = racePath;
        this._toScenery = toScenery;
        this._side      = ((mirror) ? -1 : 1);
        this._svgEl     = null;
        this._size      = 0;
        this._dots      = new Map();   // player id → {el, x, y, frame}
        this._frame     = 0;           // counts the updates: a dot not placed in the last one is gone
        this._roster    = null;
        this._colored   = false;
    }

    /**
     * @param {RacingPlayerRoster} roster  - the cars on the track, the local player's viewed
     * @param {boolean}            colored - a race of several players: each dot in its slot's colour
     */
    bindPlayers(roster, colored) {
        this._roster  = roster;
        this._colored = colored;

        return this;
    }

    /**
     * Draws the map in the container, again after the HUD is rebuilt (renderer change).
     *
     * @param {HTMLElement} container
     */
    build(container) {
        const vertices = this._model.v;
        const points   = [];
        for (let i = 0; i < vertices.length; i += 3) {
            points.push(this._toScreen(vertices[i], vertices[i + 2]));
        }
        const xs   = points.map((point) => point[0]);
        const ys   = points.map((point) => point[1]);
        const size = (Math.max((Math.max(...xs) - Math.min(...xs)), (Math.max(...ys) - Math.min(...ys))) * (1 + (2 * RacingHudMap.MARGIN)));
        const left = (((Math.max(...xs) + Math.min(...xs)) - size) / 2);
        const top  = (((Math.max(...ys) + Math.min(...ys)) - size) / 2);

        const svg = this._svg(container, 'svg', 'racing-hud-map-svg');
        svg.setAttribute('viewBox', [left, top, size, size].map((value) => Math.round(value)).join(' '));
        // The same outline twice: a wide white stroke under the black fill leaves only the outer border white.
        const track   = this._trackPath(points);
        const outline = this._svg(svg, 'path', 'racing-hud-map-outline');
        outline.setAttribute('d', track);
        outline.setAttribute('stroke-width', String(Math.round(size * RacingHudMap.OUTLINE_WIDTH)));
        this._svg(svg, 'path', 'racing-hud-map-track').setAttribute('d', track);

        const ends  = this._startLine(size);
        const start = this._svg(svg, 'line', 'racing-hud-map-start');
        ['x1', 'y1', 'x2', 'y2'].forEach((name, i) => start.setAttribute(name, String(Math.round(ends[i]))));
        start.setAttribute('stroke-width', String(Math.round(size * RacingHudMap.START_WIDTH)));

        this._svgEl = svg;
        this._size  = size;
        this._dots  = new Map();
    }

    // Each car where its state stands; a car gone loses its dot, the viewed one is drawn last.
    update() {
        this._frame++;
        for (const player of this._roster.getAll()) {
            this._placeDot(player);
        }
        for (const [id, dot] of this._dots) {
            if (dot.frame !== this._frame) {
                dot.el.remove();
                this._dots.delete(id);
            }
        }
        const viewed = this._dots.get(this._roster.getLocal().getId()).el;
        if (this._svgEl.lastChild !== viewed) {
            this._svgEl.appendChild(viewed);
        }
    }

    _placeDot(player) {
        const dot   = this._dot(player);
        const state = player.getCarState();
        const cx    = Math.round(this._side * state.x * this._toScenery);
        const cy    = Math.round(-state.z * this._toScenery);
        dot.frame = this._frame;
        if ((cx !== dot.x) || (cy !== dot.y)) {
            dot.x = cx;
            dot.y = cy;
            dot.el.setAttribute('cx', String(cx));
            dot.el.setAttribute('cy', String(cy));
        }
    }

    _dot(player) {
        let dot = this._dots.get(player.getId());
        if (dot !== undefined) {
            return dot;
        }
        const el = this._svg(this._svgEl, 'circle', 'racing-hud-map-car');
        el.setAttribute('r', String(Math.round(this._size * RacingHudMap.CAR_RADIUS)));
        el.setAttribute('stroke-width', String(Math.round(this._size * RacingHudMap.CAR_OUTLINE)));
        if (this._colored) {
            el.style.fill = RacingCarColors.cssOfSlot(player.getId());
        }
        dot = {el: el, x: null, y: null, frame: 0};
        this._dots.set(player.getId(), dot);

        return dot;
    }

    // The cars in update() are placed the same way, without allocating.
    _toScreen(x, z) {
        return [(this._side * x), -z];
    }

    // One path of every face, all wound the same way: overlapping faces (Highland's crossing) add up under nonzero.
    _trackPath(points) {
        return this._model.f.map((face) => {
            const corners = face.i.map((index) => points[index]);
            let area = 0;
            corners.forEach((corner, k) => {
                const next = corners[(k + 1) % corners.length];
                area += ((corner[0] * next[1]) - (next[0] * corner[1]));
            });
            if (area < 0) {
                corners.reverse();
            }
            return 'M ' + corners.map((corner) => Math.round(corner[0]) + ' ' + Math.round(corner[1])).join(' L ') + ' Z';
        }).join(' ');
    }

    // Across the course at the first point of the racing line, square to its first segment.
    _startLine(size) {
        const [x0, y0] = this._toScreen((this._racePath[0][0] * this._toScenery), (this._racePath[0][1] * this._toScenery));
        const [x1, y1] = this._toScreen((this._racePath[1][0] * this._toScenery), (this._racePath[1][1] * this._toScenery));
        const length = Math.hypot((x1 - x0), (y1 - y0));
        const half   = (size * RacingHudMap.START_HALF_LENGTH);
        const across = [(-(y1 - y0) / length * half), ((x1 - x0) / length * half)];

        return [(x0 - across[0]), (y0 - across[1]), (x0 + across[0]), (y0 + across[1])];
    }

    _svg(parent, tag, className) {
        const el = document.createElementNS(RacingHudMap.SVG, tag);
        el.setAttribute('class', className);
        parent.appendChild(el);

        return el;
    }
}

RacingHudMap.SVG = 'http://www.w3.org/2000/svg';
// Room on each side, in parts of the outline's longest extent.
RacingHudMap.MARGIN            = 0.04;
// In parts of the side of the square.
RacingHudMap.OUTLINE_WIDTH     = 0.03;
RacingHudMap.CAR_RADIUS        = 0.03;
RacingHudMap.CAR_OUTLINE       = 0.008;
RacingHudMap.START_HALF_LENGTH = 0.035;
RacingHudMap.START_WIDTH       = 0.012;

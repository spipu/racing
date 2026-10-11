#!/usr/bin/env node
/**
 * Builds the standard icon set of the PWA model from website/icon/icon.svg, run from the repository root:
 *
 *   node tools/icon/buildIcons.js
 *
 * The SVG may only hold <rect> and <polygon> elements with a #RRGGBB fill (painted in order); each icon is
 * rasterised with IconBuilder.SUPERSAMPLING x IconBuilder.SUPERSAMPLING samples per pixel. favicon.ico holds the 48 x 48 PNG.
 */
const fs   = require('fs');
const path = require('path');

const {VrPngWriter} = require('../export/vrPngWriter');
const {IcoWriter}   = require('./icoWriter');

class IconBuilder {
    constructor(svg) {
        const viewBox = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
        if (viewBox === null) {
            throw new Error('icon.svg: viewBox "0 0 w h" expected');
        }
        this._width  = Number(viewBox[1]);
        this._height = Number(viewBox[2]);
        this._shapes = this._parseShapes(svg);
    }

    _parseShapes(svg) {
        const shapes = [];
        const elements = svg.replace(/<\?xml[^>]*>|<!--[\s\S]*?-->/g, '').match(/<[a-z][^>]*>/gi) ?? [];
        const unknown  = elements.find((element) => !/^<(svg|rect|polygon)\b/.test(element));
        if (unknown !== undefined) {
            throw new Error('icon.svg: only <rect> and <polygon> are painted, found ' + unknown);
        }
        for (const match of svg.matchAll(/<(rect|polygon)\b([^>]*)\/>/g)) {
            const attributes = Object.fromEntries([...match[2].matchAll(/(\w+)="([^"]*)"/g)].map((pair) => [pair[1], pair[2]]));
            const fill       = (attributes.fill ?? '').match(/^#([0-9A-Fa-f]{6})$/);
            if (fill === null) {
                throw new Error('icon.svg: #RRGGBB fill expected, got ' + attributes.fill);
            }
            const color = [0, 2, 4].map((i) => parseInt(fill[1].substr(i, 2), 16));
            if (match[1] === 'rect') {
                const [x, y, w, h] = ['x', 'y', 'width', 'height'].map((name) => Number(attributes[name]));
                shapes.push({color, points: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]});
                continue;
            }
            const numbers = attributes.points.trim().split(/[\s,]+/).map(Number);
            const points  = [];
            for (let i = 0; i < numbers.length; i += 2) {
                points.push([numbers[i], numbers[i + 1]]);
            }
            shapes.push({color, points});
        }
        return shapes;
    }

    render(size) {
        const samples = (size * IconBuilder.SUPERSAMPLING);
        const scaleX  = (this._width / samples);
        const scaleY  = (this._height / samples);
        const sums    = new Float64Array(size * size * 3);
        const color   = [0, 0, 0];
        for (let sy = 0; sy < samples; sy++) {
            const y = ((sy + 0.5) * scaleY);
            for (let sx = 0; sx < samples; sx++) {
                const x = ((sx + 0.5) * scaleX);
                color[0] = 0;
                color[1] = 0;
                color[2] = 0;
                for (const shape of this._shapes) {
                    if (this._inside(shape.points, x, y)) {
                        color[0] = shape.color[0];
                        color[1] = shape.color[1];
                        color[2] = shape.color[2];
                    }
                }
                const pixel = ((Math.floor(sy / IconBuilder.SUPERSAMPLING) * size) + Math.floor(sx / IconBuilder.SUPERSAMPLING)) * 3;
                sums[pixel]     += color[0];
                sums[pixel + 1] += color[1];
                sums[pixel + 2] += color[2];
            }
        }
        const rgba    = Buffer.alloc(size * size * 4);
        const perCell = (IconBuilder.SUPERSAMPLING * IconBuilder.SUPERSAMPLING);
        for (let i = 0; i < (size * size); i++) {
            rgba[i * 4]       = Math.round(sums[i * 3] / perCell);
            rgba[(i * 4) + 1] = Math.round(sums[(i * 3) + 1] / perCell);
            rgba[(i * 4) + 2] = Math.round(sums[(i * 3) + 2] / perCell);
            rgba[(i * 4) + 3] = 255;
        }
        return new VrPngWriter().encode(size, size, rgba);
    }

    // Even-odd crossing test.
    _inside(points, x, y) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const [xi, yi] = points[i];
            const [xj, yj] = points[j];
            if (((yi > y) !== (yj > y)) && (x < (((xj - xi) * (y - yi)) / (yj - yi)) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    }
}

IconBuilder.ROOT_DIR      = path.resolve(__dirname, '..', '..');
IconBuilder.WEBSITE_DIR   = path.join(IconBuilder.ROOT_DIR, 'website');
IconBuilder.SOURCE        = path.join(IconBuilder.WEBSITE_DIR, 'icon', 'icon.svg');
IconBuilder.SUPERSAMPLING = 4;
IconBuilder.FAVICON_SIZE  = 48;
IconBuilder.ICONS         = [
    ...[36, 48, 72, 96, 144, 192, 512].map((size) => ({file: 'icon/android-icon-' + size + 'x' + size + '.png', size})),
    ...[57, 60, 72, 76, 114, 120, 144, 152, 180].map((size) => ({file: 'icon/apple-icon-' + size + 'x' + size + '.png', size})),
    ...[16, 32, 96].map((size) => ({file: 'icon/favicon-' + size + 'x' + size + '.png', size})),
    ...[70, 144, 150, 310].map((size) => ({file: 'icon/ms-icon-' + size + 'x' + size + '.png', size})),
    {file: 'apple-touch-icon.png', size: 192},
];

try {
    const builder = new IconBuilder(fs.readFileSync(IconBuilder.SOURCE, 'utf8'));
    const write   = (file, data) => {
        fs.writeFileSync(file, data);
        process.stdout.write(path.relative(IconBuilder.ROOT_DIR, file) + '\n');
    };
    for (const icon of IconBuilder.ICONS) {
        write(path.join(IconBuilder.WEBSITE_DIR, icon.file), builder.render(icon.size));
    }
    write(path.join(IconBuilder.WEBSITE_DIR, 'favicon.ico'), new IcoWriter().encode(builder.render(IconBuilder.FAVICON_SIZE), IconBuilder.FAVICON_SIZE));
} catch (error) {
    process.stderr.write(String(error.stack ?? error) + '\n');
    process.exitCode = 1;
}

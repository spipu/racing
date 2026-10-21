/**
 * Collision layer of a course (courses/<code>.json collision), queried as the
 * original 68K does: a 64 x 64 grid of cells of 512 units, each holding convex
 * polygons of 4 half-planes with a height plane, a surface and the road data
 * ($73E8 cell, $748C polygon test, $75E0 height). Positions are in collision
 * units (1 = 2 scenery units).
 *
 * Polygon: [selector, 4 x (v1, v2), A, B, C, surface, flags, direction, section].
 */
class RacingCourseCollision {
    /**
     * @param {{gridSize: int, layers: {cells: int[], records: (int[][]|null)[]}[]}} collision
     */
    constructor(collision) {
        this._grid   = collision.gridSize;
        this._layers = collision.layers;
    }

    /**
     * $73E8: the polygons of the cell holding (x, z), on the given layer (the alternative layer of the crossings).
     *
     * @returns {int[][]|null} null: no polygon, wall everywhere
     */
    record(x, z, layer) {
        // A course without crossings has a single layer.
        const data   = (this._layers[layer] ?? this._layers[0]);
        const column = this._gridIndex(x);
        const row    = this._gridIndex(z);
        if ((column < 0) || (row < 0) || (column >= this._grid) || (row >= this._grid)) {
            return null;
        }

        return data.records[data.cells[(row * this._grid) + column]];
    }

    _gridIndex(value) {
        return (((value >> RacingCourseCollision.GRID_SHIFT) + RacingCourseCollision.GRID_BIAS) >> RacingCourseCollision.CELL_SHIFT);
    }

    /**
     * Position inside a cell, as the polygon test and the height plane read it (0..1022).
     */
    static local(value) {
        return (((value + RacingCourseCollision.LOCAL_BIAS) & RacingCourseCollision.LOCAL_MASK) * 2);
    }

    /**
     * $74A4: the first polygon of the record holding the local position.
     *
     * @returns {int[]|null}
     */
    find(record, lx, lz) {
        if (record === null) {
            return null;
        }
        for (const polygon of record) {
            if (this.inside(polygon, lx, lz)) {
                return polygon;
            }
        }

        return null;
    }

    // $7534: the 4 half-planes, 3 selector bits each from bit 15: axis (lz against lx otherwise), direct compare, side.
    inside(polygon, lx, lz) {
        const selector = polygon[RacingCourseCollision.SELECTOR];
        const slope    = RacingCourseCollision.SLOPE_SHIFT;
        for (let edge = 0; edge < RacingCourseCollision.EDGES; edge++) {
            const bits   = (selector >> (RacingCourseCollision.FIRST_EDGE_BIT - (edge * 3)));
            const axis   = ((bits & 4) !== 0);
            const direct = ((bits & 2) !== 0);
            const side   = ((bits & 1) !== 0);
            const v1     = polygon[RacingCourseCollision.FIRST_EDGE + (edge * 2)];
            const v2     = polygon[RacingCourseCollision.FIRST_EDGE + (edge * 2) + 1];
            let below;
            let keepBelow;
            if (!axis) {
                below     = (direct ? (lx < v1) : (lz < (((lx * v1) + (v2 << slope)) >> slope)));
                keepBelow = (direct ? !side : side);
            } else {
                below     = (direct ? (lz < v1) : (lx < (((lz * v1) + (v2 << slope)) >> slope)));
                keepBelow = (direct ? side : !side);
            }
            if (below !== keepBelow) {
                return false;
            }
        }

        return true;
    }

    /**
     * The height of the road at a position, as the car's probe reads it: the plane of the first polygon there.
     *
     * @returns {int|null} 1/8 scenery unit, null off every polygon
     */
    heightAt(x, z, layer) {
        const lx      = RacingCourseCollision.local(x);
        const lz      = RacingCourseCollision.local(z);
        const polygon = this.find(this.record(x, z, layer), lx, lz);

        return ((polygon === null) ? null : this.height(polygon, lx, lz));
    }

    /**
     * $75E0: height of the polygon plane at the local position.
     */
    height(polygon, lx, lz) {
        const shift = (((polygon[RacingCourseCollision.FLAGS] & RacingCourseCollision.FLAG_PLANE_X2) !== 0) ? 5 : 6);

        return (((lx * polygon[RacingCourseCollision.PLANE_A]) + (lz * polygon[RacingCourseCollision.PLANE_B]) + (polygon[RacingCourseCollision.PLANE_C] << 5)) >> shift);
    }
}

// Cells of 512 units: 16 units >> 4, then 32 of them >> 5, from the grid centre.
RacingCourseCollision.GRID_SHIFT     = 4;
RacingCourseCollision.CELL_SHIFT     = 5;
RacingCourseCollision.GRID_BIAS      = 0x400;
RacingCourseCollision.LOCAL_BIAS     = 0x4000;
RacingCourseCollision.LOCAL_MASK     = 0x1FF;
// Half-plane slopes in 1/512.
RacingCourseCollision.SLOPE_SHIFT    = 9;
RacingCourseCollision.EDGES          = 4;
RacingCourseCollision.FIRST_EDGE_BIT = 13;
// Flag bit 7: the height plane at twice its scale.
RacingCourseCollision.FLAG_PLANE_X2  = 0x80;
// Polygon fields.
RacingCourseCollision.SELECTOR       = 0;
RacingCourseCollision.FIRST_EDGE     = 1;
RacingCourseCollision.PLANE_A        = 9;
RacingCourseCollision.PLANE_B        = 10;
RacingCourseCollision.PLANE_C        = 11;
RacingCourseCollision.SURFACE        = 12;
RacingCourseCollision.FLAGS          = 13;
RacingCourseCollision.DIRECTION      = 14;
RacingCourseCollision.SECTION        = 15;

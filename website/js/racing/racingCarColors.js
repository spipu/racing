/**
 * The colours of the players' cars in a race of several players (user decisions): each slot has its colour, which
 * takes the place of the red and the blue of the car's livery — the ramps of its palette the body and the cockpit
 * shell are painted with —, the white staying; a race alone keeps the original colours.
 */
class RacingCarColors {
    /**
     * @param {int} slot - 1 to 8
     * @returns {int[]} [r, g, b] 0..255
     */
    static ofSlot(slot) {
        return RacingCarColors.SLOTS[slot - 1];
    }

    /**
     * @param {string} car - car code
     * @returns {int[][]} [first, last] palette indexes of each ramp of the livery
     */
    static liveryOf(car) {
        return RacingCarColors.LIVERY[car];
    }
}

// Eight colours told apart at a glance: red, blue, green, yellow, orange, purple, cyan, pink.
RacingCarColors.SLOTS = [
    [220, 30, 30],
    [30, 80, 230],
    [30, 170, 50],
    [240, 210, 20],
    [245, 130, 20],
    [150, 50, 210],
    [20, 200, 210],
    [240, 90, 180],
];
// The red and blue ramps of each car's palette (palettes.json cars, from index 32) its livery is painted with; the slate
// ramp 33-37 of the Stock and the Prototype, their windows, keeps its colour.
RacingCarColors.LIVERY = {
    formula:   [[33, 46], [47, 57]],
    stock:     [[38, 43], [44, 51]],
    prototype: [[38, 45], [46, 51]],
};

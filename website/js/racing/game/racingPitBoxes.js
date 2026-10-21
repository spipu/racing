/**
 * The pit boxes of a course, the first one the original's ($A868, place 0) and, for a race of several players, a
 * second one 400 units behind it along the pit lane (user decision): far enough for a car driven to the first box
 * ($A972) to pass it still on the right of the lane. Each box with the base of its crew: the original's at the first
 * box ($3C2A), the road under the second one.
 */
class RacingPitBoxes {
    /**
     * @param {object}                race      - race.json
     * @param {string}                course    - course code
     * @param {RacingCourseCollision} collision - of the course
     * @param {boolean}               two       - the second box too
     * @returns {{x: int, z: int, base: int[]}[]} entity units; base [x, height, z] of the crew; none on a course without pits
     */
    static of(race, course, collision, two) {
        const pit   = race.pit;
        const first = pit.pitBoxes[course][0];
        const boxes = [{x: first[0], z: first[1], base: pit.mechanicBases[course]}];
        const place = RacingPitBoxes._second(pit, course);
        if (two && (place !== null)) {
            boxes.push({x: place[0], z: place[1], base: [place[0], collision.heightAt(place[0], place[1], 0), place[1]]});
        }

        return boxes;
    }

    // Big Forest and Acropolis keep a box of the original's table 400 units behind ($A868, never read by it); Highland
    // has none (its places 1 to 3 copy Bay Bridge's).
    static _second(pit, course) {
        const second = (RacingPitBoxes.SECOND[course] ?? null);
        if (second === null) {
            return null;
        }

        return (second.place ?? pit.pitBoxes[course][second.romPlace]);
    }
}

RacingPitBoxes.SECOND = {
    big_forest: {romPlace: 1},
    acropolis:  {romPlace: 2},
    highland:   {place: [-5888, 1648]},
};

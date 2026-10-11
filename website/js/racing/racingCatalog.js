/**
 * Courses and cars of the game, in the order of the original menus
 * (assets/virtual_racing/catalog.json, written by the exporter).
 */
class RacingCatalog {
    constructor() {
        this._courses = [];
        this._cars    = [];
        this._sky     = null;
    }

    async load() {
        const catalog = await appBootstrap.fetchJsonAsync(RacingCatalog.URL);
        this._courses = catalog.courses;
        this._cars    = catalog.cars;
        this._sky     = catalog.sky;

        return this;
    }

    /**
     * @returns {{code: string, name: string, skyColor: int[]}[]}
     */
    getCourses() {
        return this._courses;
    }

    /**
     * @returns {{code: string, name: string}[]}
     */
    getCars() {
        return this._cars;
    }

    /**
     * @returns {{horizonRow: int, width: int, height: int}}
     */
    getSky() {
        return this._sky;
    }

    getCourse(code) {
        return this._courses[this.getCourseIndex(code)];
    }

    /**
     * @param {string} code
     * @returns {int} the index of the course in the tables of the original
     */
    getCourseIndex(code) {
        const index = this._courses.findIndex((course) => (course.code === code));
        if (index < 0) {
            throw new Error('RacingCatalog - unknown course ' + code);
        }

        return index;
    }
}

RacingCatalog.URL = '/assets/virtual_racing/catalog.json';

const racingCatalog = new RacingCatalog();

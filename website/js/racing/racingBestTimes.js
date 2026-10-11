/**
 * Best lap and best race time of each course, variant and car, kept in the
 * `bestTime` store of the spipuracing database (this device's player only).
 */
class RacingBestTimes {
    constructor() {
        this._database = null;
    }

    /**
     * @param {AppDatabase} database - the opened database holding the store
     */
    init(database) {
        this._database = database;

        return this;
    }

    /**
     * @returns {Promise<{lapMs: int|null, raceMs: int|null}>} both null without a record
     */
    async get(course, mirror, car) {
        const record = await this._find(course, mirror, car);

        return {lapMs: (record?.lapMs ?? null), raceMs: (record?.raceMs ?? null)};
    }

    /**
     * Keeps the better of the stored and the new times.
     *
     * @param {int|null} lapMs  - best lap of the finished race
     * @param {int|null} raceMs - total time, null when the race was not finished
     * @returns {Promise<{newLap: boolean, newRace: boolean}>}
     */
    async record(course, mirror, car, lapMs, raceMs) {
        const stored  = await this._find(course, mirror, car);
        const best    = (previous, value) => (((value !== null) && ((previous === null) || (value < previous))) ? value : previous);
        const lap     = best((stored?.lapMs ?? null), lapMs);
        const race    = best((stored?.raceMs ?? null), raceMs);
        const changes = {newLap: (lap !== (stored?.lapMs ?? null)), newRace: (race !== (stored?.raceMs ?? null))};
        if (changes.newLap || changes.newRace) {
            await this._database.upsert(RacingDatabaseSchema.BEST_TIME, RacingDatabaseSchema.BEST_TIME_BY_RACE,
                {course: course, mirror: RacingBestTimes.mirrorKey(mirror), car: car, lapMs: lap, raceMs: race});
        }

        return changes;
    }

    async clearAll() {
        await this._database.clear(RacingDatabaseSchema.BEST_TIME);
    }

    static mirrorKey(mirror) {
        return ((mirror === true) ? 1 : 0);
    }

    _find(course, mirror, car) {
        return this._database.getByIndex(RacingDatabaseSchema.BEST_TIME, RacingDatabaseSchema.BEST_TIME_BY_RACE,
            [course, RacingBestTimes.mirrorKey(mirror), car]);
    }
}

const racingBestTimes = new RacingBestTimes();

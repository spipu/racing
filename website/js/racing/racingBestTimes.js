/**
 * Best lap and best race time of each course, variant and car, kept in the
 * `bestTime` store of the spipuracing database (this device's player only),
 * with the lap times at the two checkpoints of the best lap (the splits of the
 * original are shown against them).
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

    // False when the storage could not open.
    isReady() {
        return (this._database !== null);
    }

    /**
     * @returns {Promise<{lapMs: int|null, raceMs: int|null, checkpointsMs: int[]|null}>} null without a record
     */
    async get(course, mirror, car) {
        const record = await this._find(course, mirror, car);

        return {lapMs: (record?.lapMs ?? null), raceMs: (record?.raceMs ?? null), checkpointsMs: (record?.checkpointsMs ?? null)};
    }

    /**
     * Keeps the better of the stored and the new times.
     *
     * @param {int|null}   lapMs         - best lap of the race
     * @param {int|null}   raceMs        - total time, null when the race was not finished
     * @param {int[]|null} checkpointsMs - lap times at the checkpoints of that best lap
     * @returns {Promise<{newLap: boolean, newRace: boolean}>}
     */
    async record(course, mirror, car, lapMs, raceMs, checkpointsMs = null) {
        const stored  = await this._find(course, mirror, car);
        const best    = (previous, value) => (((value !== null) && ((previous === null) || (value < previous))) ? value : previous);
        const lap     = best((stored?.lapMs ?? null), lapMs);
        const race    = best((stored?.raceMs ?? null), raceMs);
        const changes = {newLap: (lap !== (stored?.lapMs ?? null)), newRace: (race !== (stored?.raceMs ?? null))};
        if (changes.newLap || changes.newRace) {
            await this._database.upsert(RacingDatabaseSchema.BEST_TIME, RacingDatabaseSchema.BEST_TIME_BY_RACE, {
                course:        course,
                mirror:        RacingBestTimes.mirrorKey(mirror),
                car:           car,
                lapMs:         lap,
                raceMs:        race,
                checkpointsMs: ((changes.newLap) ? checkpointsMs : (stored?.checkpointsMs ?? null)),
            });
        }

        return changes;
    }

    /**
     * @returns {Promise<object[]>} every record: {course, mirror (0 | 1), car, lapMs, raceMs, checkpointsMs}
     */
    getAll() {
        return this._database.getAll(RacingDatabaseSchema.BEST_TIME);
    }

    // The records of one course variant, every car.
    async clearCourse(course, mirror) {
        const key = RacingBestTimes.mirrorKey(mirror);
        for (const record of await this.getAll()) {
            if ((record.course === course) && (record.mirror === key)) {
                await this._database.delete(RacingDatabaseSchema.BEST_TIME, record.id);
            }
        }
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

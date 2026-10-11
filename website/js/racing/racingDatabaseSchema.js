/**
 * The spipuracing database, version by version.
 *
 * Records:
 *  - setting: {id, key, value}
 *  - bestTime: {id, course, mirror (0 | 1: a boolean is not a valid IndexedDB key), car, lapMs, raceMs} — one per course, variant
 *    and car; lapMs / raceMs null until set
 */
class RacingDatabaseSchema {
    /**
     * @returns {AppDatabaseSchema}
     */
    static build() {
        return new AppDatabaseSchema(RacingDatabaseSchema.NAME)
            .addVersion(1, (upgrade) => {
                upgrade.createStore(RacingDatabaseSchema.SETTING, {indexes: [{name: RacingDatabaseSchema.SETTING_BY_KEY, keyPath: 'key', unique: true}]});
            })
            .addVersion(2, (upgrade) => {
                upgrade.createStore(RacingDatabaseSchema.BEST_TIME, {indexes: [{name: RacingDatabaseSchema.BEST_TIME_BY_RACE, keyPath: ['course', 'mirror', 'car'], unique: true}]});
            });
    }
}

RacingDatabaseSchema.NAME              = 'spipuracing';
RacingDatabaseSchema.SETTING           = 'setting';
RacingDatabaseSchema.SETTING_BY_KEY    = 'key';
RacingDatabaseSchema.BEST_TIME         = 'bestTime';
RacingDatabaseSchema.BEST_TIME_BY_RACE = 'race';

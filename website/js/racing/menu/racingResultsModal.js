/**
 * Results of a finished solo race, shown over the race scene: total time,
 * time of every lap (the best one marked), "New record!" against the best
 * times of this device, then restart / change the course / main menu. No way
 * back into the race: the back inputs are inert.
 */
class RacingResultsModal extends AppMenuAbstractListModal {
    /**
     * @param {AppMenuDisplay} display
     */
    constructor(display) {
        super(display);

        this._nav.setEscapeAsBack(false);
        this._onRestart = null;
        this._onCourses = null;
        this._onQuit    = null;
    }

    setOnRestart(callback) {
        this._onRestart = callback;

        return this;
    }

    setOnCourses(callback) {
        this._onCourses = callback;

        return this;
    }

    setOnQuit(callback) {
        this._onQuit = callback;

        return this;
    }

    /**
     * @param {string} title
     * @param {{raceMs: number, lapsMs: number[]}} result
     * @param {{newLap: boolean, newRace: boolean}} records
     */
    show(title, result, records) {
        const {modal} = this._createShell(title, 'app-menu-modal app-menu-modal-wide racing-results', 'app-menu-subtitle');
        const table   = AppMenuDom.addElement(modal, 'div', 'racing-results-table');
        const best    = Math.min(...result.lapsMs);
        result.lapsMs.forEach((lapMs, i) => {
            const mark = (lapMs === best) ? appTranslator.get('race.results.bestLap') : '';
            this._addRow(table, appTranslator.get('race.results.lap', {lap: (i + 1)}), lapMs, mark, (lapMs === best), (records.newLap && (lapMs === best)));
        });
        this._addRow(table, appTranslator.get('race.results.total'), result.raceMs, '', true, records.newRace);

        const listEl = AppMenuDom.addElement(modal, 'div', 'app-menu-list');
        this._nav.addItemIn(listEl, appTranslator.get('race.results.restart'), () => this._onRestart());
        this._nav.addItemIn(listEl, appTranslator.get('race.results.courses'), () => this._onCourses());
        this._nav.addItemIn(listEl, appTranslator.get('menu.main'), () => this._onQuit());

        this._nav.attach();
        this._nav.selectFirst();

        return this;
    }

    _addRow(table, label, ms, mark, strong, record) {
        const row = AppMenuDom.addElement(table, 'div', ((strong) ? 'racing-results-row racing-results-strong' : 'racing-results-row'));
        AppMenuDom.addText(row, 'racing-results-label', label);
        AppMenuDom.addText(row, 'racing-results-time', RacingTime.format(ms));
        AppMenuDom.addText(row, 'racing-results-mark', ((record) ? appTranslator.get('race.results.record') : mark));
    }

    _onBack() {
    }
}

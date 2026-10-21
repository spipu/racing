/**
 * The results of a race of several players, shown over the race scene once this device's player finished (user
 * decision: at its own finish, as alone), filled live until the race is over: each player in standings order, in the
 * colour of its slot, with its race time and its best lap — "racing" while it still runs, its laps done when the race
 * stopped before its last lap, "abandon" for a player gone. Once the race is over, the main gets restart / change the
 * course / main menu; a sub waits for the host. No way back into the race: the back inputs are inert.
 */
class RacingStandingsModal extends AppMenuAbstractListModal {
    /**
     * @param {AppMenuDisplay} display
     */
    constructor(display) {
        super(display);

        this._nav.setEscapeAsBack(false);
        this._onRestart = null;
        this._onCourses = null;
        this._onQuit    = null;
        this._source    = null;
        this._tableEl   = null;
        this._statusEl  = null;
        this._listEl    = null;
        this._shownRows = null;
        this._over      = null;
    }

    /**
     * The main's actions once the race is over; without them, the modal waits for the host.
     */
    setActions(onRestart, onCourses, onQuit) {
        this._onRestart = onRestart;
        this._onCourses = onCourses;
        this._onQuit    = onQuit;

        return this;
    }

    /**
     * @param {string}   title
     * @param {function} source - () => {rows: {place, nickname, color, status, raceMs, bestLapMs, laps, own}[], over: boolean}
     */
    show(title, source) {
        this._source = source;
        const {modal} = this._createShell(title, 'app-menu-modal app-menu-modal-wide racing-results', 'app-menu-subtitle');
        this._tableEl  = AppMenuDom.addElement(modal, 'div', 'racing-standings-table');
        this._statusEl = AppMenuDom.addElement(modal, 'div', 'app-menu-status');
        this._listEl   = AppMenuDom.addElement(modal, 'div', 'app-menu-list');
        this._nav.attach();
        this.refresh();

        return this;
    }

    // Called every frame: rebuilt only when the standings or the end of the race changed.
    refresh() {
        const {rows, over} = this._source();
        const shown = JSON.stringify(rows);
        if (shown !== this._shownRows) {
            this._shownRows = shown;
            this._buildTable(rows);
        }
        if (over === this._over) {
            return;
        }
        this._over = over;
        if (!over) {
            this._statusEl.textContent = appTranslator.get('race.standings.inProgress');
        } else {
            this._statusEl.textContent = ((this._onRestart !== null) ? '' : appTranslator.get('race.standings.waitingHost'));
        }
        if (over && (this._onRestart !== null)) {
            this._nav.addItemIn(this._listEl, appTranslator.get('race.results.restart'), () => this._onRestart());
            this._nav.addItemIn(this._listEl, appTranslator.get('race.results.courses'), () => this._onCourses());
            this._nav.addItemIn(this._listEl, appTranslator.get('menu.main'), () => this._onQuit());
            this._nav.selectFirst();
        }
    }

    _buildTable(rows) {
        this._tableEl.textContent = '';
        const head = AppMenuDom.addElement(this._tableEl, 'div', 'racing-standings-row racing-standings-head');
        for (const label of ['', '', appTranslator.get('race.results.total'), appTranslator.get('race.results.bestLap')]) {
            AppMenuDom.addText(head, 'racing-standings-cell', label);
        }
        for (const row of rows) {
            const line = AppMenuDom.addElement(this._tableEl, 'div', ((row.own) ? 'racing-standings-row racing-results-strong' : 'racing-standings-row'));
            AppMenuDom.addText(line, 'racing-standings-cell racing-standings-place', ((row.place !== null) ? String(row.place) : ''));
            const name = AppMenuDom.addText(line, 'racing-standings-cell racing-standings-name', row.nickname);
            name.style.setProperty('--racing-slot-color', row.color);
            AppMenuDom.addText(line, 'racing-standings-cell racing-results-time', RacingStandingsModal._status(row));
            AppMenuDom.addText(line, 'racing-standings-cell racing-results-time', RacingTime.format(row.bestLapMs));
        }
    }

    // The race time of a finished player, else where its race stands.
    static _status(row) {
        switch (row.status) {
            case RacingStandingsModal.FINISHED:
                return RacingTime.format(row.raceMs);
            case RacingStandingsModal.STOPPED:
                return appTranslator.get('race.standings.laps', {laps: row.laps});
            case RacingStandingsModal.ABANDON:
                return appTranslator.get('race.standings.abandon');
        }

        return appTranslator.get('race.standings.racing');
    }

    _onBack() {
    }
}

RacingStandingsModal.FINISHED = 'finished';
RacingStandingsModal.STOPPED  = 'stopped';
RacingStandingsModal.RACING   = 'racing';
RacingStandingsModal.ABANDON  = 'abandon';

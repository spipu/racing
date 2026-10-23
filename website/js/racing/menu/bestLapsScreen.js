/**
 * Best laps of this device: one row per course (every course, then every
 * mirrored one), one column per car. Only the cross of a row clears that
 * course, after a confirmation (user decision): the crosses are the entries of
 * the navigation (keyboard, gamepad), and a click, a tap or the mouse on a row
 * only selects its cross — the row is highlighted, nothing is cleared. The
 * bottom row holds Reset all, then Back.
 */
class BestLapsScreen extends AbstractRacingMenuScreen {
    _build() {
        const {panel, listEl} = this._buildPanel(appTranslator.get('menu.bestLaps'));
        const cars = racingCatalog.getCars();

        // Above the list: it stays in view while the list scrolls.
        const header = document.createElement('div');
        header.className = 'racing-best-laps-row racing-best-laps-header';
        panel.insertBefore(header, listEl);
        AppMenuDom.addText(header, 'racing-best-laps-course', appTranslator.get('records.course'));
        for (const car of cars) {
            AppMenuDom.addText(header, 'racing-best-laps-time', car.name);
        }
        AppMenuDom.addText(header, 'racing-best-laps-reset', '');

        const cells = new Map();
        let index   = 0;
        for (const mirror of [false, true]) {
            for (const course of racingCatalog.getCourses()) {
                const label = ((mirror) ? appTranslator.get('course.mirror', {course: course.name}) : course.name);
                const row   = AppMenuDom.addElement(listEl, 'div', 'app-menu-item racing-best-laps-row');
                AppMenuDom.addText(row, 'app-menu-item-label racing-best-laps-course', label);
                for (const car of cars) {
                    cells.set(BestLapsScreen._key(course.code, mirror, car.code), AppMenuDom.addText(row, 'racing-best-laps-time', RacingTime.NONE));
                }
                const reset = AppMenuDom.addDeleteButton(row, appTranslator.get('records.resetCourse'), () => this._confirmClear(course.code, mirror, label));
                reset.classList.add('racing-best-laps-reset');
                this._nav.addButtonItem(reset);
                const crossIndex = index++;
                // The cross stops its own click: a click on the row is the rest of it, which only selects.
                row.addEventListener('click', () => this._nav.selectIndex(crossIndex));
                row.addEventListener('mousemove', () => this._nav.selectIndex(crossIndex));
            }
        }

        const actions  = this._addElement('div', 'app-menu-actions app-menu-actions-split', panel);
        const resetAll = this._addButton(appTranslator.get('records.resetAll'), () => this._confirmClearAll(), actions);
        const back     = this._addButton(appTranslator.get('menu.back'), () => this._onBack(), actions);
        resetAll.classList.add('app-menu-button-secondary');
        this._nav.setBottomButtons([resetAll, back], back);

        this._nav.selectFirst();
        this._fill(cells);
    }

    _onBack() {
        this._navigator.showMainMenu();
    }

    // The best lap of each course, variant and car, once read.
    _fill(cells) {
        if (!racingBestTimes.isReady()) {
            return;
        }
        racingBestTimes.getAll().then((records) => {
            for (const record of records) {
                const cell = cells.get(BestLapsScreen._key(record.course, (record.mirror === 1), record.car));
                if ((cell !== undefined) && ((record.lapMs ?? null) !== null)) {
                    cell.textContent = RacingTime.format(record.lapMs);
                }
            }
        }).catch((error) => this._failed(error));
    }

    _confirmClear(course, mirror, label) {
        new AppMenuModal(this._display).confirm(appTranslator.get('records.resetCourseConfirm', {course: label}), () => {
            racingBestTimes.clearCourse(course, mirror).then(() => this.show(), (error) => this._failed(error));
        }, null, null, true, appTranslator.get('records.resetDetail'));
    }

    _confirmClearAll() {
        new AppMenuModal(this._display).confirm(appTranslator.get('records.resetAllConfirm'), () => {
            racingBestTimes.clearAll().then(() => this.show(), (error) => this._failed(error));
        }, null, null, true, appTranslator.get('records.resetDetail'));
    }

    _failed(error) {
        new AppMenuModal(this._display).showError(appTranslator.get('records.failed'), error.message);
    }

    static _key(course, mirror, car) {
        return (course + '|' + ((mirror) ? 1 : 0) + '|' + car);
    }
}

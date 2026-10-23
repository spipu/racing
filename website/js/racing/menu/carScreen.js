/**
 * Choice of the car and of its gearbox, like the original car selection: the
 * gearbox line cycles automatic / manual, a car line starts the race.
 */
class CarScreen extends AbstractRacingMenuScreen {
    /**
     * @param {RacingMenuNavigator} navigator
     * @param {AppMenuDisplay}      display
     */
    constructor(navigator, display) {
        super(navigator, display);

        this._choice = null;
    }

    /**
     * @param {{course: string, mirror: boolean}} choice
     */
    setChoice(choice) {
        this._choice = choice;

        return this;
    }

    _build() {
        const course     = racingCatalog.getCourse(this._choice.course);
        const courseName = ((this._choice.mirror) ? appTranslator.get('course.mirror', {course: course.name}) : course.name);
        const {panel, listEl} = this._buildPanel(appTranslator.get('menu.car', {course: courseName}));

        let gearboxEl = null;
        const step    = () => {
            this._navigator.toggleGearbox();
            gearboxEl.textContent = this._gearboxLabel();
        };
        const gearbox = this._nav.addItemIn(listEl, appTranslator.get('car.gearbox'), step, step);
        gearboxEl = AppMenuDom.addValue(gearbox, this._gearboxLabel(), true);
        gearbox.classList.add('racing-car-row');

        // The headings of the two time columns, between the gearbox and the cars: not an entry.
        const header = AppMenuDom.addElement(listEl, 'div', 'racing-car-row racing-car-header');
        AppMenuDom.addElement(header, 'span', 'racing-car-header-spacer');
        AppMenuDom.addText(header, 'racing-car-time', appTranslator.get('car.bestLap'));
        AppMenuDom.addText(header, 'racing-car-time', appTranslator.get('car.bestRace'));

        for (const car of racingCatalog.getCars()) {
            const item = this._addListItem(listEl, car.name, () => {
                this._navigator.startRace({...this._choice, car: car.code, gearbox: this._navigator.getGearbox()});
            });
            item.classList.add('racing-car-row');
            const lapEl  = AppMenuDom.addText(item, 'racing-car-time', RacingTime.NONE);
            const raceEl = AppMenuDom.addText(item, 'racing-car-time', RacingTime.NONE);
            this._showBestTimes(lapEl, raceEl, car.code);
        }
        this._addBackButton(panel);

        this._nav.selectIndex(CarScreen.FIRST_CAR_ITEM);
    }

    // The best lap and race of this device, once read; the empty time stays without a record or a storage.
    _showBestTimes(lapEl, raceEl, car) {
        if (!racingBestTimes.isReady()) {
            return;
        }
        racingBestTimes.get(this._choice.course, this._choice.mirror, car).then((times) => {
            lapEl.textContent  = RacingTime.format(times.lapMs);
            raceEl.textContent = RacingTime.format(times.raceMs);
        }).catch((error) => {
            console.warn('CarScreen - best times unavailable: ' + error.message);
        });
    }

    _gearboxLabel() {
        return appTranslator.get('value.gearbox.' + this._navigator.getGearbox());
    }

    _onBack() {
        this._navigator.openCourses();
    }
}

// The gearbox line comes first: the first car is preselected.
CarScreen.FIRST_CAR_ITEM = 1;

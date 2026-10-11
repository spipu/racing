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
        gearboxEl = AppMenuDom.addText(gearbox, 'app-menu-item-value', this._gearboxLabel());

        for (const car of racingCatalog.getCars()) {
            this._addListItem(listEl, car.name, () => {
                this._navigator.startRace({...this._choice, car: car.code, gearbox: this._navigator.getGearbox()});
            });
        }
        this._addBackButton(panel);

        this._nav.selectIndex(CarScreen.FIRST_CAR_ITEM);
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

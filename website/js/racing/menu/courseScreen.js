/**
 * Choice of the course: every course, then every mirrored variant.
 */
class CourseScreen extends AbstractRacingMenuScreen {
    _build() {
        const {panel, listEl} = this._buildPanel(appTranslator.get('menu.course'));

        for (const mirror of [false, true]) {
            for (const course of racingCatalog.getCourses()) {
                const label = ((mirror) ? appTranslator.get('course.mirror', {course: course.name}) : course.name);
                this._addListItem(listEl, label, () => {
                    this._navigator.openCars({course: course.code, mirror});
                });
            }
        }
        this._addBackButton(panel);

        this._nav.selectFirst();
    }

    _onBack() {
        this._navigator.showMainMenu();
    }
}

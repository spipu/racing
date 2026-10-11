/**
 * Base class of the Spipu-Racing menu screens: the socle skeleton
 * (AppMenuAbstractScreen) with the racing title.
 */
class AbstractRacingMenuScreen extends AppMenuAbstractScreen {
    /**
     * @param {RacingMenuNavigator} navigator
     * @param {AppMenuDisplay}      display
     */
    constructor(navigator, display) {
        super(display);

        this._navigator = navigator;
    }

    _titleText() {
        return RacingMenuNavigator.BRAND;
    }
}

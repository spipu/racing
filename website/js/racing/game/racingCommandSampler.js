/**
 * The only reader of the controls on behalf of the simulation, as InputCommandSampler of the engine: it collects every
 * frame and produces one RacingCommand when the role asks for a turn's command.
 *
 * Between two commands, a button counts as pressed if it was down on any collected frame or when the command is
 * produced — a tap shorter than a turn is never lost, a button held through several commands of one frame is never
 * shown released, and the next command shows a real release. The steering stick is read when the command is produced.
 */
class RacingCommandSampler {
    /**
     * @param {RacingControls} controls
     */
    constructor(controls) {
        this._buttonReaders = new Map([
            [RacingCommand.ACCELERATE, () => controls.readButtonAccelerate()],
            [RacingCommand.BRAKE, () => controls.readButtonBrake()],
            [RacingCommand.STEER_LEFT, () => controls.readButtonSteerLeft()],
            [RacingCommand.STEER_RIGHT, () => controls.readButtonSteerRight()],
            [RacingCommand.GEAR_UP, () => controls.readButtonGearUp()],
            [RacingCommand.GEAR_DOWN, () => controls.readButtonGearDown()]
        ]);
        this._controls = controls;
        this._pressed  = new Set();
    }

    /**
     * Reads the controls once; call it on every frame the race runs.
     */
    collect() {
        for (const [name, reader] of this._buttonReaders) {
            if (reader()) {
                this._pressed.add(name);
            }
        }

        return this;
    }

    /**
     * @returns {RacingCommand} what was collected since the previous command, which starts afresh
     */
    sample() {
        this.collect();
        const command = new RacingCommand().setSteerAxis(this._controls.readSteerAxis());
        for (const name of this._pressed) {
            command.press(name);
        }
        this._pressed.clear();

        return command;
    }
}

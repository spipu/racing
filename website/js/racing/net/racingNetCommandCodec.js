/**
 * A player's command for one turn to and from its binary message, as DoomNetCommandCodec: the turn it answers, the
 * buttons as a bitmask in the order of BUTTONS, the steering stick (Float32). Fail-fast like the state codec. The
 * buttons are the race's own (RacingCommand), where doom's are declared by the game: no list to pass in.
 */
class RacingNetCommandCodec {
    /**
     * @param {int}           turn
     * @param {RacingCommand} command
     * @returns {ArrayBuffer}
     */
    encode(turn, command) {
        let mask = 0;
        RacingNetCommandCodec.BUTTONS.forEach((button, bit) => {
            if (command.isPressed(button)) {
                mask |= (1 << bit);
            }
        });

        return new NetByteWriter().u8(RacingNetProtocol.MESSAGE_COMMAND).u32(turn).u8(mask).f32(command.getSteerAxis())
            .toBytes().buffer;
    }

    /**
     * @param {ArrayBuffer} buffer
     * @returns {{turn: int, command: RacingCommand}}
     * @throws {NetError} INVALID_MESSAGE, or a RangeError read past the end
     */
    decode(buffer) {
        const r = new NetByteReader(new Uint8Array(buffer));
        if (r.u8() !== RacingNetProtocol.MESSAGE_COMMAND) {
            throw new NetError(NetError.INVALID_MESSAGE, 'Not a command message');
        }
        const turn    = r.u32();
        const mask    = r.u8();
        const command = new RacingCommand().setSteerAxis(r.f32());
        RacingNetCommandCodec.BUTTONS.forEach((button, bit) => {
            if ((mask & (1 << bit)) !== 0) {
                command.press(button);
            }
        });
        if (!r.isAtEnd()) {
            throw new NetError(NetError.INVALID_MESSAGE, 'Command message longer than its content');
        }

        return {turn: turn, command: command};
    }
}

// The bit of each button, fixed.
RacingNetCommandCodec.BUTTONS = [
    RacingCommand.ACCELERATE,
    RacingCommand.BRAKE,
    RacingCommand.STEER_LEFT,
    RacingCommand.STEER_RIGHT,
    RacingCommand.GEAR_UP,
    RacingCommand.GEAR_DOWN
];

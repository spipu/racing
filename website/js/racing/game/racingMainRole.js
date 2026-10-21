/**
 * The role of the device that simulates the race — the only one in a race alone, the main in a session. RacingGame
 * runs the flow every device shares and asks its role to move the race each frame; this role owns the simulation
 * (RacingSimulation) and everything only the simulating device does: the players entering the race, the commands
 * they drive with. A device that only follows the race will hold another role.
 */
class RacingMainRole extends AbstractRacingRole {
    /**
     * @param {RacingPlayerRoster} roster
     * @param {RacingTurnEvents}   events
     */
    constructor(roster, events) {
        super();

        this._roster     = roster;
        this._simulation = new RacingSimulation(roster, events, Math.random);
        this._commands   = new Map();
    }

    // Each device hears of the finish and the records of its own player alone.
    adoptRace(data, onFinish, onRecord) {
        const local = (callback) => ((player, value) => {
            if (player === this._roster.getLocal()) {
                callback(value);
            }
        });
        this._simulation.adoptRace(data, local(onFinish), local(onRecord));
    }

    // The records are this device's: the other players' cars race against none.
    enterRace(record) {
        const players = this._roster.getAll().sort((a, b) => (a.getId() - b.getId()));
        for (const player of players) {
            this._simulation.addPlayer(player, ((player === this._roster.getLocal()) ? record : null));
        }
    }

    /**
     * One step: the local player's command sampled now, then the race.
     *
     * @param {number}               ticks
     * @param {RacingCommandSampler} sampler
     */
    advance(ticks, sampler) {
        this._commands.set(this._roster.getLocal().getId(), sampler.sample());
        this._simulation.tick(ticks, this._commands);
    }
}

/**
 * The messages of a Spipu-Racing multiplayer session, beyond those of every game session (NetGameProtocol,
 * inherited): its one mode, the race, and the pause of a sub, which stops the race for everyone (user decision: in
 * doom_js only the main's pause stops the game). The main's PAUSE names who holds the race, and is said again
 * whenever that changes; the next state ends it. A sub's levelReady carries the record of its device, its race runs
 * against it.
 */
class RacingNetProtocol extends NetGameProtocol {
}

// Sub → main: its pause menu opened (paused true) or closed (paused false).
RacingNetProtocol.SUB_PAUSE    = 'subPause';
// Main → every sub in the cycle: the race is over and the main picks the next course; the subs wait in the lobby.
RacingNetProtocol.LOBBY_RETURN = 'lobbyReturn';

RacingNetProtocol.MODE_RACE = 1;

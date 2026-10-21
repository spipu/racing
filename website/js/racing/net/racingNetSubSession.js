/**
 * The session of a sub of a race (NetGameSubSession): besides the pause, its main announces the return to the lobby
 * once the race is over and it picks the next course.
 */
class RacingNetSubSession extends NetGameSubSession {
    _phases() {
        return [RacingNetProtocol.PAUSE, RacingNetProtocol.LOBBY_RETURN];
    }
}

/**
 * The messages of a game session between its main (the device that runs the
 * game) and its subs (the other players): the control messages they say to
 * each other outside the turn stream (JSON, through NetPeer.sendControl), the
 * reasons a session ends, and the type byte of the binary turn messages. A
 * game extends it with its own messages and modes.
 */
class NetGameProtocol {
}

// Sub → main, once its link is open: it joins the session and waits for its welcome.
NetGameProtocol.HELLO          = 'hello';
// Main → a sub: who it is in the session (playerId, its slot) and how the session plays (mode, options);
// sent again to every sub when the mode changes.
NetGameProtocol.WELCOME        = 'welcome';
// Main → the other subs, when the subs play: a player left (playerId, nickname).
NetGameProtocol.PLAYER_REMOVED = 'playerRemoved';
// Sub → main: its page went to the background (away true) or came back (away false).
NetGameProtocol.AWAY           = 'away';
// Main → the other subs, when the subs play: a player went away or came back (nickname, away).
NetGameProtocol.PLAYER_AWAY    = 'playerAway';
// Main → every sub: the lobby as it stands (NetLobby.toData).
NetGameProtocol.LOBBY          = 'lobby';
// Main → every sub: the game runs.
NetGameProtocol.START          = 'start';
// Main → a sub: the level to build (seq, the game's description of it, mode, options), and the sub is syncing.
NetGameProtocol.LEVEL_LOAD     = 'levelLoad';
// Sub → main: the level of that seq is built, the sub joins the turn cycle with the next state.
NetGameProtocol.LEVEL_READY    = 'levelReady';
// Main → the subs it is not waiting for: the nicknames it waits for (none clears it).
NetGameProtocol.WAITING        = 'waiting';
// Main → every sub in the cycle: the main paused its game, no turn runs until the next state.
NetGameProtocol.PAUSE          = 'pause';
// Either side: the session ends for the receiver, with one of the END_* reasons.
NetGameProtocol.SESSION_END    = 'sessionEnd';

NetGameProtocol.END_STOPPED    = 'stopped';   // the main stopped the session
NetGameProtocol.END_REMOVED    = 'removed';   // the main removed that sub
NetGameProtocol.END_TIMEOUT    = 'timeout';   // that sub's command never came: too slow a link
NetGameProtocol.END_LEFT       = 'left';      // the sub left
NetGameProtocol.END_LOST       = 'lost';      // the link went silent or failed
NetGameProtocol.END_GAME_OVER  = 'gameOver';  // the main finished its game
NetGameProtocol.END_INVALID    = 'invalid';   // a message the receiver could not decode
NetGameProtocol.END_FULL       = 'full';      // the lobby had no seat left for that sub

// First byte of a binary message (0xFF is the network layer's chunk).
NetGameProtocol.MESSAGE_STATE   = 1;   // main → subs, every turn
NetGameProtocol.MESSAGE_COMMAND = 2;   // sub → main, every turn

// A side that ends a session closes the link itself if the other side has not
// done it by then: its closing message must get through first.
NetGameProtocol.END_GRACE_MS = 1000;

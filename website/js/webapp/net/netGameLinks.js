/**
 * The single launch point of the network links of a game session: every
 * session takes its link factory and its code channel from here, so that
 * nothing else knows how a link is made. A test page swaps them for the
 * loopback ones (NetLoopbackLink, NetLoopbackCodeChannel) on its prototype.
 */
class NetGameLinks {
    /**
     * @returns {function(): NetLink}
     */
    linkFactory() {
        return () => new NetPeerLink();
    }

    // Codes travel as QR codes read by the camera.
    codeChannel() {
        return null;
    }

    needsCamera() {
        return true;
    }
}

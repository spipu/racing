/**
 * The payload of a sub's answer code: its nickname, which the main shows while
 * it connects and keeps in the lobby. Fail-fast: a payload with anything after
 * the nickname is refused.
 */
class NetGameAnswer {
    /**
     * @param {string} nickname
     * @returns {Uint8Array}
     */
    static encode(nickname) {
        return new NetByteWriter().ascii(nickname).toBytes();
    }

    /**
     * @param {Uint8Array} bytes
     * @returns {string} the nickname
     * @throws {NetError} INVALID_CODE
     */
    static decode(bytes) {
        const reader   = new NetByteReader(bytes);
        const nickname = reader.ascii();
        if (!reader.isAtEnd()) {
            throw new NetError(NetError.INVALID_CODE, 'Unexpected bytes after the answer payload');
        }

        return nickname;
    }
}

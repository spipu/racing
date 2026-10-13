/**
 * Race times as the original shows them: minutes'seconds"thousandths (0'42"213).
 */
class RacingTime {
    /**
     * @param {number|null} ms
     * @returns {string} '-'"--"---' without a time
     */
    static format(ms) {
        if (ms === null) {
            return RacingTime.NONE;
        }
        const total   = Math.max(0, Math.floor(ms));
        const minutes = Math.floor(total / RacingTime.MS_PER_MINUTE);
        const seconds = Math.floor((total % RacingTime.MS_PER_MINUTE) / RacingTime.MS_PER_SECOND);
        const rest    = (total % RacingTime.MS_PER_SECOND);

        return minutes + '\'' + String(seconds).padStart(2, '0') + '"' + String(rest).padStart(3, '0');
    }
}

RacingTime.NONE          = '-\'--"---';
RacingTime.MS_PER_MINUTE = 60000;
RacingTime.MS_PER_SECOND = 1000;

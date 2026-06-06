/**
 * Helper class to track worker restarts and prevent infinite restart loops.
 */
export default class RestartTracker {
    constructor(maxRestarts = 10, restartWindowSeconds = 60) {
        this.maxRestarts = maxRestarts;
        this.restartWindowMs = restartWindowSeconds * 1000;
        this.restartTimes = [];
    }

    /**
     * Records a restart and returns true if the limit has been exceeded.
     * @returns {boolean} True if the number of restarts in the window exceeds maxRestarts
     */
    recordRestart() {
        const now = Date.now();
        this.restartTimes.push(now);
        this.cleanOldRestarts(now);
        return this.restartTimes.length > this.maxRestarts;
    }

    /**
     * Filters out restarts that are older than the tracked window.
     * @param {number} now The current timestamp
     */
    cleanOldRestarts(now) {
        this.restartTimes = this.restartTimes.filter(time => now - time < this.restartWindowMs);
    }
}

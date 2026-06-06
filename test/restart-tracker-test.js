import RestartTracker from '../app/server/restart-tracker.js';

describe('RestartTracker', () => {
    let originalDateNow;
    let mockTime;

    beforeEach(() => {
        originalDateNow = Date.now;
        mockTime = 10000; // start at 10 seconds
        Date.now = () => mockTime;
    });

    afterEach(() => {
        Date.now = originalDateNow;
    });

    it('should not exceed limit under normal conditions', () => {
        const tracker = new RestartTracker(3, 10); // 3 restarts in 10 seconds allowed

        expect(tracker.recordRestart()).toBe(false); // 1st
        mockTime += 2000;
        expect(tracker.recordRestart()).toBe(false); // 2nd
        mockTime += 2000;
        expect(tracker.recordRestart()).toBe(false); // 3rd
    });

    it('should exceed limit when restarts happen too quickly', () => {
        const tracker = new RestartTracker(3, 10);

        expect(tracker.recordRestart()).toBe(false); // 1st
        expect(tracker.recordRestart()).toBe(false); // 2nd
        expect(tracker.recordRestart()).toBe(false); // 3rd
        expect(tracker.recordRestart()).toBe(true);  // 4th (exceeds limit of 3)
    });

    it('should reset count after window expires', () => {
        const tracker = new RestartTracker(2, 5); // 2 restarts in 5 seconds allowed

        expect(tracker.recordRestart()).toBe(false); // 1st
        expect(tracker.recordRestart()).toBe(false); // 2nd
        
        // Wait 6 seconds (beyond the 5 second window)
        mockTime += 6000;
        
        expect(tracker.recordRestart()).toBe(false); // 3rd (effectively 1st in new window)
        expect(tracker.recordRestart()).toBe(false); // 4th
        expect(tracker.recordRestart()).toBe(true);  // 5th (exceeds limit)
    });
});

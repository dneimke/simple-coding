/**
 * @jest-environment jsdom
 */

import { formatTimeFromMs, createSampleEvent } from '../../src/utils/event-utils.js';

describe('Event Utilities', () => {

    describe('formatTimeFromMs', () => {
        test('should format time correctly', () => {
            expect(formatTimeFromMs(0)).toBe('0:00');
            expect(formatTimeFromMs(1000)).toBe('0:01');
            expect(formatTimeFromMs(60000)).toBe('1:00');
            expect(formatTimeFromMs(61000)).toBe('1:01');
            expect(formatTimeFromMs(3600000)).toBe('60:00');
            expect(formatTimeFromMs(3661000)).toBe('61:01');
        });
    });

    describe('createSampleEvent', () => {
        test('should create a properly formatted event object', () => {
            // Test with minutes only
            const event1 = createSampleEvent('GOAL', 5);
            expect(event1).toEqual({
                event: 'GOAL',
                timeMs: 300000 // 5 minutes = 300,000 ms
            });

            // Test with minutes and seconds
            const event2 = createSampleEvent('FOUL', 10, 30);
            expect(event2).toEqual({
                event: 'FOUL',
                timeMs: 630000 // 10min 30sec = 630,000 ms
            });
        });

        test('should handle zero values correctly', () => {
            const event = createSampleEvent('START', 0, 0);
            expect(event).toEqual({
                event: 'START',
                timeMs: 0
            });
        });
    });
});

/**
 * @jest-environment jsdom
 */

import {
    calculateVideoOffset,
    shiftEventTimings
} from '../../src/utils/gameUtils.js';
import {
    shiftGameTimings,
    revertGameTimings
} from '../../src/js/timeline-video.js';

describe('Video Alignment & Time Shifting', () => {
    describe('calculateVideoOffset', () => {
        test('calculates positive offset when video playhead is ahead of first event', () => {
            const result = calculateVideoOffset(242, 2);
            expect(result.offsetSec).toBe(240);
            expect(result.offsetMs).toBe(240000);
            expect(result.formatted).toBe('+04:00');
            expect(result.isPositive).toBe(true);
        });

        test('calculates negative offset when video playhead is behind first event', () => {
            const result = calculateVideoOffset(30, 90);
            expect(result.offsetSec).toBe(-60);
            expect(result.offsetMs).toBe(-60000);
            expect(result.formatted).toBe('-01:00');
            expect(result.isPositive).toBe(false);
        });

        test('handles exact match (zero offset)', () => {
            const result = calculateVideoOffset(120, 120);
            expect(result.offsetSec).toBe(0);
            expect(result.offsetMs).toBe(0);
            expect(result.formatted).toBe('+00:00');
            expect(result.isPositive).toBe(true);
        });

        test('handles invalid or missing inputs gracefully', () => {
            const result = calculateVideoOffset(null, undefined);
            expect(result.offsetSec).toBe(0);
            expect(result.offsetMs).toBe(0);
        });
    });

    describe('shiftEventTimings', () => {
        const sampleEvents = [
            {
                id: 'evt-1',
                event: 'Start',
                timeMs: 2000,
                timestamp: '00:02',
                lead: 3,
                lag: 5,
                labels: [{ group: 'Origin', text: 'Center' }],
                note: 'Match whistle',
                isFavorite: true
            },
            {
                id: 'evt-2',
                event: 'Circle Entry',
                timeMs: 90000,
                timestamp: '01:30',
                lead: 5,
                lag: 5
            },
            {
                id: 'evt-3',
                event: 'Shot',
                timeMs: 150000,
                timestamp: '02:30'
            }
        ];

        test('shifts all events forward for positive offset', () => {
            const shifted = shiftEventTimings(sampleEvents, 240000); // +4 mins
            expect(shifted.length).toBe(3);

            expect(shifted[0].timeMs).toBe(242000);
            expect(shifted[0].timestamp).toBe('04:02');
            expect(shifted[0].id).toBe('evt-1');
            expect(shifted[0].event).toBe('Start');
            expect(shifted[0].lead).toBe(3);
            expect(shifted[0].lag).toBe(5);
            expect(shifted[0].note).toBe('Match whistle');
            expect(shifted[0].isFavorite).toBe(true);
            expect(shifted[0].labels).toEqual([{ group: 'Origin', text: 'Center' }]);

            expect(shifted[1].timeMs).toBe(330000);
            expect(shifted[1].timestamp).toBe('05:30');

            expect(shifted[2].timeMs).toBe(390000);
            expect(shifted[2].timestamp).toBe('06:30');
        });

        test('shifts events backward for negative offset', () => {
            const shifted = shiftEventTimings(sampleEvents, -60000); // -1 min
            expect(shifted[1].timeMs).toBe(30000);
            expect(shifted[1].timestamp).toBe('00:30');

            expect(shifted[2].timeMs).toBe(90000);
            expect(shifted[2].timestamp).toBe('01:30');
        });

        test('clamps negative shifted times to zero (00:00) without throwing', () => {
            const shifted = shiftEventTimings(sampleEvents, -10000); // -10s on event at 2s
            expect(shifted[0].timeMs).toBe(0);
            expect(shifted[0].timestamp).toBe('00:00');
        });

        test('does not mutate original events array', () => {
            const originalCopy = JSON.parse(JSON.stringify(sampleEvents));
            shiftEventTimings(sampleEvents, 50000);
            expect(sampleEvents).toEqual(originalCopy);
        });

        test('handles empty or non-array events safely', () => {
            expect(shiftEventTimings([], 1000)).toEqual([]);
            expect(shiftEventTimings(null, 1000)).toEqual([]);
        });
    });

    describe('shiftGameTimings and revertGameTimings storage integration', () => {
        const GAME_ID = 'test-game-align-123';
        const sampleGame = {
            id: GAME_ID,
            title: 'FIRE vs TIGERS',
            teams: 'FIRE vs TIGERS',
            events: [
                { id: 'ev-1', event: 'Start', timeMs: 2000, timestamp: '00:02' },
                { id: 'ev-2', event: 'Circle Entry', timeMs: 60000, timestamp: '01:00' }
            ],
            metadata: {}
        };

        beforeEach(() => {
            localStorage.clear();
            localStorage.setItem('fieldHockeyGames_v1', JSON.stringify([JSON.parse(JSON.stringify(sampleGame))]));
        });

        test('shifts game in-place and saves backup events for safe recovery', () => {
            const result = shiftGameTimings(GAME_ID, 120000, false); // +2 mins
            expect(result).not.toBeNull();
            expect(result.success).toBe(true);
            expect(result.isCopy).toBe(false);

            const games = JSON.parse(localStorage.getItem('fieldHockeyGames_v1'));
            const game = games.find(g => g.id === GAME_ID);
            expect(game.events[0].timeMs).toBe(122000);
            expect(game.events[0].timestamp).toBe('02:02');
            expect(game.events[1].timeMs).toBe(180000);
            expect(game.events[1].timestamp).toBe('03:00');
            expect(game.metadata.videoOffsetMs).toBe(120000);
            expect(game.metadata.backupEvents).toHaveLength(2);
            expect(game.metadata.backupEvents[0].timeMs).toBe(2000);

            // Revert back
            const revertResult = revertGameTimings(GAME_ID);
            expect(revertResult.success).toBe(true);
            const revertedGames = JSON.parse(localStorage.getItem('fieldHockeyGames_v1'));
            const reverted = revertedGames.find(g => g.id === GAME_ID);
            expect(reverted.events[0].timeMs).toBe(2000);
            expect(reverted.events[0].timestamp).toBe('00:02');
            expect(reverted.metadata.backupEvents).toBeUndefined();
        });

        test('supports negative shifts with clamping in-place', () => {
            const result = shiftGameTimings(GAME_ID, -10000, false); // -10s
            expect(result.success).toBe(true);
            const games = JSON.parse(localStorage.getItem('fieldHockeyGames_v1'));
            const game = games.find(g => g.id === GAME_ID);
            expect(game.events[0].timeMs).toBe(0);
            expect(game.events[0].timestamp).toBe('00:00');
            expect(game.events[1].timeMs).toBe(50000);
            expect(game.events[1].timestamp).toBe('00:50');
        });

        test('shifts as new copy preserving original game untouched', () => {
            const result = shiftGameTimings(GAME_ID, 240000, true); // +4 mins
            expect(result.success).toBe(true);
            expect(result.isCopy).toBe(true);
            expect(result.game.id).not.toBe(GAME_ID);
            expect(result.game.title).toBe('FIRE vs TIGERS (Video Aligned)');

            const games = JSON.parse(localStorage.getItem('fieldHockeyGames_v1'));
            expect(games).toHaveLength(2);

            // Original game unchanged
            const original = games.find(g => g.id === GAME_ID);
            expect(original.events[0].timeMs).toBe(2000);
            expect(original.events[0].timestamp).toBe('00:02');

            // Shifted copy updated
            const copy = games.find(g => g.id === result.game.id);
            expect(copy.events[0].timeMs).toBe(242000);
            expect(copy.events[0].timestamp).toBe('04:02');
            expect(copy.metadata.originalGameId).toBe(GAME_ID);
        });
    });
});

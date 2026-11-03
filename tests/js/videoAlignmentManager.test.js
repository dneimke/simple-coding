/**
 * @jest-environment jsdom
 */

import {
    calculateAlignmentState,
    shiftGameTimings,
    revertGameTimings
} from '../../src/js/videoAlignmentManager.js';
import { storageService } from '../../src/services/storageService.js';
import { notificationService } from '../../src/services/notificationService.js';

describe('videoAlignmentManager', () => {
    let mockVideo;
    let mockGame;
    let mockNotify;

    beforeEach(() => {
        jest.clearAllMocks();
        mockNotify = jest.spyOn(notificationService, 'notify').mockImplementation(() => {});
        jest.spyOn(storageService, 'setItem').mockReturnValue(true);

        mockVideo = document.createElement('video');
        mockVideo.src = 'http://example.com/video.mp4';
        Object.defineProperty(mockVideo, 'readyState', { value: 4, configurable: true });
        Object.defineProperty(mockVideo, 'currentTime', { value: 120, configurable: true });

        mockGame = {
            id: 'game-1',
            teams: 'FIRE vs TIGERS',
            events: [
                { id: 'ev-1', event: 'CE', timeMs: 60000 },
                { id: 'ev-2', event: 'SHOT', timeMs: 90000 }
            ],
            metadata: {}
        };
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('calculateAlignmentState', () => {
        test('warns and returns null when video is missing or not loaded', () => {
            const unloadedVideo = document.createElement('video');
            const result = calculateAlignmentState(unloadedVideo, mockGame);

            expect(result).toBeNull();
            expect(mockNotify).toHaveBeenCalledWith('Please attach or load a video before aligning timings.', 'warn');
        });

        test('returns null when game or game events are empty', () => {
            expect(calculateAlignmentState(mockVideo, null)).toBeNull();
            expect(calculateAlignmentState(mockVideo, { id: 'g1', events: [] })).toBeNull();
        });

        test('calculates correct offset from loaded video and earliest event', () => {
            // video.currentTime is 120s, first event is 60s (60000ms). Offset should be +60s (+60000ms)
            const result = calculateAlignmentState(mockVideo, mockGame);

            expect(result).not.toBeNull();
            expect(result.offset.offsetSec).toBe(60);
            expect(result.offset.offsetMs).toBe(60000);
            expect(result.offset.formatted).toBe('+01:00');
            expect(result.game).toBe(mockGame);
        });
    });

    describe('shiftGameTimings and revertGameTimings', () => {
        test('shifts game events in-place with backup', () => {
            const savedGames = [{ ...mockGame }];
            const deps = {
                getSavedGames: () => savedGames,
                findGameById: (games, id) => ({ game: games[0], index: 0 }),
                getCurrentDraftGame: () => null,
                updateCurrentDraftEvents: jest.fn()
            };

            const res = shiftGameTimings('game-1', 10000, false, deps);

            expect(res.success).toBe(true);
            expect(res.isCopy).toBe(false);
            expect(res.game.events[0].timeMs).toBe(70000);
            expect(res.game.metadata.videoOffsetMs).toBe(10000);
            expect(res.game.metadata.backupEvents).toHaveLength(2);
            expect(deps.updateCurrentDraftEvents).toHaveBeenCalled();
        });

        test('shifts game events by creating an aligned copy', () => {
            const savedGames = [{ ...mockGame }];
            const deps = {
                getSavedGames: () => savedGames,
                findGameById: (games, id) => ({ game: games[0], index: 0 })
            };

            const res = shiftGameTimings('game-1', 5000, true, deps);

            expect(res.success).toBe(true);
            expect(res.isCopy).toBe(true);
            expect(res.game.id).not.toBe('game-1');
            expect(res.game.title).toContain('(Video Aligned)');
            expect(res.game.events[0].timeMs).toBe(65000);
            expect(savedGames).toHaveLength(2);
        });

        test('reverts game events back from backup metadata', () => {
            const gameWithBackup = {
                ...mockGame,
                events: [{ id: 'ev-1', event: 'CE', timeMs: 99999 }],
                metadata: {
                    backupEvents: [{ id: 'ev-1', event: 'CE', timeMs: 60000 }],
                    videoOffsetMs: 39999
                }
            };
            const savedGames = [gameWithBackup];
            const deps = {
                getSavedGames: () => savedGames,
                findGameById: (games, id) => ({ game: games[0], index: 0 }),
                getCurrentDraftGame: () => null,
                updateCurrentDraftEvents: jest.fn()
            };

            const res = revertGameTimings('game-1', deps);

            expect(res.success).toBe(true);
            expect(res.game.events[0].timeMs).toBe(60000);
            expect(res.game.metadata.backupEvents).toBeUndefined();
            expect(res.game.metadata.videoOffsetMs).toBeUndefined();
        });
    });
});

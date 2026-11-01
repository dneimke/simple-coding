import { GameStorageManager } from '../../src/services/gameStorageManager.js';
import { storageService } from '../../src/services/storageService.js';

jest.mock('../../src/services/storageService.js', () => ({
    storageService: {
        getItem: jest.fn(),
        setItem: jest.fn(() => true)
    }
}));

jest.mock('../../src/services/notificationService.js', () => ({
    notificationService: { notify: jest.fn() }
}));

describe('GameStorageManager.getGameById', () => {
    let manager;

    beforeEach(() => {
        jest.clearAllMocks();
        manager = new GameStorageManager();
    });

    test('returns the game with a matching id', () => {
        const games = [
            { id: 'game-1', timestamp: 't1', events: [] },
            { id: 'game-2', timestamp: 't2', events: [{ event: 'GOAL', timeMs: 1000 }] }
        ];
        storageService.getItem.mockReturnValue(games);

        expect(manager.getGameById('game-2')).toEqual(games[1]);
    });

    test('returns null for an unknown or missing id', () => {
        storageService.getItem.mockReturnValue([{ id: 'game-1', timestamp: 't1', events: [] }]);

        expect(manager.getGameById('nope')).toBeNull();
        expect(manager.getGameById(undefined)).toBeNull();
    });

    test('returns null when no games are stored', () => {
        storageService.getItem.mockReturnValue(null);

        expect(manager.getGameById('game-1')).toBeNull();
    });
});

describe('GameStorageManager.appendEventsToGame', () => {
    let manager;

    beforeEach(() => {
        jest.clearAllMocks();
        manager = new GameStorageManager();
    });

    test('successfully appends events to an existing game by id', () => {
        const games = [
            {
                id: 'game-1',
                teams: 'Team A vs Team B',
                elapsedTime: 20000,
                events: [
                    { event: 'CE', timeMs: 10000 }
                ]
            }
        ];
        storageService.getItem.mockReturnValue(games);

        const newEvents = [
            { event: 'SHOT', timeMs: 30000 }
        ];

        const result = manager.appendEventsToGame('game-1', newEvents);
        expect(result.success).toBe(true);
        expect(result.addedCount).toBe(1);
        expect(result.duplicateCount).toBe(0);
        expect(result.game.events).toHaveLength(2);
        expect(result.game.elapsedTime).toBe(30000);
        expect(storageService.setItem).toHaveBeenCalledWith(
            manager.STORAGE_KEY,
            expect.arrayContaining([expect.objectContaining({ id: 'game-1' })])
        );
    });

    test('deduplicates matching events and returns accurate counts', () => {
        const games = [
            {
                id: 'game-1',
                elapsedTime: 20000,
                events: [
                    { event: 'SHOT', timeMs: 15000 }
                ]
            }
        ];
        storageService.getItem.mockReturnValue(games);

        const newEvents = [
            { event: 'SHOT', timeMs: 15200 },
            { event: 'GOAL', timeMs: 16000 }
        ];

        const result = manager.appendEventsToGame('game-1', newEvents);
        expect(result.success).toBe(true);
        expect(result.addedCount).toBe(1);
        expect(result.duplicateCount).toBe(1);
        expect(result.game.events).toHaveLength(2);
    });

    test('returns failure when game is not found', () => {
        storageService.getItem.mockReturnValue([]);
        const result = manager.appendEventsToGame('non-existent', [{ event: 'SHOT', timeMs: 1000 }]);
        expect(result.success).toBe(false);
        expect(result.message).toBe('Game not found');
    });
});

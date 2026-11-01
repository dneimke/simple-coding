import { GameStorageManager, findGameInArray } from '../../src/services/gameStorageManager.js';
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

describe('GameStorageManager', () => {
    let manager;

    beforeEach(() => {
        jest.clearAllMocks();
        manager = new GameStorageManager();
    });

    describe('findGameInArray', () => {
        test('finds game and its index in array', () => {
            const arr = [{ id: 'a' }, { id: 'b' }];
            expect(findGameInArray(arr, 'b')).toEqual({ game: { id: 'b' }, index: 1 });
            expect(findGameInArray(arr, 'c')).toEqual({ game: null, index: -1 });
            expect(findGameInArray(null, 'a')).toEqual({ game: null, index: -1 });
        });
    });

    describe('getGameById', () => {
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

    describe('upsertGame', () => {
        test('creates a new game if it does not exist', () => {
            storageService.getItem.mockReturnValue([]);

            const events = [{ id: 'e1', event: 'SHOT', timeMs: 2500 }];
            const result = manager.upsertGame('new-game', events, { teams: 'Team A vs Team B' });

            expect(result).toBe(true);
            expect(storageService.setItem).toHaveBeenCalledWith(
                'fieldHockeyGames_v1',
                expect.arrayContaining([
                    expect.objectContaining({
                        id: 'new-game',
                        teams: 'Team A vs Team B',
                        events: expect.arrayContaining([
                            expect.objectContaining({ id: 'e1', event: 'SHOT', timeMs: 2500 })
                        ])
                    })
                ])
            );
        });

        test('updates an existing game while preserving metadata and fields', () => {
            const existing = [
                {
                    id: 'existing-game',
                    teams: 'Team A vs Team B',
                    timestamp: '2026-01-01T10:00:00Z',
                    elapsedTime: 5000,
                    metadata: { source: 'video', lastUpdated: 'old' },
                    events: [{ id: 'e1', event: 'CE', timeMs: 1000 }]
                }
            ];
            storageService.getItem.mockReturnValue(existing);

            const updatedEvents = [
                { id: 'e1', event: 'CE', timeMs: 1000 },
                { id: 'e2', event: 'GOAL', timeMs: 6000 }
            ];
            const result = manager.upsertGame('existing-game', updatedEvents, { reviewStarred: true });

            expect(result).toBe(true);
            const savedArray = storageService.setItem.mock.calls[0][1];
            expect(savedArray[0].id).toBe('existing-game');
            expect(savedArray[0].teams).toBe('Team A vs Team B');
            expect(savedArray[0].events.length).toBe(2);
            expect(savedArray[0].elapsedTime).toBe(6000);
            expect(savedArray[0].metadata.source).toBe('video');
            expect(savedArray[0].metadata.reviewStarred).toBe(true);
        });
    });

    describe('updateGame', () => {
        test('updates game properties at given index while preserving remaining properties', () => {
            const games = [
                { id: 'g1', teams: 'Fire vs Tigers', events: [], timestamp: '2026-01-01' },
                { id: 'g2', teams: 'Old Team', events: [{ event: 'SHOT' }], timestamp: '2026-01-02' }
            ];
            storageService.getItem.mockReturnValue(games);

            const result = manager.updateGame(1, { teams: 'New Team Name' });
            expect(result).toBe(true);
            expect(storageService.setItem).toHaveBeenCalledWith(
                'fieldHockeyGames_v1',
                expect.arrayContaining([
                    expect.objectContaining({ id: 'g2', teams: 'New Team Name', timestamp: '2026-01-02' })
                ])
            );
        });

        test('returns false for invalid index', () => {
            storageService.getItem.mockReturnValue([{ id: 'g1', events: [] }]);
            expect(manager.updateGame(5, { teams: 'Test' })).toBe(false);
            expect(manager.updateGame(-1, { teams: 'Test' })).toBe(false);
            expect(storageService.setItem).not.toHaveBeenCalled();
        });
    });

    describe('removeGame', () => {
        test('removes game at given index and updates storage', () => {
            const games = [
                { id: 'g1', timestamp: '2026-01-01' },
                { id: 'g2', timestamp: '2026-01-02' }
            ];
            storageService.getItem.mockReturnValue(games);

            const result = manager.removeGame(0);
            expect(result).toBe(true);
            expect(storageService.setItem).toHaveBeenCalledWith('fieldHockeyGames_v1', [{ id: 'g2', timestamp: '2026-01-02' }]);
        });

        test('returns false for invalid index', () => {
            storageService.getItem.mockReturnValue([]);
            expect(manager.removeGame(0)).toBe(false);
        });
    });
});

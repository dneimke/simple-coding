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

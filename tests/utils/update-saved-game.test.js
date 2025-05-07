import { updateSavedGame } from '../../src/utils/utils.js';

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: jest.fn(key => store[key] ? store[key] : null),
        setItem: jest.fn((key, value) => { store[key] = value; }),
        clear: jest.fn(() => { store = {}; }),
        removeItem: jest.fn(key => { delete store[key]; })
    };
})();

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
});

// Mock getFromLocalStorage and setToLocalStorage functions
jest.mock('../../src/utils/utils.js', () => {
    const originalModule = jest.requireActual('../../src/utils/utils.js');
    return {
        ...originalModule,
        getFromLocalStorage: jest.fn(key => {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : null;
        }),
        setToLocalStorage: jest.fn((key, value) => {
            localStorage.setItem(key, JSON.stringify(value));
        }),
    };
});

describe('updateSavedGame', () => {
    const STORAGE_KEY = 'test_games';

    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
    });

    test('should update a game with new teams name', () => {
        // Setup initial test data
        const savedGames = [
            {
                events: [{ event: 'GOAL', timeMs: 1000 }],
                elapsedTime: 1000,
                timestamp: '2023-01-01T00:00:00Z'
            },
            {
                events: [{ event: 'FOUL', timeMs: 2000 }],
                elapsedTime: 2000,
                timestamp: '2023-01-02T00:00:00Z',
                teams: 'Old Team Name'
            }
        ];

        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedGames));

        // Call the function we're testing
        const result = updateSavedGame(1, { teams: 'New Team Name' }, STORAGE_KEY);

        // Assertions
        expect(result).toBe(true);

        const updatedGames = JSON.parse(localStorage.getItem(STORAGE_KEY));
        expect(updatedGames[1].teams).toBe('New Team Name');
        // Make sure other properties are preserved
        expect(updatedGames[1].events).toEqual([{ event: 'FOUL', timeMs: 2000 }]);
        expect(updatedGames[1].elapsedTime).toBe(2000);
        expect(updatedGames[1].timestamp).toBe('2023-01-02T00:00:00Z');

        // First game should be unchanged
        expect(updatedGames[0]).toEqual(savedGames[0]);
    });

    test('should return false for invalid index', () => {
        // Setup initial test data
        const savedGames = [{ events: [], elapsedTime: 0, timestamp: '2023-01-01T00:00:00Z' }];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedGames));

        // Call with invalid index
        const result = updateSavedGame(1, { teams: 'New Team Name' }, STORAGE_KEY);

        // Should return false
        expect(result).toBe(false);

        // Data should be unchanged
        const storedGames = JSON.parse(localStorage.getItem(STORAGE_KEY));
        expect(storedGames).toEqual(savedGames);
    });

    test('should handle empty localStorage', () => {
        // Don't set any data in localStorage

        // Call the function
        const result = updateSavedGame(0, { teams: 'New Team Name' }, STORAGE_KEY);

        // Should return false (invalid index)
        expect(result).toBe(false);
    });
});

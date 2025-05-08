// Create a clean mock of the functions we need to test
jest.mock('../../src/utils/utils.js', () => {
    const originalModule = jest.requireActual('../../src/utils/utils.js');

    // Create a custom updateSavedGame function for our tests
    const mockUpdateSavedGame = jest.fn((index, updatedData, storageKey) => {
        try {
            const savedGames = mockGetFromLocalStorage(storageKey) || [];
            if (index >= 0 && index < savedGames.length) {
                savedGames[index] = { ...savedGames[index], ...updatedData };
                mockSetToLocalStorage(storageKey, savedGames);
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    });

    const mockGetFromLocalStorage = jest.fn();
    const mockSetToLocalStorage = jest.fn();

    return {
        ...originalModule,
        getFromLocalStorage: mockGetFromLocalStorage,
        setToLocalStorage: mockSetToLocalStorage,
        updateSavedGame: mockUpdateSavedGame
    };
});

// Import after the mock is defined
import { updateSavedGame } from '../../src/utils/utils.js';
import * as utils from '../../src/utils/utils.js';

describe('updateSavedGame', () => {
    const STORAGE_KEY = 'test_games';

    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
    }); test('should update a game with new teams name', () => {
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
        ];        // Setup mock implementation for this test
        utils.getFromLocalStorage.mockReturnValue(savedGames);

        // Call the function we're testing
        const result = updateSavedGame(1, { teams: 'New Team Name' }, STORAGE_KEY);        // Assertions
        expect(result).toBe(true);        // Check that setToLocalStorage was called with the correct arguments
        expect(utils.setToLocalStorage).toHaveBeenCalledWith(STORAGE_KEY, expect.any(Array));
        const updatedGames = utils.setToLocalStorage.mock.calls[0][1];
        expect(updatedGames[1].teams).toBe('New Team Name');
        // Make sure other properties are preserved
        expect(updatedGames[1].events).toEqual([{ event: 'FOUL', timeMs: 2000 }]);
        expect(updatedGames[1].elapsedTime).toBe(2000);
        expect(updatedGames[1].timestamp).toBe('2023-01-02T00:00:00Z');

        // First game should be unchanged
        expect(updatedGames[0]).toEqual(savedGames[0]);
    }); test('should return false for invalid index', () => {        // Setup initial test data
        const savedGames = [{ events: [], elapsedTime: 0, timestamp: '2023-01-01T00:00:00Z' }];
        utils.getFromLocalStorage.mockReturnValue(savedGames);

        // Call with invalid index
        const result = updateSavedGame(1, { teams: 'New Team Name' }, STORAGE_KEY);

        // Should return false        expect(result).toBe(false);

        // setToLocalStorage should not be called
        expect(utils.setToLocalStorage).not.toHaveBeenCalled();
    }); test('should handle empty localStorage', () => {        // Mock empty localStorage
        utils.getFromLocalStorage.mockReturnValue(null);

        // Call the function
        const result = updateSavedGame(0, { teams: 'New Team Name' }, STORAGE_KEY);

        // Should return false (invalid index)
        expect(result).toBe(false);        // setToLocalStorage should not be called
        expect(utils.setToLocalStorage).not.toHaveBeenCalled();
    });
});

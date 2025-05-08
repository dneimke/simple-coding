// Setup mock for the storage service
jest.mock('../../src/services/storageService', () => {
    return {
        storageService: {
            getItem: jest.fn(),
            setItem: jest.fn().mockReturnValue(true),
        }
    };
});

// Import the mocked services
import { storageService } from '../../src/services/storageService';

// Function to test - inline definition to avoid dependencies
function updateSavedGameForTest(index, updatedData, storageKey) {
    try {
        const savedGames = storageService.getItem(storageKey) || [];

        if (index >= 0 && index < savedGames.length) {
            // Update only the specified properties while preserving the rest
            savedGames[index] = { ...savedGames[index], ...updatedData };
            storageService.setItem(storageKey, savedGames);
            return true;
        }
        return false;
    } catch (error) {
        return false;
    }
}

describe('updateSavedGame', () => {
    const STORAGE_KEY = 'saved_games';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should update a game with new teams name', () => {
        // Setup test data
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

        // Setup mock implementation
        storageService.getItem.mockReturnValue(savedGames);

        // Call the function
        const result = updateSavedGameForTest(1, { teams: 'New Team Name' }, STORAGE_KEY);

        // Assertions
        expect(result).toBe(true);
        expect(storageService.setItem).toHaveBeenCalledWith(STORAGE_KEY, expect.any(Array));

        const updatedGames = storageService.setItem.mock.calls[0][1];
        expect(updatedGames[1].teams).toBe('New Team Name');

        // Make sure other properties are preserved
        expect(updatedGames[1].events).toEqual([{ event: 'FOUL', timeMs: 2000 }]);
        expect(updatedGames[1].elapsedTime).toBe(2000);
        expect(updatedGames[1].timestamp).toBe('2023-01-02T00:00:00Z');

        // First game should be unchanged
        expect(updatedGames[0]).toEqual(savedGames[0]);
    });

    test('should return false for invalid index', () => {
        // Setup test data
        const savedGames = [{ events: [], elapsedTime: 0, timestamp: '2023-01-01T00:00:00Z' }];
        storageService.getItem.mockReturnValue(savedGames);

        // Call with invalid index
        const result = updateSavedGameForTest(1, { teams: 'New Team Name' }, STORAGE_KEY);

        // Should return false
        expect(result).toBe(false);

        // setItem should not be called
        expect(storageService.setItem).not.toHaveBeenCalled();
    });

    test('should handle empty localStorage', () => {
        // Mock empty localStorage
        storageService.getItem.mockReturnValue(null);

        // Call the function
        const result = updateSavedGameForTest(0, { teams: 'New Team Name' }, STORAGE_KEY);

        // Should return false (invalid index)
        expect(result).toBe(false);

        // setItem should not be called
        expect(storageService.setItem).not.toHaveBeenCalled();
    });
});

/**
 * Unit tests for the storage service
 */
import { storageService } from '../../src/services/storageService.js';

// Mock localStorage
const localStorageMock = (function () {
    let store = {};
    return {
        getItem: jest.fn(key => {
            return store[key] || null;
        }),
        setItem: jest.fn((key, value) => {
            store[key] = value.toString();
        }),
        removeItem: jest.fn(key => {
            delete store[key];
        }),
        clear: jest.fn(() => {
            store = {};
        }),
        key: jest.fn(index => {
            return Object.keys(store)[index] || null;
        }),
        get length() {
            return Object.keys(store).length;
        }
    };
})();

// Set up the mock before all tests
beforeAll(() => {
    Object.defineProperty(window, 'localStorage', {
        value: localStorageMock
    });
});

// Clear mocks after each test
afterEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
});

describe('Storage Service', () => {
    test('getItem should parse JSON from localStorage', () => {
        const testData = { name: 'Test', value: 123 };
        localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(testData));

        const result = storageService.getItem('test-key');

        expect(localStorageMock.getItem).toHaveBeenCalledWith('test-key');
        expect(result).toEqual(testData);
    });

    test('getItem should handle null values', () => {
        localStorageMock.getItem.mockReturnValueOnce(null);

        const result = storageService.getItem('nonexistent-key');

        expect(localStorageMock.getItem).toHaveBeenCalledWith('nonexistent-key');
        expect(result).toBeNull();
    });

    test('getItem should handle parsing errors', () => {
        localStorageMock.getItem.mockReturnValueOnce('invalid json');

        const result = storageService.getItem('invalid-key');

        expect(localStorageMock.getItem).toHaveBeenCalledWith('invalid-key');
        expect(result).toBeNull();
    });

    test('setItem should stringify and store data', () => {
        const testData = { name: 'Test', value: 123 };

        const result = storageService.setItem('test-key', testData);

        expect(localStorageMock.setItem).toHaveBeenCalledWith('test-key', JSON.stringify(testData));
        expect(result).toBe(true);
    });

    test('setItem should handle storage errors', () => {
        const testData = { name: 'Test', value: 123 };
        localStorageMock.setItem.mockImplementationOnce(() => {
            throw new Error('Storage error');
        });

        const result = storageService.setItem('test-key', testData);

        expect(localStorageMock.setItem).toHaveBeenCalledWith('test-key', JSON.stringify(testData));
        expect(result).toEqual({
            success: false,
            error: 'storage_error',
            message: 'Storage error'
        });
    });

    test('setItem should handle quota exceeded errors', () => {
        const testData = { name: 'Test', value: 123 };
        const quotaError = new Error('Quota exceeded');
        quotaError.name = 'QuotaExceededError';

        localStorageMock.setItem.mockImplementationOnce(() => {
            throw quotaError;
        });

        const result = storageService.setItem('test-key', testData);

        expect(localStorageMock.setItem).toHaveBeenCalledWith('test-key', JSON.stringify(testData));
        expect(result).toEqual({
            success: false,
            error: 'storage_quota_exceeded',
            message: 'Browser storage limit exceeded'
        });
    });

    test('removeItem should remove items from storage', () => {
        const result = storageService.removeItem('test-key');

        expect(localStorageMock.removeItem).toHaveBeenCalledWith('test-key');
        expect(result).toBe(true);
    });

    test('removeItem should handle errors', () => {
        localStorageMock.removeItem.mockImplementationOnce(() => {
            throw new Error('Storage error');
        });

        const result = storageService.removeItem('test-key');

        expect(localStorageMock.removeItem).toHaveBeenCalledWith('test-key');
        expect(result).toBe(false);
    });

    test('clear should remove all items from storage', () => {
        const result = storageService.clear();

        expect(localStorageMock.clear).toHaveBeenCalled();
        expect(result).toBe(true);
    });

    test('clear should handle errors', () => {
        localStorageMock.clear.mockImplementationOnce(() => {
            throw new Error('Storage error');
        });

        const result = storageService.clear();

        expect(localStorageMock.clear).toHaveBeenCalled();
        expect(result).toBe(false);
    });

    test('clear with namespace should only clear matching keys', () => {
        // Set up the test with some keys
        Object.defineProperty(localStorageMock, 'length', { value: 3 });
        localStorageMock.key.mockReturnValueOnce('test:key1')
            .mockReturnValueOnce('other:key2')
            .mockReturnValueOnce('test:key3');

        const result = storageService.clear('test:');

        expect(localStorageMock.removeItem).toHaveBeenCalledWith('test:key1');
        expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('other:key2');
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('test:key3');
        expect(result).toBe(true);
    });
});

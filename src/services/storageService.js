/**
 * Storage Service - Handles all localStorage interactions
 *
 * This service provides a centralized way to interact with localStorage
 * and properly handles all error cases when working with browser storage.
 */

// Import logger if available in the project
let logger;
try {
    // Attempt to import logger - adapt this import based on actual project structure
    logger = console;
} catch (error) {
    // Fallback to console if logger is not available
    logger = console;
}

/**
 * Storage Service - Handles all localStorage interactions
 */
export const storageService = {
    /**
     * Get item from localStorage and parse as JSON
     * @param {string} key - Storage key
     * @returns {any} Parsed item or null if not found/invalid
     */
    getItem(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            logger.error(`Error getting data from localStorage for key: ${key}`, error);
            return null;
        }
    },

    /**
     * Store item in localStorage as JSON
     * @param {string} key - Storage key
     * @param {any} value - Value to store
     * @returns {boolean|Object} True if successful, error object if failed
     */
    setItem(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            logger.error(`Error setting data to localStorage for key: ${key}`, error);

            if (error.name === 'QuotaExceededError') {
                return {
                    success: false,
                    error: 'storage_quota_exceeded',
                    message: 'Browser storage limit exceeded'
                };
            }

            return {
                success: false,
                error: 'storage_error',
                message: error.message
            };
        }
    },

    /**
     * Remove item from localStorage
     * @param {string} key - Storage key to remove
     * @returns {boolean} Success status
     */
    removeItem(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            logger.error(`Error removing data from localStorage for key: ${key}`, error);
            return false;
        }
    },

    /**
     * Clear all items from localStorage
     * @param {string} [namespace] - Optional namespace prefix to clear only matching keys
     * @returns {boolean} Success status
     */
    clear(namespace) {
        try {
            if (namespace) {
                // Clear only keys starting with the namespace
                const keysToRemove = [];

                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith(namespace)) {
                        keysToRemove.push(key);
                    }
                }

                keysToRemove.forEach(key => localStorage.removeItem(key));
            } else {
                // Clear all localStorage
                localStorage.clear();
            }

            return true;
        } catch (error) {
            logger.error('Error clearing localStorage', error);
            return false;
        }
    }
};

export default storageService;

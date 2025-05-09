/**
 * GameStorageManager - Manages saved games with automatic limits and storage monitoring
 *
 * Provides efficient management of saved games in localStorage with:
 * - Automatic pruning of oldest games when exceeding limits
 * - Storage quota monitoring and warnings
 * - Methods for saving, loading, and managing games
 */

import { storageService } from './storageService.js';
import { logger } from '../utils/formatUtils.js';
import { notificationService } from './notificationService.js';

export class GameStorageManager {
    /**
     * Initialize the GameStorageManager
     * @param {number} maxGames - Maximum number of games to store
     * @param {string} storageKey - localStorage key for saved games
     */
    constructor(maxGames = 20, storageKey = 'fieldHockeyGames_v1') {
        this.MAX_GAMES = maxGames;
        this.STORAGE_KEY = storageKey;
    }

    /**
     * Saves a game to localStorage, pruning oldest if exceeding max limit
     * @param {Object} game - Game object to save
     * @returns {boolean|Object} True if saved successfully, error object if failed
     * @throws {Error} If storage quota is exceeded
     */    saveGame(game) {
        try {
            // Ensure game has required properties
            if (!game || !game.timestamp) {
                throw new Error('Invalid game data');
            }

            const games = this.getAllGames();

            // Add new game at the beginning (most recent first)
            games.unshift({ ...game });

            // Prune if exceeding max limit
            if (games.length > this.MAX_GAMES) {
                games.splice(this.MAX_GAMES);
                logger.log(`Pruned game list to ${this.MAX_GAMES} games`);
            }

            // Save back to storage
            const result = storageService.setItem(this.STORAGE_KEY, games);

            if (result === true) {
                logger.log('Game saved successfully.');
                return true;
            } else {
                // Handle storage service error
                logger.error('Error saving game:', result.message);
                return result;
            }
        } catch (error) {
            logger.error('Error in GameStorageManager.saveGame:', error);

            // Check if error is related to quota
            if (this._isQuotaError(error)) {
                throw new Error('Storage quota exceeded. Please export and remove some games.');
            }
            throw error;
        }
    }

    /**
     * Gets all saved games from localStorage
     * @returns {Array} Array of game objects
     */
    getAllGames() {
        try {
            const games = storageService.getItem(this.STORAGE_KEY);
            return games || [];
        } catch (error) {
            logger.error('Error retrieving games:', error);
            return [];
        }
    }

    /**
     * Gets a specific game by index
     * @param {number} index - Index of the game to retrieve
     * @returns {Object|null} Game object if found, null otherwise
     */
    getGameByIndex(index) {
        const games = this.getAllGames();
        return (index >= 0 && index < games.length) ? games[index] : null;
    }

    /**
     * Updates a saved game
     * @param {number} index - Index of the game to update
     * @param {Object} updatedData - Updated game data
     * @returns {boolean|Object} True if successful, error object if failed
     */
    updateGame(index, updatedData) {
        try {
            const games = this.getAllGames();
            if (index >= 0 && index < games.length) {
                // Update only the specified properties while preserving the rest
                games[index] = { ...games[index], ...updatedData };

                const result = storageService.setItem(this.STORAGE_KEY, games);

                if (result === true) {
                    logger.log('Game updated successfully.');
                    return true;
                } else {
                    logger.error('Error updating game:', result.message);
                    return result;
                }
            } else {
                logger.warn('Invalid game index for update.');
                return false;
            }
        } catch (error) {
            logger.error('Error updating game:', error);
            return false;
        }
    }

    /**
     * Removes a game from storage
     * @param {number} index - Index of game to remove
     * @returns {boolean|Object} True if successful, error object if failed
     */
    removeGame(index) {
        try {
            const games = this.getAllGames();
            if (index >= 0 && index < games.length) {
                games.splice(index, 1);
                const result = storageService.setItem(this.STORAGE_KEY, games);

                if (result === true) {
                    logger.log('Game deleted successfully.');
                    return true;
                } else {
                    logger.error('Error deleting game:', result.message);
                    return result;
                }
            } else {
                logger.warn('Invalid game index for deletion.');
                return false;
            }
        } catch (error) {
            logger.error('Error removing game:', error);
            return false;
        }
    }

    /**
     * Calculates and returns current storage usage statistics
     * @returns {Object} Storage usage info
     */
    getStorageUsage() {
        try {
            // Calculate size of games data
            const games = this.getAllGames();
            const gamesJson = JSON.stringify(games);
            const usedBytes = new Blob([gamesJson]).size;

            // Calculate total localStorage usage
            let totalUsage = 0;
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const value = localStorage.getItem(key) || '';
                totalUsage += new Blob([key, value]).size;
            }

            // Approximate storage limit (varies by browser)
            // Conservative estimate of 5MB
            const estimatedLimit = 5 * 1024 * 1024;

            return {
                gamesCount: games.length,
                used: usedBytes,
                usedMB: (usedBytes / (1024 * 1024)).toFixed(2),
                totalUsed: totalUsage,
                totalUsedMB: (totalUsage / (1024 * 1024)).toFixed(2),
                limit: estimatedLimit,
                percentage: Math.round((totalUsage / estimatedLimit) * 100)
            };
        } catch (error) {
            logger.error('Error calculating storage usage:', error);
            return {
                gamesCount: 0,
                used: 0,
                usedMB: '0.00',
                totalUsed: 0,
                totalUsedMB: '0.00',
                percentage: 0
            };
        }
    }

    /**
     * Import games from a JSON file
     * @param {Array} games - Array of game objects to import
     * @param {boolean} replace - Whether to replace existing games (true) or append (false)
     * @returns {Object} Result with success status and count of imported games
     */
    importGames(games, replace = false) {
        try {
            if (!Array.isArray(games) || games.length === 0) {
                throw new Error('Invalid games data for import');
            }

            let currentGames = replace ? [] : this.getAllGames();
            let importCount = 0;

            // Add each valid game to the beginning of the array (most recent first)
            games.forEach(game => {
                if (game && game.events && Array.isArray(game.events)) {
                    currentGames.unshift(game);
                    importCount++;
                }
            });

            // Trim to max size
            if (currentGames.length > this.MAX_GAMES) {
                currentGames = currentGames.slice(0, this.MAX_GAMES);
            }

            // Save back to storage
            const result = storageService.setItem(this.STORAGE_KEY, currentGames);

            if (result === true) {
                logger.log(`Successfully imported ${importCount} games`);
                return {
                    success: true,
                    count: importCount
                };
            } else {
                throw new Error(result.message || 'Unknown storage error');
            }

        } catch (error) {
            logger.error('Error importing games:', error);
            return {
                success: false,
                count: 0,
                error: error.message
            };
        }
    }

    /**
     * Helper method to determine if error is related to storage quota
     * @private
     */
    _isQuotaError(error) {
        return (
            error.name === 'QuotaExceededError' ||
            error.name === 'NS_ERROR_DOM_QUOTA_REACHED' || // Firefox
            (error.message && error.message.includes('quota'))
        );
    }
}

// Export a singleton instance for easy access
export const gameStorageManager = new GameStorageManager();

export default gameStorageManager;

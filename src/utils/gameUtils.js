// Game data utility functions
import { storageService } from '../services/storageService.js';
import { notificationService } from '../services/notificationService.js';
import { logger } from './formatUtils.js';
import { createButton, createGameCard as uiCreateGameCard } from '../components/ui/index.js';
import { gameStorageManager } from '../services/gameStorageManager.js';

/**
 * Computes statistics from game events
 * @param {Array} gameEvents - Array of event objects
 * @returns {Object} Statistics object with event counts
 */
export const computeGameStatistics = (gameEvents) => {
    return gameEvents.reduce((stats, event) => {
        if (event && event.event) { // Ensure event and event.event are defined
            stats[event.event] = (stats[event.event] || 0) + 1;
        }
        return stats;
    }, {});
};

/**
 * Creates a card element to display saved game information
 * @param {Object} options - Game card options
 * @param {Object} options.game - Game data object
 * @param {number} options.index - Index of the game in the list
 * @param {Function} options.onLoad - Load game handler
 * @param {Function} options.onDelete - Delete game handler
 * @param {Function} options.onRename - Rename game handler
 * @returns {HTMLDivElement} Created game card element
 */
export const createGameCard = ({ game, index, onLoad, onDelete, onRename }) => {
    // Use the UI component instead of creating elements manually
    return uiCreateGameCard({ game, index, onLoad, onDelete, onRename });
};

/**
 * Loads configuration from localStorage
 * @param {string} configKey - Storage key for the configuration
 * @param {Object} defaultConfig - Default configuration to use if none is found
 * @returns {Object} Loaded configuration or default
 */
export function loadConfig(configKey, defaultConfig) {
    try {
        const savedConfig = storageService.getItem(configKey);
        if (savedConfig && Array.isArray(savedConfig.rowDefs)) {
            logger.log("Loaded config from localStorage");
            return savedConfig;
        } else {
            logger.warn("Invalid config structure in localStorage, using default.");
            return defaultConfig;
        }
    } catch (error) {
        logger.error("Error loading or parsing config from localStorage:", error);
        return defaultConfig;
    }
}

/**
 * Saves configuration to localStorage
 * @param {Object} configObject - Configuration object to save
 * @param {string} configKey - Storage key for the configuration
 * @returns {boolean} Success status
 */
export function saveConfig(configObject, configKey) {
    try {
        if (!configObject || typeof configObject !== 'object' || !Array.isArray(configObject.rowDefs)) {
            throw new Error("Invalid configuration object structure.");
        }

        const result = storageService.setItem(configKey, configObject);

        if (result === true) {
            logger.log("Configuration saved to localStorage.");
            return true;
        } else {
            // Handle error from storage service
            logger.error("Error saving config to localStorage:", result.message);
            notificationService.alert(`Error: ${result.message}`);
            return false;
        }
    } catch (error) {
        logger.error("Error saving config to localStorage:", error);
        notificationService.alert(`Error: ${error.message}`);
        return false;
    }
}

/**
 * @deprecated Use gameStorageManager.saveGame() instead
 *
 * Saves game data to localStorage
 * @param {Object} gameData - Game data object to save
 * @param {string} storageKey - Storage key for game data
 * @returns {boolean} Success status
 */
export function saveGameToLocalStorage(gameData, storageKey) {
    logger.warn('DEPRECATED: saveGameToLocalStorage is deprecated. Use gameStorageManager.saveGame() instead.');
    try {
        // Forward to the gameStorageManager
        return gameStorageManager.saveGame(gameData) === true;
    } catch (error) {
        logger.error('Error in deprecated saveGameToLocalStorage:', error);
        notificationService.notify('Failed to save game data', 'error');
        return false;
    }
}

/**
 * @deprecated Use gameStorageManager.getAllGames() instead
 *
 * Loads saved games from localStorage
 * @param {string} storageKey - Storage key for game data
 * @returns {Array} Array of saved game objects
 */
export function loadSavedGames(storageKey) {
    logger.warn('DEPRECATED: loadSavedGames is deprecated. Use gameStorageManager.getAllGames() instead.');
    try {
        return gameStorageManager.getAllGames();
    } catch (error) {
        logger.error('Error in deprecated loadSavedGames:', error);
        notificationService.notify('Failed to load saved games', 'error');
        return [];
    }
}

/**
 * @deprecated Use gameStorageManager.removeGame() instead
 *
 * Deletes a saved game from localStorage
 * @param {number} index - Index of the game to delete
 * @param {string} storageKey - Storage key for game data
 * @returns {boolean} Success status
 */
export function deleteSavedGame(index, storageKey) {
    logger.warn('DEPRECATED: deleteSavedGame is deprecated. Use gameStorageManager.removeGame() instead.');
    try {
        return gameStorageManager.removeGame(index) === true;
    } catch (error) {
        logger.error('Error deleting game from localStorage:', error);
        notificationService.notify('Failed to delete game', 'error');
        return false;
    }
}

/**
 * @deprecated Use gameStorageManager.updateGame() instead
 *
 * Updates a saved game in localStorage
 * @param {number} index - Index of the game to update
 * @param {Object} updatedData - Updated game data
 * @param {string} storageKey - Storage key for game data
 * @returns {boolean} Success status
 */
export function updateSavedGame(index, updatedData, storageKey) {
    logger.warn('DEPRECATED: updateSavedGame is deprecated. Use gameStorageManager.updateGame() instead.');
    try {
        return gameStorageManager.updateGame(index, updatedData) === true;
    } catch (error) {
        logger.error('Error updating game in localStorage:', error);
        notificationService.notify('Failed to update game', 'error');
        return false;
    }
}

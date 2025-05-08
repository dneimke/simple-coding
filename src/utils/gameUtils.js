// Game data utility functions
import { storageService } from '../services/storageService.js';
import { notificationService } from '../services/notificationService.js';
import { logger } from './formatUtils.js';
import { createButton } from './domUtils.js';

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
    const gameCard = document.createElement('div');
    gameCard.className = 'saved-game-card flex items-center p-4 mb-4 bg-gray-100 rounded-lg shadow-md hover:shadow-lg transition-shadow';

    const icon = document.createElement('div');
    icon.className = 'saved-game-icon flex-shrink-0 w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center mr-4';
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c.828 0 1.5-.672 1.5-1.5S12.828 5 12 5s-1.5.672-1.5 1.5S11.172 8 12 8zm0 0v8m0 0H9m3 0h3" />
    </svg>`;

    const gameDetails = document.createElement('div');
    gameDetails.className = 'saved-game-details flex-grow';

    const gameTitle = document.createElement('h3');
    gameTitle.className = 'text-lg font-bold text-gray-800';
    gameTitle.textContent = game.teams ? game.teams : `Game ${index + 1}`;

    const gameTimestamp = document.createElement('p');
    gameTimestamp.className = 'text-sm text-gray-600';
    gameTimestamp.textContent = `Saved on: ${new Date(game.timestamp).toLocaleString()}`;

    const eventCount = document.createElement('p');
    eventCount.className = 'text-sm text-gray-600';
    eventCount.textContent = `Events: ${game.events.length}`;

    gameDetails.append(gameTitle, gameTimestamp, eventCount);

    const loadButton = createButton({
        text: 'Load',
        className: 'event-button btn-blue px-4 py-2 text-sm',
        onClick: onLoad
    });

    const renameButton = createButton({
        text: 'Rename',
        className: 'event-button btn-yellow px-4 py-2 text-sm ml-2',
        onClick: onRename
    });

    const deleteButton = createButton({
        text: 'Delete',
        className: 'event-button btn-red px-4 py-2 text-sm ml-2',
        onClick: onDelete
    });

    gameCard.append(icon, gameDetails, loadButton, renameButton, deleteButton);

    return gameCard;
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
 * Saves game data to localStorage
 * @param {Object} gameData - Game data object to save
 * @param {string} storageKey - Storage key for game data
 * @returns {boolean} Success status
 */
export function saveGameToLocalStorage(gameData, storageKey) {
    try {
        const savedGames = storageService.getItem(storageKey) || [];
        savedGames.push(gameData);

        // Retain only the last 5 games
        while (savedGames.length > 5) {
            savedGames.shift();
        }

        const result = storageService.setItem(storageKey, savedGames);

        if (result === true) {
            logger.log('Game saved successfully.');
            return true;
        } else {
            logger.error('Error saving game to localStorage:', result.message);
            notificationService.notify('Failed to save game data: ' + result.message, 'error');
            return false;
        }
    } catch (error) {
        logger.error('Error saving game to localStorage:', error);
        notificationService.notify('Failed to save game data', 'error');
        return false;
    }
}

/**
 * Loads saved games from localStorage
 * @param {string} storageKey - Storage key for game data
 * @returns {Array} Array of saved game objects
 */
export function loadSavedGames(storageKey) {
    try {
        const savedGames = storageService.getItem(storageKey);
        return savedGames || [];
    } catch (error) {
        logger.error('Error retrieving saved games from localStorage:', error);
        notificationService.notify('Failed to load saved games', 'error');
        return [];
    }
}

/**
 * Deletes a saved game from localStorage
 * @param {number} index - Index of the game to delete
 * @param {string} storageKey - Storage key for game data
 * @returns {boolean} Success status
 */
export function deleteSavedGame(index, storageKey) {
    try {
        const savedGames = storageService.getItem(storageKey) || [];
        if (index >= 0 && index < savedGames.length) {
            savedGames.splice(index, 1);
            const result = storageService.setItem(storageKey, savedGames);

            if (result === true) {
                logger.log('Game deleted successfully.');
                return true;
            } else {
                logger.error('Error deleting game:', result.message);
                notificationService.notify('Failed to delete game: ' + result.message, 'error');
                return false;
            }
        } else {
            logger.warn('Invalid game index for deletion.');
            return false;
        }
    } catch (error) {
        logger.error('Error deleting game from localStorage:', error);
        notificationService.notify('Failed to delete game', 'error');
        return false;
    }
}

/**
 * Updates a saved game in localStorage
 * @param {number} index - Index of the game to update
 * @param {Object} updatedData - Updated game data
 * @param {string} storageKey - Storage key for game data
 * @returns {boolean} Success status
 */
export function updateSavedGame(index, updatedData, storageKey) {
    try {
        const savedGames = storageService.getItem(storageKey) || [];
        if (index >= 0 && index < savedGames.length) {
            // Update only the specified properties while preserving the rest
            savedGames[index] = { ...savedGames[index], ...updatedData };

            const result = storageService.setItem(storageKey, savedGames);

            if (result === true) {
                logger.log('Game updated successfully.');
                return true;
            } else {
                logger.error('Error updating game:', result.message);
                notificationService.notify('Failed to update game: ' + result.message, 'error');
                return false;
            }
        } else {
            logger.warn('Invalid game index for update.');
            return false;
        }
    } catch (error) {
        logger.error('Error updating game in localStorage:', error);
        notificationService.notify('Failed to update game', 'error');
        return false;
    }
}

/**
 * Main utils re-export file
 *
 * This file re-exports all utility functions from their specialized modules
 * to maintain backward compatibility with existing code.
 *
 * New code should import directly from the specific modules rather than this file.
 */

// Re-export from formatUtils
export {
    formatTime,
    escapeXml,
    logger
} from './formatUtils.js';

// Re-export from xmlUtils
export {
    generatePlainXml,
    copyXmlToClipboard,
    parseXmlToEvents,
    validateXmlStructure
} from './xmlUtils.js';

// Re-export from domUtils
export {
    showElement,
    hideElement,
    updateNavbarVisibility,
    addVisualFeedbackToButtons,
    createButton,
    createLogEntry
} from './domUtils.js';

// Re-export from gameUtils
export {
    computeGameStatistics,
    createGameCard,
    loadConfig,
    saveConfig,
    saveGameToLocalStorage,
    loadSavedGames,
    deleteSavedGame,
    updateSavedGame
} from './gameUtils.js';

// Re-export from importUtils
export {
    showPreview,
    setupImportButtons
} from './importUtils.js';

// Legacy/compatibility functions
import { storageService } from '../services/storageService.js';
import { notificationService } from '../services/notificationService.js';

/**
 * Shows a message in the specified DOM element
 * @param {HTMLElement} element - Element to show the message in
 * @param {string} message - Message content
 * @param {boolean} isError - Whether this is an error message
 */
export function showMessage(element, message, isError = false) {
    // Use the notification service's showMessage method
    notificationService.showMessage(element, message, isError);
}

/**
 * Gets an item from localStorage (legacy function)
 * @param {string} key - Storage key
 * @returns {any} Retrieved value or null
 */
export function getFromLocalStorage(key) {
    return storageService.getItem(key);
}

/**
 * Sets an item in localStorage (legacy function)
 * @param {string} key - Storage key
 * @param {any} value - Value to store
 * @returns {boolean|Object} True on success or error object
 */
export function setToLocalStorage(key, value) {
    return storageService.setItem(key, value);
}

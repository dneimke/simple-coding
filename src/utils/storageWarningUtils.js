/**
 * Storage warning utilities for monitoring localStorage usage
 * and providing user interface feedback on storage limitations
 */

import { gameStorageManager } from '../services/gameStorageManager.js';
import { logger } from './formatUtils.js';

/**
 * Checks storage quota and displays warning if near limit
 * @param {number} warningThreshold - Percentage threshold to show warning (0-100)
 * @returns {Object} Storage usage information
 */
export function checkStorageQuota(warningThreshold = 80) {
    try {
        const usage = gameStorageManager.getStorageUsage();

        if (usage.percentage > warningThreshold) {
            showStorageWarning(usage);
        }

        return usage;
    } catch (error) {
        logger.error('Error checking storage quota:', error);
        return null;
    }
}

/**
 * Displays a storage warning in the UI
 * @param {Object} usage - Storage usage information
 */
export function showStorageWarning(usage) {
    try {
        // Remove any existing warning
        const existingWarning = document.getElementById('storage-warning');
        if (existingWarning) {
            existingWarning.remove();
        }

        // Create warning message
        const warningDiv = document.createElement('div');
        warningDiv.id = 'storage-warning';
        warningDiv.className = 'bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4';
        warningDiv.innerHTML = `
            <div class="flex items-center">
                <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-yellow-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                </div>
                <div class="ml-3">
                    <p class="font-bold">Storage Warning</p>
                    <p>You're using ${usage.totalUsedMB}MB of browser storage (${usage.percentage}% of estimated limit).</p>
                    <p class="mt-1">
                        You have ${usage.gamesCount} saved games. Consider
                        <button id="export-warning-button" class="underline text-blue-600 hover:text-blue-800">exporting</button>
                        and deleting older games.
                    </p>
                </div>
            </div>
        `;

        // Insert the warning at the appropriate location
        const savedGamesView = document.getElementById('saved-games-view');
        if (savedGamesView) {
            // Find a good insertion point - either before the game list or at the top
            const savedGamesList = document.getElementById('savedGamesList');
            if (savedGamesList) {
                savedGamesView.insertBefore(warningDiv, savedGamesList);
            } else {
                savedGamesView.insertBefore(warningDiv, savedGamesView.firstChild);
            }

            // Add event listener to export button
            document.getElementById('export-warning-button').addEventListener('click', () => {
                gameStorageManager.exportAllGames();
            });
        }
    } catch (error) {
        logger.error('Error showing storage warning:', error);
    }
}

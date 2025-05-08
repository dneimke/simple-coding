// Import utility functions
import { notificationService } from '../services/notificationService.js';
import { saveGameToLocalStorage } from './gameUtils.js';

/**
 * Shows a preview of parsed events in a modal
 * @param {HTMLElement} previewContainer - Container for the preview content
 * @param {Array} events - Array of event objects
 * @param {string} storageKey - Storage key for game data
 * @param {Function} [callback=null] - Optional callback function
 */
export const showPreview = (previewContainer, events, storageKey, callback = null) => {
    const teamsAttribute = events.teamsAttribute || null;

    setupImportButtons(events, storageKey, teamsAttribute, callback);

    previewContainer.innerHTML = events.map(event => `
        <div class="event-preview p-4 border-b">
            <p class="font-bold">Event: ${event.event}</p>
            <p>Time (ms): ${event.timeMs}</p>
        </div>
    `).join('');

    // Show teams information if available
    if (teamsAttribute) {
        previewContainer.innerHTML = `
            <div class="p-4 mb-4 bg-blue-50 border-blue-200 border rounded">
                <p class="font-bold">Teams: ${teamsAttribute}</p>
            </div>
        ` + previewContainer.innerHTML;
    }
};

/**
 * Sets up import confirmation buttons
 * @param {Array} parsedEvents - Array of parsed event objects
 * @param {string} storageKey - Storage key for game data
 * @param {string} [teamsAttribute=null] - Optional teams information
 * @param {Function} [callback=null] - Optional callback function
 */
export const setupImportButtons = (parsedEvents, storageKey, teamsAttribute = null, callback = null) => {
    const confirmButton = document.getElementById('confirmImportButton');
    const cancelButton = document.getElementById('cancelImportButton');

    confirmButton.onclick = () => {
        // Prompt the user to name the game, pre-filling with teams from XML if available
        const teamsName = notificationService.prompt(
            'Enter teams for this game (e.g., "Team A vs Team B"):',
            teamsAttribute || ''
        );

        // Calculate max time as a reasonable estimate of game duration
        const maxTimeMs = parsedEvents.reduce((max, event) => Math.max(max, event.timeMs || 0), 0);

        saveGameToLocalStorage({
            events: parsedEvents,
            elapsedTime: maxTimeMs,
            timestamp: new Date().toISOString(),
            teams: teamsName ? teamsName.trim() : null
        }, storageKey);

        document.getElementById('previewModal').classList.add('hidden');
        if (callback) callback({ importedFileCount: 1 });
        notificationService.notify('Game imported successfully!', 'success');
    };

    cancelButton.onclick = () => {
        document.getElementById('previewModal').classList.add('hidden');
        if (callback) callback({ importedFileCount: 0 });
        notificationService.notify('Import canceled.', 'warning');
    };
};

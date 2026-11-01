// Import utility functions
import { notificationService } from '../services/notificationService.js';
import { gameStorageManager } from '../services/gameStorageManager.js';
import { storageService } from '../services/storageService.js';
import { checkStorageQuota } from './storageWarningUtils.js';
import { logger, formatTime, escapeXml } from './formatUtils.js';
import { mergeXmlEventStreams } from './xmlUtils.js';

function findGameIndex(games, idOrIndex) {
    if (typeof idOrIndex === 'number') return idOrIndex;
    return games.findIndex(g => g && g.id === idOrIndex);
}

function calculateMaxGameTime(events, fallbackTime) {
    return events.reduce((max, ev) => Math.max(max, ev.timeMs || 0), fallbackTime || 0);
}

/**
 * Appends events to an existing saved game, merging and sorting chronologically
 * @param {string|number} idOrIndex - Game ID (string) or index (number)
 * @param {Array} newEvents - Array of new event objects
 * @param {Object} [options={}] - Merge options
 * @returns {Object} Result object { success: boolean, addedCount: number, duplicateCount: number, game?: Object, message?: string }
 */
export function appendEventsToGame(idOrIndex, newEvents, options = {}) {
    try {
        const games = gameStorageManager.ensureGameIds();
        const index = findGameIndex(games, idOrIndex);
        if (index < 0 || index >= games.length) {
            return { success: false, message: 'Game not found', addedCount: 0, duplicateCount: 0 };
        }

        const target = games[index];
        const merged = mergeXmlEventStreams(target.events || [], newEvents, options);
        games[index] = {
            ...target,
            events: merged,
            elapsedTime: calculateMaxGameTime(merged, target.elapsedTime),
            timestamp: new Date().toISOString()
        };

        const saved = storageService.setItem(gameStorageManager.STORAGE_KEY, games);
        return saved === true
            ? { success: true, addedCount: merged.addedCount, duplicateCount: merged.duplicateCount, game: games[index] }
            : { success: false, message: (saved && saved.message) || 'Storage error', addedCount: 0, duplicateCount: 0 };
    } catch (error) {
        logger.error('Error appending events to game:', error);
        return { success: false, message: error.message, addedCount: 0, duplicateCount: 0 };
    }
}

const setupImportButtons = (parsedEvents, storageKey, teamsAttribute = null, callback = null) => {
    const confirmButton = document.getElementById('confirmImportButton');
    const cancelButton = document.getElementById('cancelImportButton');
    const titleEl = document.getElementById('previewTitle');

    if (confirmButton) {
        confirmButton.textContent = 'Confirm';
        confirmButton.className = 'btn btn-success';
    }

    const resetModalChrome = () => {
        if (titleEl) titleEl.textContent = 'Preview Imported Events';
        if (confirmButton) {
            confirmButton.textContent = 'Confirm';
            confirmButton.className = 'btn btn-success';
        }
    };

    if (confirmButton) {
        confirmButton.onclick = () => {
            const teamsName = notificationService.prompt(
                'Enter teams for this game (e.g., "Team A vs Team B"):',
                teamsAttribute || ''
            );
            const maxTimeMs = parsedEvents.reduce((max, event) => Math.max(max, event.timeMs || 0), 0);

            try {
                const gameData = {
                    events: parsedEvents,
                    elapsedTime: maxTimeMs,
                    timestamp: new Date().toISOString(),
                    teams: teamsName ? teamsName.trim() : null
                };

                const result = gameStorageManager.saveGame(gameData);

                if (result !== true) {
                    const errorMsg = result.message || 'Unknown error';
                    logger.error('Failed to import game:', errorMsg);
                    notificationService.notify(`Failed to import game: ${errorMsg}`, 'error');

                    document.getElementById('previewModal').classList.add('hidden');
                    resetModalChrome();
                    if (callback) callback({ importedFileCount: 0 });
                    return;
                }

                checkStorageQuota();
            } catch (error) {
                logger.error('Error importing game:', error);
                notificationService.notify(`Error importing game: ${error.message}`, 'error');

                document.getElementById('previewModal').classList.add('hidden');
                resetModalChrome();
                if (callback) callback({ importedFileCount: 0 });
                return;
            }

            document.getElementById('previewModal').classList.add('hidden');
            resetModalChrome();
            if (callback) callback({ importedFileCount: 1 });
            notificationService.notify('Game imported successfully!', 'success');
        };
    }

    if (cancelButton) {
        cancelButton.onclick = () => {
            document.getElementById('previewModal').classList.add('hidden');
            resetModalChrome();
            if (callback) callback({ importedFileCount: 0 });
            notificationService.notify('Import canceled.', 'warning');
        };
    }
};

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

    const titleEl = document.getElementById('previewTitle');
    if (titleEl) titleEl.textContent = 'Preview Imported Events';

    let headerHtml = '';
    if (teamsAttribute) {
        headerHtml = `
            <div class="p-4 mb-4 bg-blue-50 border-blue-200 border rounded">
                <p class="font-bold text-ink">Teams: ${escapeXml(teamsAttribute)}</p>
                <p class="text-xs text-ink-muted mt-1">${events.length} event${events.length === 1 ? '' : 's'} ready to import</p>
            </div>
        `;
    }

    const eventsHtml = events.slice(0, 100).map(event => `
        <div class="event-preview p-3 border-b border-edge flex items-center justify-between text-sm">
            <span class="font-semibold text-ink">${escapeXml(event.event)}</span>
            <span class="text-ink-muted text-xs font-mono">${formatTime(event.timeMs || 0)}</span>
        </div>
    `).join('') + (events.length > 100 ? `<div class="p-2 text-center text-xs text-ink-muted">… and ${events.length - 100} more events</div>` : '');

    previewContainer.innerHTML = headerHtml + eventsHtml;
};

function handleAppendFailure(errorMsg, modal, resetModalChrome, callback) {
    logger.error('Failed to append events:', errorMsg);
    notificationService.notify(`Failed to append events: ${errorMsg}`, 'error');
    if (modal) modal.classList.add('hidden');
    resetModalChrome();
    if (callback) callback({ appended: false, addedCount: 0, duplicateCount: 0 });
}

function handleAppendSuccess(targetGame, result, modal, resetModalChrome, callback) {
    checkStorageQuota();
    if (modal) modal.classList.add('hidden');
    resetModalChrome();
    if (callback) callback({ appended: true, addedCount: result.addedCount, duplicateCount: result.duplicateCount });
    notificationService.notify(`Added ${result.addedCount} event${result.addedCount === 1 ? '' : 's'} to ${(targetGame && targetGame.teams) || 'match'}!`, 'success');
}

function executeAppendAction(targetGame, incomingEvents, callback, modal, resetModalChrome) {
    try {
        const result = appendEventsToGame(targetGame.id, incomingEvents);
        if (!result || !result.success) {
            handleAppendFailure((result && result.message) || 'Unknown error', modal, resetModalChrome, callback);
            return;
        }
        handleAppendSuccess(targetGame, result, modal, resetModalChrome, callback);
    } catch (error) {
        handleAppendFailure(error.message, modal, resetModalChrome, callback);
    }
}

/**
 * Shows preview for appending XML events to an existing saved game
 * @param {HTMLElement} previewContainer - Container for preview content
 * @param {Object} targetGame - Existing saved game object
 * @param {Array} incomingEvents - Parsed new events to append
 * @param {Function} [callback=null] - Optional callback function
 */
export const showAppendPreview = (previewContainer, targetGame, incomingEvents, callback = null) => {
    const modal = document.getElementById('previewModal');
    const titleEl = document.getElementById('previewTitle');
    const confirmButton = document.getElementById('confirmImportButton');
    const cancelButton = document.getElementById('cancelImportButton');

    const baseEvents = (targetGame && targetGame.events) || [];
    const merged = mergeXmlEventStreams(baseEvents, incomingEvents);
    const addedCount = merged.addedCount;
    const duplicateCount = merged.duplicateCount;

    if (titleEl) {
        titleEl.textContent = `Append to: ${(targetGame && targetGame.teams) || 'Saved Match'}`;
    }
    if (confirmButton) {
        confirmButton.textContent = 'Append to Match';
        confirmButton.className = 'btn btn-primary';
    }

    const resetModalChrome = () => {
        if (titleEl) titleEl.textContent = 'Preview Imported Events';
        if (confirmButton) {
            confirmButton.textContent = 'Confirm';
            confirmButton.className = 'btn btn-success';
        }
    };

    const targetName = escapeXml((targetGame && targetGame.teams) || 'Saved Match');

    const summaryHtml = `
        <div class="p-4 mb-4 bg-surface border border-edge rounded shadow-sm text-sm">
            <p class="font-bold text-ink">Target Match: <span class="text-brand">${targetName}</span></p>
            <div class="flex flex-wrap items-center gap-2 mt-2">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    +${addedCount} new event${addedCount === 1 ? '' : 's'}
                </span>
                ${duplicateCount > 0 ? `
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-200 text-slate-700 border border-slate-300">
                        ${duplicateCount} duplicate${duplicateCount === 1 ? '' : 's'} skipped
                    </span>
                ` : ''}
                <span class="text-xs text-ink-muted">Total will be ${merged.length} events</span>
            </div>
        </div>
    `;

    const eventsHtml = incomingEvents.slice(0, 50).map(event => `
        <div class="event-preview p-3 border-b border-edge flex items-center justify-between text-sm">
            <span class="font-semibold text-ink">${escapeXml(event.event)}</span>
            <span class="text-ink-muted text-xs font-mono">${formatTime(event.timeMs || 0)}</span>
        </div>
    `).join('') + (incomingEvents.length > 50 ? `<div class="p-2 text-center text-xs text-ink-muted">… and ${incomingEvents.length - 50} more incoming events</div>` : '');

    previewContainer.innerHTML = summaryHtml + eventsHtml;

    if (confirmButton) {
        confirmButton.onclick = () => executeAppendAction(targetGame, incomingEvents, callback, modal, resetModalChrome);
    }

    if (cancelButton) {
        cancelButton.onclick = () => {
            if (modal) modal.classList.add('hidden');
            resetModalChrome();
            if (callback) callback({ appended: false, addedCount: 0, duplicateCount: 0 });
            notificationService.notify('Append canceled.', 'warning');
        };
    }
};

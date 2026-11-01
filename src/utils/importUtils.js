// Import utility functions
import { notificationService } from '../services/notificationService.js';
import { gameStorageManager } from '../services/gameStorageManager.js';
import { checkStorageQuota } from './storageWarningUtils.js';
import { logger, formatTime, escapeXml } from './formatUtils.js';
import { generateGameXml, mergeXmlEventStreams } from './xmlUtils.js';

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

// fallow-ignore-next-line unused-export
export const setupImportButtons = (parsedEvents, storageKey, teamsAttribute = null, callback = null) => {
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

function executeAppendAction(targetGame, incomingEvents, callback, modal, resetModalChrome) {
    try {
        const result = gameStorageManager.appendEventsToGame(targetGame.id, incomingEvents);
        if (!result || !result.success) {
            const errorMsg = (result && result.message) || 'Unknown error';
            logger.error('Failed to append events:', errorMsg);
            notificationService.notify(`Failed to append events: ${errorMsg}`, 'error');
            if (modal) modal.classList.add('hidden');
            resetModalChrome();
            if (callback) callback({ appended: false, addedCount: 0, duplicateCount: 0 });
            return;
        }

        checkStorageQuota();
        if (modal) modal.classList.add('hidden');
        resetModalChrome();
        if (callback) callback({ appended: true, addedCount: result.addedCount, duplicateCount: result.duplicateCount });
        notificationService.notify(`Added ${result.addedCount} event${result.addedCount === 1 ? '' : 's'} to ${(targetGame && targetGame.teams) || 'match'}!`, 'success');
    } catch (error) {
        logger.error('Error appending events:', error);
        notificationService.notify(`Error appending events: ${error.message}`, 'error');
        if (modal) modal.classList.add('hidden');
        resetModalChrome();
        if (callback) callback({ appended: false, addedCount: 0, duplicateCount: 0 });
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

// fallow-ignore-next-line unused-export
export const generateSampleXml = () => {
    const sampleGame = {
        teams: 'Sample Team A vs Sample Team B',
        timestamp: new Date().toISOString(),
        events: [
            { event: 'GOAL_FOR', timeMs: 60000 },
            { event: 'FOUL', timeMs: 120000 },
            { event: 'PENALTY_CORNER', timeMs: 180000 }
        ]
    };

    return generateGameXml(sampleGame, 'Sample');
};

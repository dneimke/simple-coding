/**
 * Draft Service - Persists the capture in progress so it survives a reload or crash
 *
 * The draft is separate from saved games: it lives under its own key and is only
 * promoted into the saved games list when the capture is completed.
 */

import { storageService } from './storageService.js';
import { notificationService } from './notificationService.js';

export const DRAFT_STORAGE_KEY = 'fieldHockeyCaptureDraft_v1';

export const draftService = {
    _writeFailureNotified: false,

    /**
     * Load the capture in progress
     * @returns {{events: Array, elapsedTime: number, runningSince: number|null, updatedAt: number|null}|null}
     */
    loadDraft() {
        const draft = storageService.getItem(DRAFT_STORAGE_KEY);
        if (!draft || !Array.isArray(draft.events)) return null;

        return {
            events: draft.events,
            elapsedTime: Number(draft.elapsedTime) || 0,
            runningSince: typeof draft.runningSince === 'number' ? draft.runningSince : null,
            updatedAt: typeof draft.updatedAt === 'number' ? draft.updatedAt : null
        };
    },

    /**
     * Save the capture in progress
     * @param {Object} draft
     * @param {Array} draft.events - Events logged so far
     * @param {number} draft.elapsedTime - Clock banked before the current run (ms)
     * @param {number|null} draft.runningSince - Epoch ms the clock last started, or null when paused
     * @returns {boolean} True if the draft was written
     */
    saveDraft({ events, elapsedTime, runningSince }) {
        const result = storageService.setItem(DRAFT_STORAGE_KEY, {
            events,
            elapsedTime,
            runningSince,
            updatedAt: Date.now()
        });

        if (result === true) return true;

        if (!this._writeFailureNotified) {
            this._writeFailureNotified = true;
            notificationService.notify(
                'The capture in progress could not be backed up. Keep this tab open and Complete the game as soon as you can.',
                'error',
                8000
            );
        }
        return false;
    },

    /**
     * Remove the capture in progress
     * @returns {boolean} Success status
     */
    clearDraft() {
        return storageService.removeItem(DRAFT_STORAGE_KEY);
    }
};

/**
 * Save a finished capture to saved games, clearing the draft only once the save succeeds
 * @param {Object} gameSnapshot - Game to save
 * @param {{saveGame: Function}} storageManager - Saved games store
 * @returns {{success: boolean, message?: string}}
 */
export function finishCapture(gameSnapshot, storageManager) {
    let result;
    try {
        result = storageManager.saveGame(gameSnapshot);
    } catch (error) {
        return { success: false, message: error.message };
    }

    if (result !== true) {
        return { success: false, message: (result && result.message) || 'Unknown error' };
    }

    draftService.clearDraft();
    return { success: true };
}

export default draftService;

import { openModalWithPromise } from '../utils/domUtils.js';

/**
 * Ask for the saved-game name before a capture is completed.
 * Cancel and Escape resolve to null so the capture stays in progress.
 * @param {{ summary: string, suggestedName?: string }} options
 * @returns {Promise<{ name: string }|null>} Trimmed name, or null when cancelled
 */
export function openCompleteGameDialog({ summary, suggestedName = '' }) {
    const modal = document.getElementById('completeGameModal');
    const form = document.getElementById('completeGameForm');
    const cancelButton = document.getElementById('completeGameCancel');
    const summaryText = document.getElementById('completeGameSummary');
    const nameInput = document.getElementById('completeGameName');

    summaryText.textContent = summary;
    nameInput.value = suggestedName;
    modal.classList.remove('hidden');
    nameInput.focus();
    nameInput.select();

    return openModalWithPromise({ modal, form, cancelButton }, (close) => {
        close({ name: nameInput.value.trim() });
    });
}

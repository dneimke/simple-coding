/**
 * Video Alignment Modal Controller
 * Handles shifting and reverting event stream timestamps to align live capture with video footage.
 * Protects Friction 1 / Invariant 4 (dual-clock grounding).
 */

import { generateGameId } from '../services/gameStorageManager.js';
import { storageService } from '../services/storageService.js';
import { notificationService } from '../services/notificationService.js';
import { calculateVideoOffset, shiftEventTimings } from '../utils/gameUtils.js';

const LOCAL_STORAGE_KEY_GAMES = 'fieldHockeyGames_v1';

/**
 * Synchronizes updated game events and metadata back to draft and UI state.
 */
function syncGameUpdateState(game, deps) {
    const { getCurrentDraftGame, updateCurrentDraftEvents } = deps;
    const draft = getCurrentDraftGame ? getCurrentDraftGame() : null;
    if (draft && draft.id === game.id) {
        draft.events = game.events;
        draft.metadata = game.metadata;
    }
    if (updateCurrentDraftEvents) {
        updateCurrentDraftEvents(game.events);
    }
}

/**
 * Creates and saves an aligned copy of the game.
 */
function createAlignedCopy(game, shiftedEvents, offsetMs, savedGames) {
    const newGameId = generateGameId();
    const baseTitle = game.title || game.teams || 'Match';
    const newTitle = `${baseTitle} (Video Aligned)`;
    const newGame = {
        ...JSON.parse(JSON.stringify(game)),
        id: newGameId,
        title: newTitle,
        teams: game.teams || baseTitle,
        events: shiftedEvents,
        metadata: {
            ...(game.metadata || {}),
            videoOffsetMs: offsetMs,
            originalGameId: game.id,
            alignedAt: new Date().toISOString()
        }
    };
    savedGames.unshift(newGame);
    const saveRes = storageService.setItem(LOCAL_STORAGE_KEY_GAMES, savedGames);
    if (saveRes !== true) {
        notificationService.notify(saveRes?.message || 'Storage full: could not save aligned match copy', 'error');
        return null;
    }
    return { success: true, game: newGame, isCopy: true };
}

/**
 * Shifts event timings in-place while keeping a pre-shift backup.
 */
function shiftGameInPlace(game, index, shiftedEvents, offsetMs, savedGames, deps) {
    const originalBackup = game.metadata?.backupEvents || JSON.parse(JSON.stringify(game.events));
    game.events = shiftedEvents;
    game.metadata = {
        ...(game.metadata || {}),
        videoOffsetMs: (game.metadata?.videoOffsetMs || 0) + offsetMs,
        backupEvents: originalBackup,
        alignedAt: new Date().toISOString()
    };
    savedGames[index] = game;
    const saveRes = storageService.setItem(LOCAL_STORAGE_KEY_GAMES, savedGames);
    if (saveRes !== true) {
        notificationService.notify(saveRes?.message || 'Storage full: could not save shifted match', 'error');
        return null;
    }

    syncGameUpdateState(game, deps);
    return { success: true, game, isCopy: false };
}

/**
 * Shifts event timings by offsetMs either in-place (with backup) or by creating a new aligned copy.
 *
 * @param {string} gameId
 * @param {number} offsetMs
 * @param {boolean} [createCopy=false]
 * @param {Object} [deps] - Dependencies passed from parent controller
 * @returns {{ success: boolean, game?: Object, isCopy?: boolean } | null}
 */
export function shiftGameTimings(gameId, offsetMs, createCopy = false, deps = {}) {
    const { getSavedGames, findGameById } = deps;
    const savedGames = getSavedGames ? getSavedGames() : [];
    const { game, index } = findGameById(savedGames, gameId);
    if (!game || !Array.isArray(game.events) || game.events.length === 0) return null;

    const shiftedEvents = shiftEventTimings(game.events, offsetMs);

    if (createCopy) {
        return createAlignedCopy(game, shiftedEvents, offsetMs, savedGames);
    } else {
        return shiftGameInPlace(game, index, shiftedEvents, offsetMs, savedGames, deps);
    }
}

/**
 * Reverts shifted game timings back to pre-shift live capture state.
 *
 * @param {string} gameId
 * @param {Object} [deps]
 * @returns {{ success: boolean, game?: Object } | null}
 */
export function revertGameTimings(gameId, deps = {}) {
    const { getSavedGames, findGameById } = deps;
    const savedGames = getSavedGames ? getSavedGames() : [];
    const { game, index } = findGameById(savedGames, gameId);
    if (!game || !game.metadata?.backupEvents) return null;

    game.events = JSON.parse(JSON.stringify(game.metadata.backupEvents));
    delete game.metadata.backupEvents;
    delete game.metadata.videoOffsetMs;
    savedGames[index] = game;
    const saveRes = storageService.setItem(LOCAL_STORAGE_KEY_GAMES, savedGames);
    if (saveRes !== true) {
        notificationService.notify(saveRes?.message || 'Failed to revert game timings in storage', 'error');
        return null;
    }

    syncGameUpdateState(game, deps);
    return { success: true, game };
}

/**
 * Checks whether a video element is present and has loaded metadata/source.
 *
 * @param {HTMLVideoElement|null} video
 * @returns {boolean}
 */
function isVideoElementLoaded(video) {
    if (!video) return false;
    const hasSource = Boolean(video.currentSrc || video.src || video.querySelector('source'));
    return hasSource && Number(video.readyState) > 0;
}

/**
 * Calculates alignment offset from video element and game events.
 *
 * @param {HTMLVideoElement} video
 * @param {Object} game
 * @returns {{ offset: Object, game: Object } | null}
 */
export function calculateAlignmentState(video, game) {
    if (!isVideoElementLoaded(video)) {
        notificationService.notify('Please attach or load a video before aligning timings.', 'warn');
        return null;
    }
    if (!game || !Array.isArray(game.events) || game.events.length === 0) {
        return null;
    }

    const sortedEvents = [...game.events].sort((a, b) => (Number(a.timeMs) || 0) - (Number(b.timeMs) || 0));
    const videoSec = Number(video.currentTime) || 0;
    const firstSec = (Number(sortedEvents[0].timeMs) || 0) / 1000;
    const offset = calculateVideoOffset(videoSec, firstSec);
    return { offset, game };
}

/**
 * Verifies whether alignment modal can be opened.
 *
 * @param {HTMLVideoElement|null} video
 * @param {Object|null} game
 * @returns {boolean}
 */
export function canOpenAlignmentModal(video, game) {
    if (!isVideoElementLoaded(video)) {
        notificationService.notify('Please attach or load a video before aligning timings.', 'warn');
        return false;
    }
    if (!game || !Array.isArray(game.events) || game.events.length === 0) {
        notificationService.notify('No recorded events in this match to align.', 'info');
        return false;
    }
    return true;
}

/**
 * Format milliseconds or seconds to MM:SS
 *
 * @param {number} input
 * @returns {string}
 */
function formatTimeSecondsOrMs(input) {
    let seconds = Number(input) || 0;
    if (seconds > 10000) seconds = Math.floor(seconds / 1000);
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getEventTimestamp(event, fallbackMs) {
    if (event && event.timestamp) return event.timestamp;
    return formatTimeSecondsOrMs(fallbackMs);
}

/**
 * Builds alignment preview state and text map for modal display.
 *
 * @param {Object} game
 * @param {HTMLVideoElement|null} video
 * @param {Object} [deps]
 * @returns {{ textMap: Object, offset: Object, hasBackup: boolean } | null}
 */
export function buildAlignmentPreviewState(game, video, deps = {}) {
    if (!game || !Array.isArray(game.events) || game.events.length === 0) return null;
    const formatName = deps.formatEventTypeName || String;
    const videoSec = video ? (video.currentTime || 0) : 0;
    const sortedEvents = [...game.events].sort((a, b) => a.timeMs - b.timeMs);
    const firstEvent = sortedEvents[0];
    const lastEvent = sortedEvents[sortedEvents.length - 1];
    const firstMs = firstEvent.timeMs || 0;
    const lastMs = lastEvent.timeMs || 0;
    const offset = calculateVideoOffset(videoSec, firstMs / 1000);

    const firstDisplay = getEventTimestamp(firstEvent, firstMs);
    const lastDisplay = getEventTimestamp(lastEvent, lastMs);
    const newFirstMs = Math.max(0, firstMs + offset.offsetMs);
    const newLastMs = Math.max(0, lastMs + offset.offsetMs);

    const textMap = {
        'align-video-playhead-display': formatTimeSecondsOrMs(videoSec),
        'align-first-event-name': formatName(firstEvent.event),
        'align-first-event-time': firstDisplay,
        'align-event-count': String(game.events.length),
        'align-shift-amount': offset.formatted,
        'align-preview-first': firstDisplay,
        'align-preview-first-new': formatTimeSecondsOrMs(newFirstMs),
        'align-preview-last': lastDisplay,
        'align-preview-last-new': formatTimeSecondsOrMs(newLastMs)
    };

    return { textMap, offset, hasBackup: Boolean(game.metadata && game.metadata.backupEvents) };
}

function populatePreviewTextElements(textMap) {
    for (const [id, text] of Object.entries(textMap)) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }
}

function updateOffsetDisplayBadge(offset) {
    const offsetDisp = document.getElementById('align-offset-display');
    if (!offsetDisp) return;
    const sign = offset.offsetSec >= 0 ? '+' : '';
    const colorClass = offset.offsetSec >= 0 ? 'text-blue-600' : 'text-amber-600';
    offsetDisp.textContent = `${offset.formatted} (${sign}${offset.offsetSec}s)`;
    offsetDisp.className = `font-mono text-sm font-bold ${colorClass}`;
}

/**
 * Updates alignment modal DOM elements with preview data.
 *
 * @param {Object} game
 * @param {HTMLVideoElement|null} video
 * @param {Object} [deps]
 * @returns {Object|null}
 */
export function updateAlignmentModalPreview(game, video, deps = {}) {
    const previewState = buildAlignmentPreviewState(game, video, deps);
    if (!previewState) return null;

    populatePreviewTextElements(previewState.textMap);
    updateOffsetDisplayBadge(previewState.offset);

    const revertContainer = document.getElementById('align-revert-container');
    if (revertContainer) {
        revertContainer.classList.toggle('hidden', !previewState.hasBackup);
    }
    return previewState;
}

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
 * Calculates alignment offset from video element and game events.
 *
 * @param {HTMLVideoElement} video
 * @param {Object} game
 * @returns {{ offset: Object, game: Object } | null}
 */
export function calculateAlignmentState(video, game) {
    const videoLoaded = video && (video.currentSrc || video.src || video.querySelector('source')) && video.readyState > 0;
    if (!videoLoaded) {
        notificationService.notify('Please attach or load a video before aligning timings.', 'warn');
        return null;
    }
    if (!game || !game.events?.length) return null;
    const sortedEvents = [...game.events].sort((a, b) => (Number(a.timeMs) || 0) - (Number(b.timeMs) || 0));
    const videoSec = video ? (video.currentTime || 0) : 0;
    const firstSec = (sortedEvents[0].timeMs || 0) / 1000;
    const offset = calculateVideoOffset(videoSec, firstSec);
    return { offset, game };
}

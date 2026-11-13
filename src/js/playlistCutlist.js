/**
 * Playlist Cutlist Builder (Friction 3: Post-match assembly overhead)
 * Generates a portable Cutlist JSON from any match playlist using pre-baked
 * lead/lag envelopes and aligned video timestamps.
 */

import { getGamePlaylists, isEventInPlaylist, FAVORITES_PLAYLIST_ID } from './playlistManager.js';
import { getEventSeekSeconds, getEventEndSeconds } from './presentationController.js';
import { formatTime } from '../utils/formatUtils.js';

/**
 * Rounds a number to 3 decimal places for clean millisecond-precision seconds.
 * @param {number} value
 * @returns {number}
 */
function round3(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 1000) / 1000;
}

/**
 * Extracts a concise human-readable label string from an event's labels or notes.
 * @param {Object} event
 * @returns {string}
 */
function extractEventLabelText(event) {
    if (!event) return '';
    if (Array.isArray(event.labels) && event.labels.length > 0) {
        const parts = event.labels
            .map((lbl) => (typeof lbl === 'string' ? lbl : lbl?.text || ''))
            .map((s) => String(s).trim())
            .filter(Boolean);
        if (parts.length > 0) return parts.join(', ');
    }
    return typeof event.notes === 'string' ? event.notes.trim() : '';
}

/**
 * Formats a concise burned-in overlay string for a clip (e.g. "Q2 08:45 · FIRE · SHOT (On Target)").
 * @param {{ quarter?: string, matchTime?: string, team?: string, code?: string, label?: string }} clipInfo
 * @returns {string}
 */
export function buildClipOverlayText(clipInfo) {
    if (!clipInfo) return '';
    const timePart = [clipInfo.quarter, clipInfo.matchTime].filter(Boolean).join(' ').trim();
    const codePart = clipInfo.code
        ? (clipInfo.label ? `${clipInfo.code} (${clipInfo.label})` : clipInfo.code)
        : (clipInfo.label || '');
    return [timePart, clipInfo.team || '', codePart].filter(Boolean).join(' · ');
}

/**
 * Sanitizes a string segment for use in a filename.
 * @param {string} value
 * @returns {string}
 */
function sanitizeFilenameSegment(value) {
    return String(value || '')
        .trim()
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

/**
 * Builds a clean, sortable MP4 filename for an individual playlist clip.
 * @param {{ index?: number, quarter?: string, matchTime?: string, team?: string, code?: string, label?: string }} clipInfo
 * @returns {string}
 */
export function buildClipFilename(clipInfo) {
    const idx = String(clipInfo?.index || 1).padStart(2, '0');
    const timeSlug = clipInfo?.matchTime
        ? String(clipInfo.matchTime).trim().replace(':', 'm') + 's'
        : '';
    const parts = [
        idx,
        sanitizeFilenameSegment(clipInfo?.quarter),
        sanitizeFilenameSegment(timeSlug),
        sanitizeFilenameSegment(clipInfo?.team),
        sanitizeFilenameSegment(clipInfo?.code),
        sanitizeFilenameSegment(clipInfo?.label)
    ].filter(Boolean);
    return `${parts.join('_')}.mp4`;
}

/**
 * Builds a slugified download filename for the cutlist JSON file.
 * @param {{ gameTitle?: string, playlistName?: string }} cutlist
 * @returns {string}
 */
export function buildCutlistDownloadFilename(cutlist) {
    const slugify = (str, fallback) => {
        const cleaned = String(str || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return cleaned || fallback;
    };
    const gameSlug = slugify(cutlist?.gameTitle, 'match');
    const playlistSlug = slugify(cutlist?.playlistName, 'playlist');
    return `${gameSlug}-${playlistSlug}-cutlist.json`;
}

function resolveVideoSource(game, options) {
    const candidates = [options?.videoSource, game?.videoUrl, game?.metadata?.videoUrl];
    const match = candidates.find((val) => typeof val === 'string' && val.trim());
    return match ? match.trim() : '';
}

function buildCutlistClip(evt, idx) {
    const startSec = round3(getEventSeekSeconds(evt));
    const endSec = round3(getEventEndSeconds(evt));
    const durationSec = round3(Math.max(0, endSec - startSec));
    const quarter = typeof evt.quarter === 'string' ? evt.quarter.trim() : '';
    const matchTime = (typeof evt.timestamp === 'string' && evt.timestamp.trim())
        ? evt.timestamp.trim()
        : formatTime(evt.timeMs || 0);
    const team = typeof evt.team === 'string' ? evt.team.trim() : '';
    const rawCode = typeof evt.event === 'string' ? evt.event : evt.code;
    const code = typeof rawCode === 'string' ? rawCode.trim() : '';
    const label = extractEventLabelText(evt);
    const overlayText = buildClipOverlayText({ quarter, matchTime, team, code, label });
    const filename = buildClipFilename({ index: idx + 1, quarter, matchTime, team, code, label });

    return {
        index: idx + 1,
        eventId: evt.id || `evt-${idx + 1}`,
        quarter,
        matchTime,
        team,
        code,
        label,
        startSec,
        endSec,
        durationSec,
        overlayText,
        filename
    };
}

/**
 * Builds a portable Cutlist JSON object from a game and playlist ID.
 * Uses the exact aligned video seek/end windows computed for Presentation Mode.
 *
 * @param {Object} game
 * @param {string} [playlistId='favorites']
 * @param {{ videoSource?: string }} [options]
 * @returns {{
 *   version: number,
 *   exportedAt: string,
 *   gameId: string,
 *   gameTitle: string,
 *   playlistId: string,
 *   playlistName: string,
 *   videoSource: string,
 *   clipCount: number,
 *   clips: Array<Object>
 * }}
 */
export function buildPlaylistCutlist(game, playlistId = FAVORITES_PLAYLIST_ID, options = {}) {
    const targetId = playlistId || FAVORITES_PLAYLIST_ID;
    const playlists = getGamePlaylists(game);
    const playlist = playlists.find((pl) => pl.id === targetId) || playlists[0] || {
        id: targetId,
        name: 'Favorites'
    };

    const events = Array.isArray(game?.events) ? game.events : [];
    const matchingEvents = events
        .filter((evt) => isEventInPlaylist(game, playlist.id, evt))
        .slice()
        .sort((a, b) => (a?.timeMs || 0) - (b?.timeMs || 0));

    const clips = matchingEvents.map((evt, idx) => buildCutlistClip(evt, idx));

    return {
        version: 1,
        exportedAt: new Date().toISOString(),
        gameId: game?.id || '',
        gameTitle: game?.title || game?.teams || 'Match',
        playlistId: playlist.id,
        playlistName: playlist.name,
        videoSource: resolveVideoSource(game, options),
        clipCount: clips.length,
        clips
    };
}

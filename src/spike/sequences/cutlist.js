/**
 * Sequence clip lists for the ffmpeg exporter (Friction 3: post-match assembly).
 * One sequence becomes one clip, from the row seek time through the attack tag
 * plus that event's post-roll. The file matches the playlist cutlist shape.
 */

import {
    buildClipFilename,
    buildClipOverlayText
} from '../../js/playlistCutlist.js';

const CIRCLE_LAG_SECONDS = 10;
const ENTRY_25_LAG_SECONDS = 10;
const FALLBACK_LAG_SECONDS = 5;

/**
 * @param {object} game
 * @param {Array<object>} entries
 * @param {{
 *   selectedIds?: string[],
 *   filter?: { team?: string, entryType?: string, originType?: string },
 *   videoSource?: string
 * }} [options]
 */
export function buildSequenceCutlist(game, entries, options = {}) {
    const source = Array.isArray(entries) ? entries : [];
    const selectedIds = Array.isArray(options.selectedIds)
        ? options.selectedIds.filter(Boolean)
        : [];
    const selecting = selectedIds.length > 0;
    const chosen = selecting
        ? source.filter((entry) => selectedIds.includes(entry?.id))
        : source.filter((entry) => matchesFilter(entry, options.filter));
    const clips = chosen
        .slice()
        .sort(byTime)
        .map((entry, index) => buildSequenceClip(game, entry, index));

    return {
        version: 1,
        exportedAt: new Date().toISOString(),
        gameId: game?.id || '',
        gameTitle: gameTitleOf(game),
        playlistId: 'sequences',
        playlistName: selecting ? 'Selected sequences' : shownPlaylistName(options.filter),
        videoSource: videoSourceOf(game, options),
        clipCount: clips.length,
        clips
    };
}

function matchesFilter(entry, filter = {}) {
    const team = filter?.team || 'all';
    const entryType = filter?.entryType || 'all';
    const originType = filter?.originType || 'all';
    if (team !== 'all' && entry?.team !== team) return false;
    if (entryType !== 'all' && entry?.entryType !== entryType) return false;
    if (originType !== 'all' && entry?.originType !== originType) return false;
    return true;
}

function shownPlaylistName(filter = {}) {
    const team = filter?.team && filter.team !== 'all' ? filter.team : '';
    const entry = filter?.entryType === 'CE'
        ? 'Circle Entries'
        : filter?.entryType === 'A25E'
            ? '25m Entries'
            : '';
    const origin = filter?.originType && filter.originType !== 'all' ? filter.originType : '';
    const parts = [team, entry, origin].filter(Boolean);
    return parts.length ? parts.join(' ') : 'Sequences';
}

function byTime(a, b) {
    const delta = (a?.timeMs || 0) - (b?.timeMs || 0);
    if (delta !== 0) return delta;
    return String(a?.id || '').localeCompare(String(b?.id || ''));
}

function buildSequenceClip(game, entry, index) {
    const startSec = round3(Math.max(0, numberOrZero(entry?.seekSeconds)));
    const eventSeconds = numberOrZero(entry?.timeMs) / 1000;
    const endSec = round3(Math.max(startSec, eventSeconds + lagSeconds(game, entry)));
    const quarter = typeof entry?.quarter === 'string' ? entry.quarter.trim() : '';
    const matchTime = typeof entry?.matchClock === 'string' ? entry.matchClock.trim() : '';
    const team = typeof entry?.team === 'string' ? entry.team.trim() : '';
    const code = typeof entry?.entryType === 'string' ? entry.entryType.trim() : '';
    const label = typeof entry?.originType === 'string' ? entry.originType.trim() : '';
    const overlayText = buildClipOverlayText({ quarter, matchTime, team, code, label });
    const filename = buildClipFilename({
        index: index + 1,
        quarter,
        matchTime,
        team,
        code,
        label
    });

    return {
        index: index + 1,
        eventId: entry?.eventId || entry?.id || `seq-${index + 1}`,
        quarter,
        matchTime,
        team,
        code,
        label,
        startSec,
        endSec,
        durationSec: round3(Math.max(0, endSec - startSec)),
        overlayText,
        filename
    };
}

function lagSeconds(game, entry) {
    const source = sourceEvent(game, entry);
    const raw = source?.lag ?? source?.lagTime;
    const stored = Number(raw);
    if (raw != null && raw !== '' && Number.isFinite(stored) && stored >= 0) return stored;
    return defaultLag(entry?.entryType || entry?.code);
}

function sourceEvent(game, entry) {
    const events = Array.isArray(game?.events) ? game.events : [];
    const id = entry?.eventId;
    if (id == null) return null;
    return events.find((event) => String(event?.id) === String(id)) || null;
}

function defaultLag(code) {
    const normalized = String(code || '').toUpperCase().replace(/\s+/g, ' ').trim();
    if (normalized === 'CE' || normalized === 'CIRCLE ENTRY') return CIRCLE_LAG_SECONDS;
    if (normalized === 'A25E' || normalized === '25M ENTRY') return ENTRY_25_LAG_SECONDS;
    return FALLBACK_LAG_SECONDS;
}

function gameTitleOf(game) {
    if (typeof game?.title === 'string' && game.title.trim()) return game.title.trim();
    if (typeof game?.name === 'string' && game.name.trim()) return game.name.trim();
    if (typeof game?.teams === 'string' && game.teams.trim()) return game.teams.trim();
    return 'Match';
}

function videoSourceOf(game, options) {
    const candidates = [options?.videoSource, game?.videoUrl, game?.metadata?.videoUrl];
    const match = candidates.find((value) => typeof value === 'string' && value.trim());
    return match ? match.trim() : '';
}

function numberOrZero(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function round3(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 1000) / 1000;
}

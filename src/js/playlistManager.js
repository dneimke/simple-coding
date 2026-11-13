/**
 * Per-match Playlist Manager
 * Manages built-in Favorites (synced with event.isFavorite) and custom named playlists
 * stored in game.metadata.playlists.
 */

export const FAVORITES_PLAYLIST_ID = 'favorites';
export const FAVORITES_PLAYLIST_NAME = 'Favorites';

/**
 * @param {Object} game
 * @returns {Array<{id: string, name: string, eventIds: string[]}>}
 */
function ensureCustomPlaylists(game) {
    if (!game) return [];
    if (!game.metadata || typeof game.metadata !== 'object') {
        game.metadata = {};
    }
    if (!Array.isArray(game.metadata.playlists)) {
        game.metadata.playlists = [];
    }
    return game.metadata.playlists;
}

/**
 * @param {Object} game
 * @returns {Set<string>}
 */
function getValidEventIdSet(game) {
    const events = Array.isArray(game?.events) ? game.events : [];
    const ids = new Set();
    events.forEach((evt) => {
        if (evt && evt.id) ids.add(evt.id);
    });
    return ids;
}

/**
 * Returns all playlists for a game, starting with built-in Favorites.
 * @param {Object} game
 * @returns {Array<{id: string, name: string, isBuiltIn: boolean, eventIds: string[], count: number}>}
 */
export function getGamePlaylists(game) {
    const events = Array.isArray(game?.events) ? game.events : [];
    const validIds = getValidEventIdSet(game);

    const favoriteIds = events
        .filter((evt) => Boolean(evt && (evt.isFavorite || evt.favorite)))
        .map((evt) => evt.id)
        .filter(Boolean);

    const builtInFavorites = {
        id: FAVORITES_PLAYLIST_ID,
        name: FAVORITES_PLAYLIST_NAME,
        isBuiltIn: true,
        eventIds: favoriteIds,
        count: favoriteIds.length
    };

    const rawCustom = Array.isArray(game?.metadata?.playlists) ? game.metadata.playlists : [];
    const customPlaylists = rawCustom
        .filter((pl) => pl && typeof pl.id === 'string' && typeof pl.name === 'string')
        .map((pl) => {
            const eventIds = Array.isArray(pl.eventIds)
                ? pl.eventIds.filter((id) => validIds.has(id))
                : [];
            return {
                id: pl.id,
                name: pl.name,
                isBuiltIn: false,
                eventIds,
                count: eventIds.length
            };
        });

    return [builtInFavorites, ...customPlaylists];
}

/**
 * Checks whether an event belongs to a specific playlist.
 * @param {Object} game
 * @param {string} playlistId
 * @param {Object} event
 * @returns {boolean}
 */
export function isEventInPlaylist(game, playlistId, event) {
    if (!event) return false;
    if (playlistId === FAVORITES_PLAYLIST_ID) {
        return Boolean(event.isFavorite || event.favorite);
    }
    const playlists = Array.isArray(game?.metadata?.playlists) ? game.metadata.playlists : [];
    const pl = playlists.find((item) => item && item.id === playlistId);
    if (!pl || !Array.isArray(pl.eventIds)) return false;
    return Boolean(event.id && pl.eventIds.includes(event.id));
}

/**
 * Checks whether an event belongs to Favorites or any custom playlist.
 * @param {Object} game
 * @param {Object} event
 * @returns {boolean}
 */
export function isEventInAnyPlaylist(game, event) {
    if (!event) return false;
    if (event.isFavorite || event.favorite) return true;
    const playlists = Array.isArray(game?.metadata?.playlists) ? game.metadata.playlists : [];
    return Boolean(
        event.id &&
        playlists.some((pl) => Array.isArray(pl?.eventIds) && pl.eventIds.includes(event.id))
    );
}

/**
 * Creates a new named playlist (or returns existing on case-insensitive duplicate).
 * @param {Object} game
 * @param {string} rawName
 * @param {string} [initialEventId]
 * @returns {{created: boolean, duplicate?: boolean, error?: string, playlist?: Object}}
 */
export function createPlaylist(game, rawName, initialEventId) {
    const trimmed = String(rawName ?? '').trim();
    if (!trimmed) {
        return { created: false, error: 'Please enter a playlist name' };
    }

    const lower = trimmed.toLowerCase();
    if (lower === FAVORITES_PLAYLIST_NAME.toLowerCase()) {
        if (initialEventId && Array.isArray(game?.events)) {
            const evt = game.events.find((e) => e && e.id === initialEventId);
            if (evt) evt.isFavorite = true;
        }
        const favPlaylist = getGamePlaylists(game)[0];
        return { created: false, duplicate: true, playlist: favPlaylist };
    }

    const customPlaylists = ensureCustomPlaylists(game);
    const existing = customPlaylists.find((pl) => pl.name.trim().toLowerCase() === lower);
    if (existing) {
        if (initialEventId && !existing.eventIds.includes(initialEventId)) {
            existing.eventIds.push(initialEventId);
        }
        return { created: false, duplicate: true, playlist: existing };
    }

    const playlist = {
        id: `pl-${Math.random().toString(36).slice(2, 8)}-${Date.now()}`,
        name: trimmed,
        eventIds: initialEventId ? [initialEventId] : []
    };
    customPlaylists.push(playlist);
    return { created: true, playlist };
}

/**
 * Toggles an event's membership in Favorites or a custom playlist.
 * @param {Object} game
 * @param {string} playlistId
 * @param {string} eventId
 * @returns {{inPlaylist: boolean}}
 */
export function toggleEventInPlaylist(game, playlistId, eventId) {
    if (!game || !eventId) return { inPlaylist: false };

    if (playlistId === FAVORITES_PLAYLIST_ID) {
        const events = Array.isArray(game.events) ? game.events : [];
        const evt = events.find((e) => e && e.id === eventId);
        if (!evt) return { inPlaylist: false };
        evt.isFavorite = !Boolean(evt.isFavorite || evt.favorite);
        if ('favorite' in evt) evt.favorite = evt.isFavorite;
        return { inPlaylist: evt.isFavorite };
    }

    const customPlaylists = ensureCustomPlaylists(game);
    const pl = customPlaylists.find((item) => item && item.id === playlistId);
    if (!pl) return { inPlaylist: false };
    if (!Array.isArray(pl.eventIds)) pl.eventIds = [];

    const idx = pl.eventIds.indexOf(eventId);
    if (idx >= 0) {
        pl.eventIds.splice(idx, 1);
        return { inPlaylist: false };
    }
    pl.eventIds.push(eventId);
    return { inPlaylist: true };
}

/**
 * Deletes a custom playlist (built-in Favorites cannot be deleted).
 * @param {Object} game
 * @param {string} playlistId
 * @returns {boolean}
 */
export function deletePlaylist(game, playlistId) {
    if (!game || !playlistId || playlistId === FAVORITES_PLAYLIST_ID) return false;
    const customPlaylists = ensureCustomPlaylists(game);
    const idx = customPlaylists.findIndex((pl) => pl && pl.id === playlistId);
    if (idx === -1) return false;
    customPlaylists.splice(idx, 1);
    return true;
}

/**
 * Removes a deleted event ID from all custom playlists.
 * @param {Object} game
 * @param {string} eventId
 */
export function pruneDeletedEventFromPlaylists(game, eventId) {
    if (!game || !eventId || !Array.isArray(game?.metadata?.playlists)) return;
    game.metadata.playlists.forEach((pl) => {
        if (pl && Array.isArray(pl.eventIds)) {
            pl.eventIds = pl.eventIds.filter((id) => id !== eventId);
        }
    });
}

/**
 * Returns the event objects belonging to a playlist, preserving timeline order.
 * @param {Object} game
 * @param {string} playlistId
 * @returns {Array<Object>}
 */
export function getPlaylistEvents(game, playlistId) {
    const events = Array.isArray(game?.events) ? game.events : [];
    if (playlistId === FAVORITES_PLAYLIST_ID) {
        return events.filter((e) => Boolean(e && (e.isFavorite || e.favorite)));
    }
    const customPlaylists = Array.isArray(game?.metadata?.playlists) ? game.metadata.playlists : [];
    const pl = customPlaylists.find((item) => item && item.id === playlistId);
    if (!pl || !Array.isArray(pl.eventIds)) return [];
    const idSet = new Set(pl.eventIds);
    return events.filter((e) => Boolean(e && e.id && idSet.has(e.id)));
}

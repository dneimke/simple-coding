/**
 * @jest-environment jsdom
 */

import {
    FAVORITES_PLAYLIST_ID,
    FAVORITES_PLAYLIST_NAME,
    getGamePlaylists,
    createPlaylist,
    deletePlaylist,
    toggleEventInPlaylist,
    isEventInPlaylist,
    isEventInAnyPlaylist,
    getPlaylistEvents,
    pruneDeletedEventFromPlaylists
} from '../../src/js/playlistManager.js';

describe('playlistManager (Named Playlists & Favorites)', () => {
    const makeGame = (overrides = {}) => ({
        id: 'game-1',
        events: [
            { id: 'e1', event: 'FIRE BS1', timeMs: 10000, isFavorite: true },
            { id: 'e2', event: 'FIRE CE', timeMs: 25000, isFavorite: false },
            { id: 'e3', event: 'TIGERS BS2', timeMs: 40000, isFavorite: false }
        ],
        metadata: {},
        ...overrides
    });

    test('getGamePlaylists always includes built-in Favorites first with accurate count', () => {
        const game = makeGame();
        const playlists = getGamePlaylists(game);

        expect(playlists).toHaveLength(1);
        expect(playlists[0]).toMatchObject({
            id: FAVORITES_PLAYLIST_ID,
            name: FAVORITES_PLAYLIST_NAME,
            isBuiltIn: true,
            count: 1,
            eventIds: ['e1']
        });
    });

    test('createPlaylist trims name, persists in game.metadata.playlists, and optionally adds initialEventId', () => {
        const game = makeGame();
        const res = createPlaylist(game, '  NSW Press  ', 'e2');

        expect(res.created).toBe(true);
        expect(res.playlist.name).toBe('NSW Press');
        expect(res.playlist.eventIds).toEqual(['e2']);
        expect(game.metadata.playlists).toHaveLength(1);

        const playlists = getGamePlaylists(game);
        expect(playlists.map(p => `${p.name}:${p.count}`)).toEqual([
            'Favorites:1',
            'NSW Press:1'
        ]);
    });

    test('createPlaylist rejects empty names and deduplicates case-insensitively', () => {
        const game = makeGame();
        expect(createPlaylist(game, '   ')).toEqual({
            created: false,
            error: 'Please enter a playlist name'
        });

        const first = createPlaylist(game, 'NSW Press', 'e1');
        expect(first.created).toBe(true);

        const dup = createPlaylist(game, 'nsw press', 'e3');
        expect(dup.created).toBe(false);
        expect(dup.duplicate).toBe(true);
        expect(dup.playlist.id).toBe(first.playlist.id);
        expect(dup.playlist.eventIds).toEqual(['e1', 'e3']);

        // Cannot create a custom playlist named "Favorites"
        const favDup = createPlaylist(game, 'favorites', 'e2');
        expect(favDup.created).toBe(false);
        expect(favDup.duplicate).toBe(true);
        expect(favDup.playlist.id).toBe(FAVORITES_PLAYLIST_ID);
        expect(game.events.find(e => e.id === 'e2').isFavorite).toBe(true);
    });

    test('toggleEventInPlaylist toggles Favorites (isFavorite) and custom playlists independently', () => {
        const game = makeGame();
        const { playlist } = createPlaylist(game, 'NSW Press');

        // Add e2 to NSW Press
        const addRes = toggleEventInPlaylist(game, playlist.id, 'e2');
        expect(addRes.inPlaylist).toBe(true);
        expect(isEventInPlaylist(game, playlist.id, game.events[1])).toBe(true);
        expect(isEventInAnyPlaylist(game, game.events[1])).toBe(true);
        expect(game.events[1].isFavorite).toBe(false);

        // Toggle e2 in Favorites
        const favRes = toggleEventInPlaylist(game, FAVORITES_PLAYLIST_ID, 'e2');
        expect(favRes.inPlaylist).toBe(true);
        expect(game.events[1].isFavorite).toBe(true);

        // Remove e2 from NSW Press — Favorites remains true
        const removeRes = toggleEventInPlaylist(game, playlist.id, 'e2');
        expect(removeRes.inPlaylist).toBe(false);
        expect(isEventInPlaylist(game, playlist.id, game.events[1])).toBe(false);
        expect(game.events[1].isFavorite).toBe(true);
        expect(isEventInAnyPlaylist(game, game.events[1])).toBe(true);
    });

    test('getPlaylistEvents resolves events for Favorites and custom playlists, ignoring stale ids', () => {
        const game = makeGame({
            metadata: {
                playlists: [
                    { id: 'pl-1', name: 'NSW Press', eventIds: ['e2', 'missing-id', 'e3'] }
                ]
            }
        });

        expect(getPlaylistEvents(game, FAVORITES_PLAYLIST_ID).map(e => e.id)).toEqual(['e1']);
        expect(getPlaylistEvents(game, 'pl-1').map(e => e.id)).toEqual(['e2', 'e3']);
    });

    test('pruneDeletedEventFromPlaylists removes deleted event ids without touching other clips', () => {
        const game = makeGame({
            metadata: {
                playlists: [
                    { id: 'pl-1', name: 'NSW Press', eventIds: ['e1', 'e2'] }
                ]
            }
        });

        pruneDeletedEventFromPlaylists(game, 'e2');
        expect(game.metadata.playlists[0].eventIds).toEqual(['e1']);
    });

    test('deletePlaylist removes custom playlist but protects built-in Favorites', () => {
        const game = makeGame({
            metadata: {
                playlists: [
                    { id: 'pl-1', name: 'NSW Press', eventIds: ['e1', 'e2'] }
                ]
            }
        });

        expect(deletePlaylist(game, FAVORITES_PLAYLIST_ID)).toBe(false);
        expect(deletePlaylist(game, 'pl-1')).toBe(true);
        expect(game.metadata.playlists).toEqual([]);
        expect(game.events).toHaveLength(3);
    });
});

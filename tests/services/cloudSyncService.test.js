/**
 * @jest-environment jsdom
 */
import {
    reconcileCloudGames,
    buildRemoteFileName,
    extractGameIdFromRemoteFileName,
    CloudSyncService,
    CLOUD_SYNC_STORAGE_KEY,
    CLOUD_SYNC_SESSION_TOKEN_KEY,
    DEFAULT_GOOGLE_CLIENT_ID
} from '../../src/services/cloudSyncService.js';
import { storageService } from '../../src/services/storageService.js';
import { gameStorageManager } from '../../src/services/gameStorageManager.js';
import { generateGameXml, parseXmlToEvents } from '../../src/utils/xmlUtils.js';

let mockStorage = {};

jest.mock('../../src/services/storageService.js', () => ({
    storageService: {
        getItem: jest.fn(key => mockStorage[key] || null),
        setItem: jest.fn((key, value) => {
            mockStorage[key] = value;
            return true;
        }),
        removeItem: jest.fn(key => {
            delete mockStorage[key];
            return true;
        })
    }
}));

jest.mock('../../src/services/gameStorageManager.js', () => ({
    gameStorageManager: {
        getAllGames: jest.fn(() => []),
        saveGame: jest.fn(() => true),
        upsertGame: jest.fn(() => true),
        STORAGE_KEY: 'fieldHockeyGames_v1',
        MAX_GAMES: 20
    }
}));

describe('CloudSyncService', () => {
    let service;

    beforeEach(() => {
        jest.clearAllMocks();
        mockStorage = {};
        sessionStorage.clear();
        storageService.getItem.mockImplementation(key => mockStorage[key] || null);
        storageService.setItem.mockImplementation((key, val) => {
            mockStorage[key] = val;
            return true;
        });
        storageService.removeItem.mockImplementation(key => {
            delete mockStorage[key];
            return true;
        });
        service = new CloudSyncService();
    });

    describe('File Name & XML Metadata Helpers', () => {
        test('buildRemoteFileName formats teams and gameId safely', () => {
            const game = { id: 'game-123', teams: 'FIRE vs TIGERS' };
            expect(buildRemoteFileName(game)).toBe('fire-vs-tigers_game-123.xml');
        });

        test('buildRemoteFileName handles missing teams', () => {
            const game = { id: 'game-abc' };
            expect(buildRemoteFileName(game)).toBe('match_game-abc.xml');
        });

        test('extractGameIdFromRemoteFileName extracts game id suffix', () => {
            expect(extractGameIdFromRemoteFileName('fire-vs-tigers_game-123.xml')).toBe('game-123');
            expect(extractGameIdFromRemoteFileName('game-xyz.xml')).toBe('game-xyz');
        });

        test('generateGameXml and parseXmlToEvents round-trip videoUrl and lastUpdated', () => {
            const xml = generateGameXml({
                id: 'game-vid-1',
                teams: 'FIRE vs TIGERS',
                videoUrl: 'https://example.com/match.mp4',
                videoOffsetMs: 12000,
                metadata: {
                    lastUpdated: '2026-11-12T08:00:00.000Z'
                },
                events: [{ event: 'GOAL', timeMs: 30000, isFavorite: true }]
            });

            const parsed = parseXmlToEvents(xml);
            expect(parsed.gameMetadata).toEqual(
                expect.objectContaining({
                    gameId: 'game-vid-1',
                    teams: 'FIRE vs TIGERS',
                    videoUrl: 'https://example.com/match.mp4',
                    videoOffsetMs: 12000,
                    lastUpdated: '2026-11-12T08:00:00.000Z'
                })
            );
            expect(parsed[0].isFavorite).toBe(true);
        });
    });

    describe('reconcileCloudGames (Authoritative Matrix & Zero-Zombie)', () => {
        test('adds remote-only games into local games array and preserves videoUrl', () => {
            const remoteXml = generateGameXml({
                id: 'remote-1',
                teams: 'HAWKS vs OWLS',
                timestamp: '2026-11-11T10:00:00.000Z',
                videoUrl: 'https://cdn.example.com/hawks.mp4',
                events: [{ event: 'GOAL', timeMs: 30000 }]
            });

            const localGames = [];
            const remoteEntries = [
                { id: 'file-1', name: 'hawks-vs-owls_remote-1.xml', xmlContent: remoteXml, modifiedTime: '2026-11-11T10:00:00.000Z' }
            ];

            const result = reconcileCloudGames(localGames, remoteEntries);

            expect(result.updatedLocalGames).toHaveLength(1);
            expect(result.updatedLocalGames[0].id).toBe('remote-1');
            expect(result.updatedLocalGames[0].teams).toBe('HAWKS vs OWLS');
            expect(result.updatedLocalGames[0].videoUrl).toBe('https://cdn.example.com/hawks.mp4');
            expect(result.updatedLocalGames[0].events).toHaveLength(1);
            expect(result.dirtyGameIdsToUpload).toEqual([]);
            expect(result.pulledCount).toBe(1);
        });

        test('marks local-only games for cloud upload', () => {
            const localGames = [
                { id: 'local-1', teams: 'FIRE vs TIGERS', timestamp: '2026-11-11T10:00:00.000Z', events: [{ event: 'CE', timeMs: 10000 }] }
            ];
            const remoteEntries = [];

            const result = reconcileCloudGames(localGames, remoteEntries);

            expect(result.updatedLocalGames).toEqual(localGames);
            expect(result.dirtyGameIdsToUpload).toEqual(['local-1']);
            expect(result.pulledCount).toBe(0);
        });

        test('clean local game adopts updated remote snapshot (propagating remote edits/deletes/un-stars)', () => {
            const localGame = {
                id: 'game-common',
                teams: 'FIRE vs TIGERS',
                timestamp: '2026-11-11T10:00:00.000Z',
                events: [
                    { event: 'CE', timeMs: 10000, isFavorite: true },
                    { event: 'MISTAP', timeMs: 15000 }
                ]
            };

            const remoteXml = generateGameXml({
                id: 'game-common',
                teams: 'FIRE vs TIGERS (FINAL)',
                timestamp: '2026-11-11T10:00:00.000Z',
                events: [
                    { event: 'CE', timeMs: 10000, isFavorite: false },
                    { event: 'SHOT', timeMs: 25000, note: 'Saved by keeper' }
                ]
            });

            const remoteEntries = [
                { id: 'file-2', name: 'fire-vs-tigers_game-common.xml', xmlContent: remoteXml, modifiedTime: '2026-11-11T12:00:00.000Z' }
            ];

            const result = reconcileCloudGames([localGame], remoteEntries, { dirtyGameIds: [] });

            expect(result.updatedLocalGames).toHaveLength(1);
            const updated = result.updatedLocalGames[0];
            expect(updated.teams).toBe('FIRE vs TIGERS (FINAL)');
            expect(updated.events).toHaveLength(2);
            expect(updated.events.map(e => e.event)).toEqual(['CE', 'SHOT']);
            expect(updated.events[0].isFavorite).toBeFalsy();
            expect(updated.events[1].note).toBe('Saved by keeper');
            expect(result.pulledCount).toBe(1);
        });

        test('dirty local game is authoritative and does NOT resurrect deleted events or un-starred clips from stale remote', () => {
            const localGame = {
                id: 'game-edited',
                teams: 'FIRE vs TIGERS',
                timestamp: '2026-11-11T10:00:00.000Z',
                metadata: { lastUpdated: '2026-11-11T14:00:00.000Z' },
                events: [
                    { event: 'CE', timeMs: 10000, isFavorite: false }
                ]
            };

            const staleRemoteXml = generateGameXml({
                id: 'game-edited',
                teams: 'FIRE vs TIGERS',
                timestamp: '2026-11-11T10:00:00.000Z',
                metadata: { lastUpdated: '2026-11-11T11:00:00.000Z' },
                events: [
                    { event: 'CE', timeMs: 10000, isFavorite: true },
                    { event: 'DELETED_GOAL', timeMs: 20000 }
                ]
            });

            const remoteEntries = [
                { id: 'file-3', name: 'fire-vs-tigers_game-edited.xml', xmlContent: staleRemoteXml, modifiedTime: '2026-11-11T11:00:00.000Z' }
            ];

            const result = reconcileCloudGames([localGame], remoteEntries, {
                dirtyGameIds: ['game-edited']
            });

            expect(result.updatedLocalGames).toHaveLength(1);
            expect(result.updatedLocalGames[0].events).toHaveLength(1);
            expect(result.updatedLocalGames[0].events[0].event).toBe('CE');
            expect(result.updatedLocalGames[0].events[0].isFavorite).toBe(false);
            expect(result.dirtyGameIdsToUpload).toEqual(['game-edited']);
            expect(result.pulledCount).toBe(0);
        });

        test('excludes deletedGameIds (tombstones) so deleted matches never resurrect', () => {
            const remoteXml = generateGameXml({
                id: 'zombie-game',
                teams: 'ZOMBIE vs GHOSTS',
                timestamp: '2026-11-11T10:00:00.000Z',
                events: [{ event: 'GOAL', timeMs: 10000 }]
            });

            const result = reconcileCloudGames(
                [{ id: 'zombie-game', teams: 'ZOMBIE vs GHOSTS', events: [] }],
                [{ id: 'file-z', name: 'zombie-vs-ghosts_zombie-game.xml', xmlContent: remoteXml }],
                { deletedGameIds: ['zombie-game'] }
            );

            expect(result.updatedLocalGames).toEqual([]);
            expect(result.dirtyGameIdsToUpload).toEqual([]);
            expect(result.pulledCount).toBe(0);
        });

        test('sorts reconciled games newest-first by timestamp', () => {
            const localGames = [
                { id: 'older', teams: 'OLD', timestamp: '2026-10-01T10:00:00.000Z', events: [] }
            ];
            const newerRemoteXml = generateGameXml({
                id: 'newer',
                teams: 'NEW',
                timestamp: '2026-11-12T10:00:00.000Z',
                events: []
            });

            const result = reconcileCloudGames(localGames, [
                { id: 'f-new', name: 'new_newer.xml', xmlContent: newerRemoteXml }
            ]);

            expect(result.updatedLocalGames.map(g => g.id)).toEqual(['newer', 'older']);
        });

        test('removes local game when it was previously synced (in remoteFileMeta) but deleted/trashed on another device (missing from activeRemoteIds)', () => {
            const localGames = [
                { id: 'deleted-on-device-a', teams: 'FIRE vs TIGERS', timestamp: '2026-11-11T10:00:00.000Z', events: [] },
                { id: 'still-on-drive', teams: 'HAWKS vs OWLS', timestamp: '2026-11-12T10:00:00.000Z', events: [] },
                { id: 'unsynced-new-local', teams: 'LIONS vs BEARS', timestamp: '2026-11-12T11:00:00.000Z', events: [] }
            ];

            const result = reconcileCloudGames(localGames, [], {
                dirtyGameIds: [],
                deletedGameIds: [],
                remoteFileMeta: {
                    'deleted-on-device-a': { fileId: 'f-1', name: 'fire-vs-tigers_deleted-on-device-a.xml', modifiedTime: '2026-11-11T10:00:00.000Z' },
                    'still-on-drive': { fileId: 'f-2', name: 'hawks-vs-owls_still-on-drive.xml', modifiedTime: '2026-11-12T10:00:00.000Z' }
                },
                activeRemoteIds: ['still-on-drive']
            });

            expect(result.updatedLocalGames.map(g => g.id)).toEqual(['unsynced-new-local', 'still-on-drive']);
            expect(result.dirtyGameIdsToUpload).toEqual(['unsynced-new-local']);
            expect(result.remotelyDeletedCount).toBe(1);
        });

        test('propagates newly added event labels from Device A to Device B on sync', () => {
            const deviceBLocalGame = {
                id: 'game-labels',
                teams: 'FIRE vs TIGERS',
                timestamp: '2026-11-11T10:00:00.000Z',
                events: [
                    { id: 'evt-1', event: 'FIRE CE', timeMs: 15000 }
                ]
            };

            const deviceARemoteXml = generateGameXml({
                id: 'game-labels',
                teams: 'FIRE vs TIGERS',
                timestamp: '2026-11-11T10:00:00.000Z',
                metadata: { lastUpdated: '2026-11-12T12:00:00.000Z' },
                events: [
                    { id: 'evt-1', event: 'FIRE CE', timeMs: 15000, labels: [{ group: 'Channel', text: 'Left' }] }
                ]
            });

            const result = reconcileCloudGames(
                [deviceBLocalGame],
                [{ id: 'f-lbl', name: 'fire-vs-tigers_game-labels.xml', xmlContent: deviceARemoteXml, modifiedTime: '2026-11-12T12:00:00.000Z' }],
                {
                    dirtyGameIds: [],
                    remoteFileMeta: {
                        'game-labels': { fileId: 'f-lbl', name: 'fire-vs-tigers_game-labels.xml', modifiedTime: '2026-11-11T10:00:00.000Z' }
                    },
                    activeRemoteIds: ['game-labels']
                }
            );

            expect(result.updatedLocalGames).toHaveLength(1);
            expect(result.updatedLocalGames[0].events[0].labels).toEqual(
                expect.arrayContaining([{ group: 'Channel', text: 'Left' }])
            );
            expect(result.pulledCount).toBe(1);
        });
    });

    describe('Config, Tombstones & Session Token Management', () => {
        test('getConfig returns default state when no storage entry exists', () => {
            storageService.getItem.mockReturnValue(null);
            expect(service.getConfig()).toEqual({
                clientId: DEFAULT_GOOGLE_CLIENT_ID,
                customClientId: '',
                connected: false,
                folderId: null,
                lastSyncedAt: null,
                dirtyGameIds: [],
                deletedGameIds: [],
                remoteFileMeta: {}
            });
            expect(service.isConnected()).toBe(false);
        });

        test('markGameDeleted adds to deletedGameIds and removes from dirtyGameIds', () => {
            mockStorage[CLOUD_SYNC_STORAGE_KEY] = {
                connected: true,
                dirtyGameIds: ['game-1', 'game-2'],
                deletedGameIds: []
            };

            service.markGameDeleted('game-1');
            expect(mockStorage[CLOUD_SYNC_STORAGE_KEY].dirtyGameIds).toEqual(['game-2']);
            expect(mockStorage[CLOUD_SYNC_STORAGE_KEY].deletedGameIds).toEqual(['game-1']);
        });

        test('restores valid token from sessionStorage across page reloads and skips GIS popup on background sync when expired', async () => {
            const futureExpiry = Date.now() + 1800 * 1000;
            sessionStorage.setItem(
                CLOUD_SYNC_SESSION_TOKEN_KEY,
                JSON.stringify({ token: 'cached-session-token', expiresAt: futureExpiry })
            );

            const reloadedService = new CloudSyncService();
            expect(reloadedService.hasValidSessionToken()).toBe(true);
            await expect(reloadedService.getAccessToken({ interactive: false })).resolves.toBe('cached-session-token');

            // When expired, non-interactive getAccessToken returns null without calling requestToken
            sessionStorage.setItem(
                CLOUD_SYNC_SESSION_TOKEN_KEY,
                JSON.stringify({ token: 'expired-token', expiresAt: Date.now() - 1000 })
            );
            const expiredService = new CloudSyncService();
            const requestSpy = jest.spyOn(expiredService, 'requestToken');
            const token = await expiredService.getAccessToken({ interactive: false });
            expect(token).toBeNull();
            expect(requestSpy).not.toHaveBeenCalled();
        });
    });

    describe('Sync Execution, Incremental Skip & Trash Propagation', () => {
        test('syncNow aborts cleanly when navigator.onLine is false', async () => {
            jest.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
            mockStorage[CLOUD_SYNC_STORAGE_KEY] = { connected: true, dirtyGameIds: ['game-1'] };

            const result = await service.syncNow();
            expect(result).toEqual({ success: false, reason: 'offline' });
        });

        test('syncNow skips downloading unchanged remote XML files and trashes deleted games on Drive', async () => {
            jest.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
            mockStorage[CLOUD_SYNC_STORAGE_KEY] = {
                connected: true,
                folderId: 'folder-1',
                dirtyGameIds: [],
                deletedGameIds: ['trash-me'],
                remoteFileMeta: {
                    'unchanged-1': {
                        fileId: 'remote-unchanged-1',
                        name: 'fire-vs-tigers_unchanged-1.xml',
                        modifiedTime: '2026-11-10T00:00:00Z'
                    }
                }
            };

            jest.spyOn(service, 'getAccessToken').mockResolvedValue('test-bearer-token');
            jest.spyOn(service, 'ensureFolder').mockResolvedValue('folder-1');
            jest.spyOn(service, 'listRemoteXmlFiles').mockResolvedValue([
                { id: 'remote-unchanged-1', name: 'fire-vs-tigers_unchanged-1.xml', modifiedTime: '2026-11-10T00:00:00Z' },
                { id: 'remote-trash-1', name: 'old_trash-me.xml', modifiedTime: '2026-11-09T00:00:00Z' },
                { id: 'remote-new-1', name: 'hawks_new-1.xml', modifiedTime: '2026-11-12T00:00:00Z' }
            ]);

            const newGameXml = generateGameXml({
                id: 'new-1',
                teams: 'HAWKS vs EAGLES',
                timestamp: '2026-11-12T00:00:00Z',
                events: [{ event: 'PC', timeMs: 5000 }]
            });

            const fetchedUrls = [];
            global.fetch = jest.fn((url, opts) => {
                fetchedUrls.push({ url, method: (opts && opts.method) || 'GET' });
                if (url.includes('remote-new-1?alt=media')) {
                    return Promise.resolve({ ok: true, text: () => Promise.resolve(newGameXml) });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ id: 'ok' }),
                    text: () => Promise.resolve('')
                });
            });

            gameStorageManager.getAllGames.mockReturnValue([
                { id: 'unchanged-1', teams: 'FIRE vs TIGERS', timestamp: '2026-11-10T00:00:00Z', events: [] }
            ]);

            const result = await service.syncNow();
            expect(result).toEqual({
                success: true,
                pulledCount: 1,
                uploadedCount: 0,
                deletedCount: 1
            });

            // Verify unchanged file was NOT downloaded via alt=media
            expect(fetchedUrls.some(u => u.url.includes('remote-unchanged-1?alt=media'))).toBe(false);
            // Verify new file WAS downloaded
            expect(fetchedUrls.some(u => u.url.includes('remote-new-1?alt=media'))).toBe(true);
            // Verify deleted file WAS trashed via PATCH
            expect(fetchedUrls.some(u => u.url.includes('files/remote-trash-1') && u.method === 'PATCH')).toBe(true);
            expect(mockStorage[CLOUD_SYNC_STORAGE_KEY].deletedGameIds).toEqual([]);
        });

        test('syncNow uploads dirty games and patches existing remote file when renamed', async () => {
            jest.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
            mockStorage[CLOUD_SYNC_STORAGE_KEY] = {
                connected: true,
                folderId: 'folder-1',
                dirtyGameIds: ['dirty-existing', 'dirty-new'],
                deletedGameIds: [],
                remoteFileMeta: {
                    'dirty-existing': {
                        fileId: 'file-existing-1',
                        name: 'old-name_dirty-existing.xml',
                        modifiedTime: '2026-11-10T00:00:00Z'
                    }
                }
            };

            jest.spyOn(service, 'getAccessToken').mockResolvedValue('test-bearer-token');
            jest.spyOn(service, 'ensureFolder').mockResolvedValue('folder-1');
            jest.spyOn(service, 'listRemoteXmlFiles').mockResolvedValue([
                { id: 'file-existing-1', name: 'old-name_dirty-existing.xml', modifiedTime: '2026-11-10T00:00:00Z' }
            ]);

            const fetchedUrls = [];
            global.fetch = jest.fn((url, opts) => {
                fetchedUrls.push({ url, method: (opts && opts.method) || 'GET' });
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ id: 'created-file-99' }),
                    text: () => Promise.resolve('')
                });
            });

            gameStorageManager.getAllGames.mockReturnValue([
                {
                    id: 'dirty-existing',
                    teams: 'NEW NAME vs TIGERS',
                    timestamp: '2026-11-11T00:00:00Z',
                    metadata: { lastUpdated: '2026-11-12T00:00:00Z' },
                    events: [{ event: 'GOAL', timeMs: 10000 }]
                },
                {
                    id: 'dirty-new',
                    teams: 'LIONS vs BEARS',
                    timestamp: '2026-11-12T00:00:00Z',
                    events: []
                }
            ]);

            const result = await service.syncNow();
            expect(result.success).toBe(true);
            expect(result.uploadedCount).toBe(2);
            expect(fetchedUrls.some(u => u.url.includes('files/file-existing-1?uploadType=multipart') && u.method === 'PATCH')).toBe(true);
            expect(fetchedUrls.some(u => u.url.includes('files?uploadType=multipart') && u.method === 'POST')).toBe(true);
            expect(mockStorage[CLOUD_SYNC_STORAGE_KEY].dirtyGameIds).toEqual([]);
        });
    });

    describe('Google Identity Services Loader', () => {
        test('resolves immediately if google oauth2 is already defined', async () => {
            window.google = { accounts: { oauth2: { initTokenClient: jest.fn() } } };
            const ready = await service.loadGoogleIdentityServices();
            expect(ready).toBe(true);
            delete window.google;
        });

        test('appends script and resolves on script load', async () => {
            delete window.google;
            const promise = service.loadGoogleIdentityServices();
            const script = document.querySelector('script[src*="accounts.google.com"]');
            expect(script).toBeTruthy();
            script.onload();
            const ready = await promise;
            expect(ready).toBe(true);
        });
    });
});

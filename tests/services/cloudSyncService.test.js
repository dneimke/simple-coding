/**
 * @jest-environment jsdom
 */
import {
    reconcileCloudGames,
    buildRemoteFileName,
    extractGameIdFromRemoteFileName,
    CloudSyncService,
    CLOUD_SYNC_STORAGE_KEY,
    DEFAULT_GOOGLE_CLIENT_ID
} from '../../src/services/cloudSyncService.js';
import { storageService } from '../../src/services/storageService.js';
import { gameStorageManager } from '../../src/services/gameStorageManager.js';
import { generateGameXml } from '../../src/utils/xmlUtils.js';

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
        STORAGE_KEY: 'fieldHockeyGames_v1'
    }
}));

describe('CloudSyncService', () => {
    let service;

    beforeEach(() => {
        jest.clearAllMocks();
        mockStorage = {};
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

    describe('File Name Helpers', () => {
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
    });

    describe('reconcileCloudGames', () => {
        test('adds remote-only games into local games array', () => {
            const remoteXml = generateGameXml({
                id: 'remote-1',
                teams: 'HAWKS vs OWLS',
                timestamp: '2026-11-11T10:00:00.000Z',
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
            expect(result.updatedLocalGames[0].events).toHaveLength(1);
            expect(result.dirtyGameIdsToUpload).toEqual([]);
        });

        test('marks local-only games for cloud upload', () => {
            const localGames = [
                { id: 'local-1', teams: 'FIRE vs TIGERS', events: [{ event: 'CE', timeMs: 10000 }] }
            ];
            const remoteEntries = [];

            const result = reconcileCloudGames(localGames, remoteEntries);

            expect(result.updatedLocalGames).toEqual(localGames);
            expect(result.dirtyGameIdsToUpload).toEqual(['local-1']);
        });

        test('merges event streams when game exists locally and remotely', () => {
            const localGame = {
                id: 'game-common',
                teams: 'FIRE vs TIGERS',
                events: [{ event: 'CE', timeMs: 10000 }]
            };

            const remoteXml = generateGameXml({
                id: 'game-common',
                teams: 'FIRE vs TIGERS',
                events: [
                    { event: 'CE', timeMs: 10000 },
                    { event: 'SHOT', timeMs: 25000, note: 'Saved by keeper' }
                ]
            });

            const remoteEntries = [
                { id: 'file-2', name: 'fire-vs-tigers_game-common.xml', xmlContent: remoteXml, modifiedTime: '2026-11-11T12:00:00.000Z' }
            ];

            const result = reconcileCloudGames([localGame], remoteEntries);

            expect(result.updatedLocalGames).toHaveLength(1);
            const merged = result.updatedLocalGames[0];
            expect(merged.events).toHaveLength(2);
            expect(merged.events.map(e => e.event)).toEqual(['CE', 'SHOT']);
            expect(merged.events[1].note).toBe('Saved by keeper');
        });
    });

    describe('Config & State Management', () => {
        test('getConfig returns default state when no storage entry exists', () => {
            storageService.getItem.mockReturnValue(null);
            expect(service.getConfig()).toEqual({
                clientId: DEFAULT_GOOGLE_CLIENT_ID,
                customClientId: '',
                connected: false,
                folderId: null,
                lastSyncedAt: null,
                dirtyGameIds: []
            });
            expect(service.isConnected()).toBe(false);
        });

        test('saveConfig persists config and updates isConnected', () => {
            service.saveConfig({ clientId: 'custom-client-id.apps.googleusercontent.com', connected: true });

            expect(storageService.setItem).toHaveBeenCalledWith(
                CLOUD_SYNC_STORAGE_KEY,
                expect.objectContaining({
                    clientId: 'custom-client-id.apps.googleusercontent.com',
                    connected: true
                })
            );
            expect(service.isConnected()).toBe(true);
        });

        test('clearConfig wipes stored credentials and resets state', () => {
            service.clearConfig();
            expect(storageService.removeItem).toHaveBeenCalledWith(CLOUD_SYNC_STORAGE_KEY);
            expect(service.isConnected()).toBe(false);
        });

        test('markGameDirty and clearDirtyGame track games needing sync', () => {
            mockStorage[CLOUD_SYNC_STORAGE_KEY] = {
                clientId: 'client-1',
                folderId: 'folder-1',
                dirtyGameIds: ['game-1']
            };

            service.markGameDirty('game-2');
            expect(storageService.setItem).toHaveBeenCalledWith(
                CLOUD_SYNC_STORAGE_KEY,
                expect.objectContaining({
                    dirtyGameIds: ['game-1', 'game-2']
                })
            );

            service.clearDirtyGame('game-1');
            expect(storageService.setItem).toHaveBeenCalledWith(
                CLOUD_SYNC_STORAGE_KEY,
                expect.objectContaining({
                    dirtyGameIds: ['game-2']
                })
            );
        });
    });

    describe('Offline Resilience', () => {
        test('syncNow aborts cleanly when navigator.onLine is false', async () => {
            jest.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

            storageService.getItem.mockReturnValue({
                clientId: 'client-1',
                folderId: null,
                dirtyGameIds: ['game-1']
            });

            const result = await service.syncNow();
            expect(result).toEqual({ success: false, reason: 'offline' });
        });

        test('syncNow returns unconfigured when clientId is missing', async () => {
            jest.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
            storageService.getItem.mockReturnValue(null);

            const result = await service.syncNow();
            expect(result).toEqual({ success: false, reason: 'unconfigured' });
        });

        test('syncNow returns auth_required if token request fails', async () => {
            jest.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
            storageService.getItem.mockReturnValue({ clientId: 'client-1', folderId: 'folder-1', dirtyGameIds: [] });
            jest.spyOn(service, 'getAccessToken').mockResolvedValue(null);

            const result = await service.syncNow();
            expect(result).toEqual({ success: false, reason: 'auth_required' });
        });

        test('syncNow executes full pull/push reconciliation and updates config', async () => {
            jest.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
            storageService.getItem.mockReturnValue({
                clientId: 'client-1',
                folderId: 'folder-1',
                dirtyGameIds: ['local-1'],
                lastSyncedAt: null
            });

            jest.spyOn(service, 'getAccessToken').mockResolvedValue('test-bearer-token');
            jest.spyOn(service, 'ensureFolder').mockResolvedValue('folder-1');
            jest.spyOn(service, 'listRemoteXmlFiles').mockResolvedValue([
                { id: 'remote-file-1', name: 'tigers-vs-bears_remote-1.xml', modifiedTime: '2026-01-01T00:00:00Z' }
            ]);

            const mockXml = '<file><ALL_INSTANCES></ALL_INSTANCES></file>';
            global.fetch = jest.fn((url) => {
                if (url.includes('alt=media')) {
                    return Promise.resolve({ ok: true, text: () => Promise.resolve(mockXml) });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ id: 'uploaded-file-1' }),
                    text: () => Promise.resolve('')
                });
            });

            gameStorageManager.getAllGames.mockReturnValue([
                { id: 'local-1', teams: 'FIRE vs LIONS', events: [] }
            ]);

            const result = await service.syncNow();
            expect(result.success).toBe(true);
            expect(result.pulledCount).toBe(1);
            expect(storageService.setItem).toHaveBeenCalledWith(
                CLOUD_SYNC_STORAGE_KEY,
                expect.objectContaining({
                    dirtyGameIds: []
                })
            );
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

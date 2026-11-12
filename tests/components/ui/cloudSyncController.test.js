/**
 * @jest-environment jsdom
 */
import { initCloudSyncController, formatLastSyncedTime } from '../../../src/components/ui/cloudSyncController.js';
import { cloudSyncService } from '../../../src/services/cloudSyncService.js';
import { gameStorageManager } from '../../../src/services/gameStorageManager.js';
import { notificationService } from '../../../src/services/notificationService.js';

jest.mock('../../../src/services/cloudSyncService.js', () => {
    let _listeners = new Set();
    let _connected = false;
    let _syncing = false;
    let _lastStatus = null;
    let _config = {
        clientId: '604920442128-appggcqdfj7e90qoe9ntqb83eh18qsq9.apps.googleusercontent.com',
        customClientId: '',
        connected: false,
        folderId: null,
        lastSyncedAt: null,
        dirtyGameIds: [],
        deletedGameIds: []
    };

    return {
        cloudSyncService: {
            subscribe: jest.fn(fn => {
                _listeners.add(fn);
                return () => _listeners.delete(fn);
            }),
            isConnected: jest.fn(() => _connected),
            isSyncing: jest.fn(() => _syncing),
            getLastStatus: jest.fn(() => _lastStatus),
            getConfig: jest.fn(() => ({ ..._config })),
            saveConfig: jest.fn(updates => {
                _config = { ..._config, ...updates };
                _connected = Boolean(_config.connected ?? true);
            }),
            clearConfig: jest.fn(() => {
                _config = {
                    clientId: '604920442128-appggcqdfj7e90qoe9ntqb83eh18qsq9.apps.googleusercontent.com',
                    customClientId: '',
                    connected: false,
                    folderId: null,
                    lastSyncedAt: null,
                    dirtyGameIds: [],
                    deletedGameIds: []
                };
                _connected = false;
                _lastStatus = null;
            }),
            requestToken: jest.fn().mockResolvedValue('token-123'),
            syncNow: jest.fn().mockResolvedValue({ success: true, pulledCount: 1, uploadedCount: 1, deletedCount: 0 }),
            syncIfConnected: jest.fn().mockResolvedValue({ success: true, pulledCount: 0, uploadedCount: 0, deletedCount: 0 }),
            markGameDirty: jest.fn(),
            markGameDeleted: jest.fn(),
            _emit: (state) => {
                if (state && state.status !== undefined) _lastStatus = state.status;
                _listeners.forEach(fn => fn(state));
            },
            _reset: () => {
                _listeners.clear();
                _connected = false;
                _syncing = false;
                _lastStatus = null;
                _config = {
                    clientId: '604920442128-appggcqdfj7e90qoe9ntqb83eh18qsq9.apps.googleusercontent.com',
                    customClientId: '',
                    connected: false,
                    folderId: null,
                    lastSyncedAt: null,
                    dirtyGameIds: [],
                    deletedGameIds: []
                };
            }
        }
    };
});

jest.mock('../../../src/services/notificationService.js', () => ({
    notificationService: {
        notify: jest.fn(),
        confirm: jest.fn(() => true)
    }
}));

describe('CloudSyncController', () => {
    let elements;

    beforeEach(() => {
        cloudSyncService._reset();
        jest.clearAllMocks();

        document.body.innerHTML = `
            <button id="cloudSyncButton"><i id="cloudSyncIcon" class="fas fa-cloud"></i><span id="cloudSyncButtonLabel">Cloud Sync</span></button>
            <div id="cloudSyncModal" class="modal hidden">
                <div id="cloudSyncStatusBanner" class="banner banner-info mb-4"></div>
                <button id="closeCloudSyncModalButton"></button>
                <button id="cloudSyncCancelButton"></button>
                <div id="cloudSyncStatusDot"></div>
                <div id="cloudSyncStatusText"></div>
                <div id="cloudSyncLastSyncedText"></div>
                <input id="cloudSyncClientIdInput" type="text" />
                <button id="cloudSyncConnectButton"></button>
                <button id="cloudSyncNowButton" class="hidden"></button>
                <button id="cloudSyncDisconnectButton" class="hidden"></button>
            </div>
        `;

        elements = {
            cloudSyncButton: document.getElementById('cloudSyncButton'),
            cloudSyncIcon: document.getElementById('cloudSyncIcon'),
            cloudSyncButtonLabel: document.getElementById('cloudSyncButtonLabel'),
            cloudSyncModal: document.getElementById('cloudSyncModal'),
            statusBanner: document.getElementById('cloudSyncStatusBanner'),
            closeModalButton: document.getElementById('closeCloudSyncModalButton'),
            cancelModalButton: document.getElementById('cloudSyncCancelButton'),
            statusDot: document.getElementById('cloudSyncStatusDot'),
            statusText: document.getElementById('cloudSyncStatusText'),
            lastSyncedText: document.getElementById('cloudSyncLastSyncedText'),
            clientIdInput: document.getElementById('cloudSyncClientIdInput'),
            connectButton: document.getElementById('cloudSyncConnectButton'),
            syncNowButton: document.getElementById('cloudSyncNowButton'),
            disconnectButton: document.getElementById('cloudSyncDisconnectButton')
        };
    });

    test('formatLastSyncedTime formats timestamps appropriately', () => {
        expect(formatLastSyncedTime(null)).toBe('Never synced');
        const now = new Date().toISOString();
        expect(formatLastSyncedTime(now)).toMatch(/(Just now|seconds ago|Never synced)/);
    });

    test('initializes with disconnected state when not connected', () => {
        initCloudSyncController();

        expect(elements.statusText.textContent).toBe('Not Connected');
        expect(elements.cloudSyncButtonLabel.textContent).toBe('Cloud Sync');
        expect(elements.disconnectButton.classList.contains('hidden')).toBe(true);
        expect(elements.syncNowButton.classList.contains('hidden')).toBe(true);
        expect(elements.connectButton.classList.contains('hidden')).toBe(false);
    });

    test('opens and closes modal on button click', () => {
        initCloudSyncController();

        elements.cloudSyncButton.click();
        expect(elements.cloudSyncModal.classList.contains('hidden')).toBe(false);

        elements.closeModalButton.click();
        expect(elements.cloudSyncModal.classList.contains('hidden')).toBe(true);

        elements.cloudSyncButton.click();
        expect(elements.cloudSyncModal.classList.contains('hidden')).toBe(false);

        elements.cancelModalButton.click();
        expect(elements.cloudSyncModal.classList.contains('hidden')).toBe(true);
    });

    test('connects successfully using default Client ID with 1 click when input is empty', async () => {
        initCloudSyncController();

        elements.clientIdInput.value = '';
        await elements.connectButton.click();

        expect(cloudSyncService.requestToken).toHaveBeenCalledWith(
            '604920442128-appggcqdfj7e90qoe9ntqb83eh18qsq9.apps.googleusercontent.com'
        );
        expect(cloudSyncService.syncNow).toHaveBeenCalledWith({ interactive: true });
    });

    test('connects successfully with custom Client ID when provided', async () => {
        initCloudSyncController();

        elements.clientIdInput.value = 'my-custom-id.apps.googleusercontent.com';
        await elements.connectButton.click();

        expect(cloudSyncService.saveConfig).toHaveBeenCalledWith(
            expect.objectContaining({
                clientId: 'my-custom-id.apps.googleusercontent.com',
                connected: true
            })
        );
        expect(cloudSyncService.requestToken).toHaveBeenCalledWith('my-custom-id.apps.googleusercontent.com');
        expect(cloudSyncService.syncNow).toHaveBeenCalledWith({ interactive: true });
    });

    test('warns when connecting if no Client ID is configured', async () => {
        cloudSyncService.getConfig.mockReturnValue({ clientId: '' });
        initCloudSyncController();

        elements.clientIdInput.value = '   ';
        await elements.connectButton.click();

        expect(notificationService.notify).toHaveBeenCalledWith(
            expect.stringContaining('Please enter your Google Client ID'),
            'warn'
        );
        expect(cloudSyncService.requestToken).not.toHaveBeenCalled();
    });

    test('disconnects and clears configuration on confirm', () => {
        cloudSyncService.saveConfig({ clientId: 'active-client-id' });
        initCloudSyncController();

        elements.disconnectButton.click();

        expect(cloudSyncService.clearConfig).toHaveBeenCalled();
        expect(notificationService.notify).toHaveBeenCalledWith(
            expect.stringContaining('Disconnected'),
            'info'
        );
    });

    test('manual Sync Now button triggers interactive syncNow and reports accurate counts', async () => {
        cloudSyncService.saveConfig({ clientId: 'active-client-id', connected: true });
        const onSyncCompleted = jest.fn();
        initCloudSyncController({ onSyncCompleted });

        await elements.syncNowButton.click();

        expect(cloudSyncService.syncNow).toHaveBeenCalledWith({ interactive: true });
        expect(notificationService.notify).toHaveBeenCalledWith(
            expect.stringContaining('1 pulled, 1 uploaded'),
            'success'
        );
        expect(onSyncCompleted).toHaveBeenCalled();
    });

    test('shows Reconnect Sync state when session token has expired (auth_required)', () => {
        cloudSyncService.saveConfig({ clientId: 'active-client-id', connected: true });
        initCloudSyncController();

        cloudSyncService._emit({
            isConnected: true,
            isSyncing: false,
            lastSyncedAt: new Date().toISOString(),
            status: 'auth_required'
        });

        expect(elements.cloudSyncButtonLabel.textContent).toBe('Reconnect Sync');
        expect(elements.statusText.textContent).toContain('Session Expired');
        expect(elements.syncNowButton.textContent).toBe('Reconnect & Sync');
        expect(elements.statusBanner.className).toContain('banner-warning');
    });

    test('marks game deleted and triggers background sync when a match is removed from gameStorageManager', () => {
        const cleanup = initCloudSyncController();

        gameStorageManager._notifyChange('deleted-game-99', 'remove');

        expect(cloudSyncService.markGameDeleted).toHaveBeenCalledWith('deleted-game-99');
        expect(cloudSyncService.syncIfConnected).toHaveBeenCalled();
        cleanup();
    });

    test('updates UI when syncing state changes', () => {
        initCloudSyncController();

        cloudSyncService._emit({
            isConnected: true,
            isSyncing: true,
            lastSyncedAt: new Date().toISOString()
        });

        expect(elements.cloudSyncButtonLabel.textContent).toBe('Syncing...');
        expect(elements.cloudSyncIcon.classList.contains('fa-spin')).toBe(true);
        expect(elements.lastSyncedText.textContent).toBe('Syncing matches...');
        expect(elements.syncNowButton.disabled).toBe(true);
        expect(elements.syncNowButton.textContent).toBe('Syncing...');
    });

    test('shows completed confirmation state when sync succeeds', () => {
        jest.useFakeTimers();
        initCloudSyncController();

        cloudSyncService._emit({
            isConnected: true,
            isSyncing: false,
            lastSyncedAt: new Date().toISOString(),
            status: 'success'
        });

        expect(elements.cloudSyncButtonLabel.textContent).toBe('✓ Synced');
        expect(elements.statusText.textContent).toBe('Sync Complete');
        expect(elements.lastSyncedText.textContent).toBe('Matches are up to date (just now)');
        expect(elements.syncNowButton.textContent).toBe('Synced');
        expect(elements.syncNowButton.disabled).toBe(true);

        // After 2.5 seconds, resets to idle connected state
        jest.advanceTimersByTime(2500);

        expect(elements.cloudSyncButtonLabel.textContent).toBe('Cloud Sync');
        expect(elements.syncNowButton.textContent).toBe('Sync Now');
        expect(elements.syncNowButton.disabled).toBe(false);

        jest.useRealTimers();
    });
});

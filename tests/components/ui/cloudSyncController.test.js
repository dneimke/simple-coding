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
    let _config = { clientId: '', folderId: null, lastSyncedAt: null, dirtyGameIds: [] };

    return {
        cloudSyncService: {
            subscribe: jest.fn(fn => {
                _listeners.add(fn);
                return () => _listeners.delete(fn);
            }),
            isConnected: jest.fn(() => _connected),
            isSyncing: jest.fn(() => _syncing),
            getConfig: jest.fn(() => ({ ..._config })),
            saveConfig: jest.fn(updates => {
                _config = { ..._config, ...updates };
                _connected = Boolean(_config.clientId);
            }),
            clearConfig: jest.fn(() => {
                _config = { clientId: '', folderId: null, lastSyncedAt: null, dirtyGameIds: [] };
                _connected = false;
            }),
            requestToken: jest.fn().mockResolvedValue('token-123'),
            syncNow: jest.fn().mockResolvedValue({ added: 1, updated: 0, uploaded: 1 }),
            syncIfConnected: jest.fn().mockResolvedValue({ added: 0, updated: 0, uploaded: 0 }),
            markGameDirty: jest.fn(),
            _emit: (state) => {
                _listeners.forEach(fn => fn(state));
            },
            _reset: () => {
                _listeners.clear();
                _connected = false;
                _syncing = false;
                _config = { clientId: '', folderId: null, lastSyncedAt: null, dirtyGameIds: [] };
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

    test('connects successfully when valid Client ID is provided', async () => {
        initCloudSyncController();

        elements.clientIdInput.value = 'my-client-id.apps.googleusercontent.com';
        await elements.connectButton.click();

        expect(cloudSyncService.saveConfig).toHaveBeenCalledWith(
            expect.objectContaining({ clientId: 'my-client-id.apps.googleusercontent.com' })
        );
        expect(cloudSyncService.requestToken).toHaveBeenCalled();
        expect(cloudSyncService.syncNow).toHaveBeenCalled();
    });

    test('warns when connecting with empty Client ID', async () => {
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

    test('manual Sync Now button triggers syncNow', async () => {
        cloudSyncService.saveConfig({ clientId: 'active-client-id' });
        const onSyncCompleted = jest.fn();
        initCloudSyncController({ onSyncCompleted });

        await elements.syncNowButton.click();

        expect(cloudSyncService.syncNow).toHaveBeenCalled();
        expect(notificationService.notify).toHaveBeenCalledWith(
            expect.stringContaining('Matches synced'),
            'success'
        );
        expect(onSyncCompleted).toHaveBeenCalled();
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


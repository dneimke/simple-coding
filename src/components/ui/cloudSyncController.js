/**
 * Cloud Sync UI Controller
 *
 * Coordinates Google Drive sync settings, authentication, and manual sync triggers
 * between DOM elements and the underlying CloudSyncService.
 */

import { cloudSyncService } from '../../services/cloudSyncService.js';
import { gameStorageManager } from '../../services/gameStorageManager.js';
import { notificationService } from '../../services/notificationService.js';
import { logger } from '../../utils/formatUtils.js';

/**
 * Formats an ISO date string into a user-friendly relative or local time string.
 * @param {string|null} isoString
 * @returns {string}
 */
export function formatLastSyncedTime(isoString) {
    if (!isoString) return 'Never synced';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return 'Never synced';

    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec} seconds ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;

    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function updateStatusDotAndText(elements, isConnected) {
    if (elements.statusBanner) {
        elements.statusBanner.className = isConnected
            ? 'banner banner-success mb-4'
            : 'banner banner-info mb-4';
    }
    if (elements.statusText) {
        elements.statusText.textContent = isConnected
            ? 'Connected to Google Drive'
            : 'Not Connected';
    }
}

function updateSyncActivityView(elements, isSyncing, lastSyncedAt) {
    if (elements.lastSyncedText) {
        elements.lastSyncedText.textContent = isSyncing
            ? 'Syncing matches...'
            : `Last synced: ${formatLastSyncedTime(lastSyncedAt)}`;
    }
    if (elements.cloudSyncButtonLabel) {
        elements.cloudSyncButtonLabel.textContent = isSyncing ? 'Syncing...' : 'Cloud Sync';
    }
    if (elements.cloudSyncIcon) {
        elements.cloudSyncIcon.classList.toggle('fa-spin', isSyncing);
    }
}

function updateControlButtons(elements, isConnected, isSyncing) {
    if (elements.connectButton) {
        elements.connectButton.classList.toggle('hidden', isConnected);
        elements.connectButton.disabled = isSyncing;
    }
    if (elements.disconnectButton) {
        elements.disconnectButton.classList.toggle('hidden', !isConnected);
        elements.disconnectButton.disabled = isSyncing;
    }
    if (elements.syncNowButton) {
        elements.syncNowButton.classList.toggle('hidden', !isConnected);
        elements.syncNowButton.disabled = isSyncing;
    }
}

function updateSyncStatusView(elements, state, config) {
    const isConnected = Boolean(state?.isConnected ?? cloudSyncService.isConnected());
    const isSyncing = Boolean(state?.isSyncing ?? cloudSyncService.isSyncing());
    const lastSyncedAt = state?.lastSyncedAt ?? config.lastSyncedAt;

    updateStatusDotAndText(elements, isConnected);
    updateSyncActivityView(elements, isSyncing, lastSyncedAt);
    updateControlButtons(elements, isConnected, isSyncing);

    if (elements.clientIdInput && !elements.clientIdInput.value && config.clientId) {
        elements.clientIdInput.value = config.clientId;
    }
}

/**
 * Initializes Cloud Sync UI elements and binds lifecycle hooks.
 * @param {Object} [options]
 * @returns {Function} Unsubscribe and cleanup function
 */
export function initCloudSyncController(options = {}) {
    const onSyncCompleted = options.onSyncCompleted || (() => {});

    const elements = {
        cloudSyncButton: document.getElementById('cloudSyncButton'),
        cloudSyncIcon: document.getElementById('cloudSyncIcon'),
        cloudSyncButtonLabel: document.getElementById('cloudSyncButtonLabel'),
        cloudSyncModal: document.getElementById('cloudSyncModal'),
        closeModalButton: document.getElementById('closeCloudSyncModalButton'),
        cancelModalButton: document.getElementById('cloudSyncCancelButton'),
        statusBanner: document.getElementById('cloudSyncStatusBanner'),
        statusDot: document.getElementById('cloudSyncStatusDot'),
        statusText: document.getElementById('cloudSyncStatusText'),
        lastSyncedText: document.getElementById('cloudSyncLastSyncedText'),
        clientIdInput: document.getElementById('cloudSyncClientIdInput'),
        connectButton: document.getElementById('cloudSyncConnectButton'),
        syncNowButton: document.getElementById('cloudSyncNowButton'),
        disconnectButton: document.getElementById('cloudSyncDisconnectButton')
    };

    const render = (state) => {
        const config = cloudSyncService.getConfig();
        updateSyncStatusView(elements, state, config);
    };

    const openModal = () => {
        if (elements.cloudSyncModal) {
            elements.cloudSyncModal.classList.remove('hidden');
            const config = cloudSyncService.getConfig();
            if (elements.clientIdInput && !elements.clientIdInput.value) {
                elements.clientIdInput.value = config.clientId || '';
            }
        }
    };

    const closeModal = () => {
        if (elements.cloudSyncModal) {
            elements.cloudSyncModal.classList.add('hidden');
        }
    };

    const handleConnect = async () => {
        const rawClientId = elements.clientIdInput?.value?.trim() || '';
        if (!rawClientId) {
            notificationService.notify('Please enter your Google Client ID to connect.', 'warn');
            return;
        }

        try {
            cloudSyncService.saveConfig({ clientId: rawClientId });
            await cloudSyncService.requestToken(rawClientId);
            notificationService.notify('Connected to Google Drive! Syncing matches...', 'success');
            const result = await cloudSyncService.syncNow();
            onSyncCompleted(result);
        } catch (error) {
            logger.error('Failed to connect Google Drive:', error);
            notificationService.notify(`Failed to connect Google Drive: ${error.message}`, 'error');
        }
    };

    const handleSyncNow = async () => {
        try {
            const result = await cloudSyncService.syncNow();
            notificationService.notify('Matches synced with Google Drive.', 'success');
            onSyncCompleted(result);
        } catch (error) {
            logger.error('Sync failed:', error);
            notificationService.notify(`Cloud sync failed: ${error.message}`, 'error');
        }
    };

    const handleDisconnect = () => {
        const confirmed = notificationService.confirm(
            'Disconnect Google Drive sync? Your local matches will remain safe.'
        );
        if (!confirmed) return;

        cloudSyncService.clearConfig();
        if (elements.clientIdInput) elements.clientIdInput.value = '';
        notificationService.notify('Disconnected from Google Drive.', 'info');
    };

    // DOM event listeners
    elements.cloudSyncButton?.addEventListener('click', openModal);
    elements.closeModalButton?.addEventListener('click', closeModal);
    elements.cancelModalButton?.addEventListener('click', closeModal);
    elements.connectButton?.addEventListener('click', handleConnect);
    elements.syncNowButton?.addEventListener('click', handleSyncNow);
    elements.disconnectButton?.addEventListener('click', handleDisconnect);

    // Subscribe to cloud sync service updates
    const unsubscribeCloudSync = cloudSyncService.subscribe(render);

    // Subscribe to storage changes to mark games dirty and auto-sync
    const unsubscribeGameChanges = gameStorageManager.addChangeListener(({ gameId, action }) => {
        if (action === 'save' || action === 'upsert' || action === 'update') {
            cloudSyncService.markGameDirty(gameId);
            cloudSyncService.syncIfConnected().then(result => {
                if (result) onSyncCompleted(result);
            }).catch(err => {
                logger.warn('Background sync failed:', err);
            });
        }
    });

    // Initial render
    render();

    return () => {
        elements.cloudSyncButton?.removeEventListener('click', openModal);
        elements.closeModalButton?.removeEventListener('click', closeModal);
        elements.cancelModalButton?.removeEventListener('click', closeModal);
        elements.connectButton?.removeEventListener('click', handleConnect);
        elements.syncNowButton?.removeEventListener('click', handleSyncNow);
        elements.disconnectButton?.removeEventListener('click', handleDisconnect);
        unsubscribeCloudSync();
        unsubscribeGameChanges();
    };
}

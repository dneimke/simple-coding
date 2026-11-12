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

function getBannerClass(isConnected, isSyncing, isAuthRequired) {
    if (isSyncing) return 'banner banner-info mb-4';
    if (isAuthRequired) return 'banner banner-warning mb-4';
    return isConnected ? 'banner banner-success mb-4' : 'banner banner-info mb-4';
}

function getStatusHtml(isConnected, isSyncing, isJustSynced, isAuthRequired) {
    if (isSyncing) {
        return '<i class="fas fa-rotate fa-spin mr-1.5" aria-hidden="true"></i>Syncing with Google Drive...';
    }
    if (isJustSynced) {
        return '<i class="fas fa-check-circle mr-1.5" aria-hidden="true"></i>Sync Complete';
    }
    if (isAuthRequired) {
        return '<i class="fas fa-triangle-exclamation mr-1.5" aria-hidden="true"></i>Session Expired — Reconnect to Sync';
    }
    return isConnected ? 'Connected to Google Drive' : 'Not Connected';
}

function updateStatusDotAndText(elements, isConnected, isSyncing, isJustSynced, isAuthRequired) {
    if (elements.statusBanner) {
        elements.statusBanner.className = getBannerClass(isConnected || isJustSynced, isSyncing, isAuthRequired);
    }
    if (elements.statusText) {
        elements.statusText.innerHTML = getStatusHtml(isConnected, isSyncing, isJustSynced, isAuthRequired);
    }
}

function getLastSyncedDisplay(isSyncing, isJustSynced, lastSyncedAt, isAuthRequired) {
    if (isSyncing) return 'Syncing matches...';
    if (isJustSynced) return 'Matches are up to date (just now)';
    if (isAuthRequired) return `Last synced: ${formatLastSyncedTime(lastSyncedAt)} · Tap Reconnect & Sync`;
    return `Last synced: ${formatLastSyncedTime(lastSyncedAt)}`;
}

function getHeaderSyncIconClass(isSyncing, isJustSynced, isAuthRequired) {
    if (isSyncing) return 'fas fa-rotate fa-spin text-xs';
    if (isJustSynced) return 'fas fa-check text-xs text-emerald-500';
    if (isAuthRequired) return 'fas fa-rotate text-xs text-amber-500';
    return 'fas fa-cloud text-xs';
}

function getHeaderSyncLabel(isSyncing, isJustSynced, isAuthRequired) {
    if (isSyncing) return 'Syncing...';
    if (isJustSynced) return '✓ Synced';
    if (isAuthRequired) return 'Reconnect Sync';
    return 'Cloud Sync';
}

function updateSyncActivityView(elements, isSyncing, lastSyncedAt, isJustSynced, isAuthRequired) {
    if (elements.lastSyncedText) {
        elements.lastSyncedText.textContent = getLastSyncedDisplay(isSyncing, isJustSynced, lastSyncedAt, isAuthRequired);
    }
    if (elements.cloudSyncButtonLabel) {
        elements.cloudSyncButtonLabel.textContent = getHeaderSyncLabel(isSyncing, isJustSynced, isAuthRequired);
    }
    if (elements.cloudSyncIcon) {
        elements.cloudSyncIcon.className = getHeaderSyncIconClass(isSyncing, isJustSynced, isAuthRequired);
    }
}

function getSyncNowButtonContent(isSyncing, isJustSynced, isAuthRequired) {
    if (isSyncing) {
        return '<i class="fas fa-rotate fa-spin mr-1.5 text-xs" aria-hidden="true"></i>Syncing...';
    }
    if (isJustSynced) {
        return '<i class="fas fa-check mr-1.5 text-xs text-emerald-400" aria-hidden="true"></i>Synced';
    }
    if (isAuthRequired) {
        return '<i class="fas fa-rotate mr-1.5 text-xs" aria-hidden="true"></i>Reconnect & Sync';
    }
    return '<i class="fas fa-rotate mr-1.5 text-xs" aria-hidden="true"></i>Sync Now';
}

function updateControlButtons(elements, isConnected, isSyncing, isJustSynced, isAuthRequired) {
    if (elements.connectButton) {
        elements.connectButton.classList.toggle('hidden', isConnected);
        elements.connectButton.disabled = isSyncing;
        if (!isSyncing) elements.connectButton.textContent = 'Connect Google Drive';
    }
    if (elements.disconnectButton) {
        elements.disconnectButton.classList.toggle('hidden', !isConnected);
        elements.disconnectButton.disabled = isSyncing;
    }
    if (elements.syncNowButton) {
        elements.syncNowButton.classList.toggle('hidden', !isConnected);
        elements.syncNowButton.disabled = isSyncing || isJustSynced;
        elements.syncNowButton.innerHTML = getSyncNowButtonContent(isSyncing, isJustSynced, isAuthRequired);
    }
}

function updateSyncStatusView(elements, state, config, isJustSynced = false) {
    const isConnected = Boolean(state?.isConnected ?? cloudSyncService.isConnected());
    const isSyncing = Boolean(state?.isSyncing ?? cloudSyncService.isSyncing());
    const lastSyncedAt = state?.lastSyncedAt ?? config.lastSyncedAt;
    const status = state?.status ?? (typeof cloudSyncService.getLastStatus === 'function' ? cloudSyncService.getLastStatus() : null);
    const isAuthRequired = Boolean(isConnected && !isSyncing && !isJustSynced && status === 'auth_required');

    updateStatusDotAndText(elements, isConnected, isSyncing, isJustSynced, isAuthRequired);
    updateSyncActivityView(elements, isSyncing, lastSyncedAt, isJustSynced, isAuthRequired);
    updateControlButtons(elements, isConnected, isSyncing, isJustSynced, isAuthRequired);

    if (elements.clientIdInput && !elements.clientIdInput.value && config.customClientId) {
        elements.clientIdInput.value = config.customClientId;
    }
}

function queryCloudSyncElements(doc = document) {
    return {
        cloudSyncButton: doc.getElementById('cloudSyncButton'),
        cloudSyncIcon: doc.getElementById('cloudSyncIcon'),
        cloudSyncButtonLabel: doc.getElementById('cloudSyncButtonLabel'),
        cloudSyncModal: doc.getElementById('cloudSyncModal'),
        closeModalButton: doc.getElementById('closeCloudSyncModalButton'),
        cancelModalButton: doc.getElementById('cloudSyncCancelButton'),
        statusBanner: doc.getElementById('cloudSyncStatusBanner'),
        statusDot: doc.getElementById('cloudSyncStatusDot'),
        statusText: doc.getElementById('cloudSyncStatusText'),
        lastSyncedText: doc.getElementById('cloudSyncLastSyncedText'),
        clientIdInput: doc.getElementById('cloudSyncClientIdInput'),
        connectButton: doc.getElementById('cloudSyncConnectButton'),
        syncNowButton: doc.getElementById('cloudSyncNowButton'),
        disconnectButton: doc.getElementById('cloudSyncDisconnectButton')
    };
}

function bindCloudSyncEvents(elements, handlers) {
    elements.cloudSyncButton?.addEventListener('click', handlers.openModal);
    elements.closeModalButton?.addEventListener('click', handlers.closeModal);
    elements.cancelModalButton?.addEventListener('click', handlers.closeModal);
    elements.connectButton?.addEventListener('click', handlers.handleConnect);
    elements.syncNowButton?.addEventListener('click', handlers.handleSyncNow);
    elements.disconnectButton?.addEventListener('click', handlers.handleDisconnect);
}

function unbindCloudSyncEvents(elements, handlers) {
    elements.cloudSyncButton?.removeEventListener('click', handlers.openModal);
    elements.closeModalButton?.removeEventListener('click', handlers.closeModal);
    elements.cancelModalButton?.removeEventListener('click', handlers.closeModal);
    elements.connectButton?.removeEventListener('click', handlers.handleConnect);
    elements.syncNowButton?.removeEventListener('click', handlers.handleSyncNow);
    elements.disconnectButton?.removeEventListener('click', handlers.handleDisconnect);
}

function buildSyncSuccessMessage(result) {
    const pulled = Number(result?.pulledCount) || 0;
    const uploaded = Number(result?.uploadedCount) || 0;
    const deleted = Number(result?.deletedCount) || 0;
    if (pulled > 0 || uploaded > 0 || deleted > 0) {
        const parts = [`${pulled} pulled`, `${uploaded} uploaded`];
        if (deleted > 0) parts.push(`${deleted} removed`);
        return `✓ Matches synced with Google Drive (${parts.join(', ')}).`;
    }
    return '✓ Matches synced with Google Drive. Everything is up to date.';
}

function createSyncHandlers(elements, onSyncCompleted, triggerJustSynced, render) {
    return {
        openModal: () => {
            if (elements.cloudSyncModal) {
                elements.cloudSyncModal.classList.remove('hidden');
                const config = cloudSyncService.getConfig();
                if (elements.clientIdInput && !elements.clientIdInput.value && config.customClientId) {
                    elements.clientIdInput.value = config.customClientId;
                }
            }
        },
        closeModal: () => {
            if (elements.cloudSyncModal) elements.cloudSyncModal.classList.add('hidden');
        },
        handleConnect: async () => {
            const rawClientId = elements.clientIdInput?.value?.trim() || '';
            const config = cloudSyncService.getConfig();
            const targetClientId = rawClientId || config.clientId;
            if (!targetClientId) {
                notificationService.notify('Please enter your Google Client ID to connect.', 'warn');
                return;
            }
            try {
                if (elements.connectButton) {
                    elements.connectButton.disabled = true;
                    elements.connectButton.innerHTML = '<i class="fas fa-rotate fa-spin mr-1.5" aria-hidden="true"></i>Connecting...';
                }
                await cloudSyncService.requestToken(targetClientId);
                cloudSyncService.saveConfig({ clientId: rawClientId, connected: true });
                notificationService.notify('Connected to Google Drive! Syncing matches...', 'success');
                const result = await cloudSyncService.syncNow({ interactive: true });
                triggerJustSynced();
                onSyncCompleted(result);
            } catch (error) {
                logger.error('Failed to connect Google Drive:', error);
                notificationService.notify(`Failed to connect Google Drive: ${error.message}`, 'error');
                render();
            }
        },
        handleSyncNow: async () => {
            try {
                const result = await cloudSyncService.syncNow({ interactive: true });
                if (result && result.success !== false && !result.error) {
                    triggerJustSynced();
                    notificationService.notify(buildSyncSuccessMessage(result), 'success');
                    onSyncCompleted(result);
                } else if (result?.reason === 'offline') {
                    notificationService.notify('Cannot sync while offline. Changes saved locally.', 'warn');
                }
            } catch (error) {
                logger.error('Sync failed:', error);
                notificationService.notify(`Cloud sync failed: ${error.message}`, 'error');
                render();
            }
        },
        handleDisconnect: () => {
            const confirmed = notificationService.confirm(
                'Disconnect Google Drive sync? Your local matches will remain safe.'
            );
            if (!confirmed) return;
            cloudSyncService.clearConfig();
            if (elements.clientIdInput) elements.clientIdInput.value = '';
            notificationService.notify('Disconnected from Google Drive.', 'info');
        }
    };
}

function handleStorageMutation({ gameId, action }, onSyncCompleted) {
    if (action === 'remove') {
        if (typeof cloudSyncService.markGameDeleted === 'function') {
            cloudSyncService.markGameDeleted(gameId);
        }
        cloudSyncService.syncIfConnected().then(result => {
            if (result && result.success) onSyncCompleted(result);
        }).catch(err => {
            logger.warn('Background delete sync failed:', err);
        });
        return;
    }
    if (action === 'save' || action === 'upsert' || action === 'update') {
        cloudSyncService.markGameDirty(gameId);
        cloudSyncService.syncIfConnected().then(result => {
            if (result && result.success) onSyncCompleted(result);
        }).catch(err => {
            logger.warn('Background sync failed:', err);
        });
    }
}

/**
 * Initializes Cloud Sync UI elements and binds lifecycle hooks.
 * @param {Object} [options]
 * @returns {Function} Unsubscribe and cleanup function
 */
export function initCloudSyncController(options = {}) {
    const onSyncCompleted = options.onSyncCompleted || (() => {});
    let justSyncedTimer = null;
    let isJustSynced = false;

    const elements = queryCloudSyncElements(document);

    const render = (state) => {
        const config = cloudSyncService.getConfig();
        updateSyncStatusView(elements, state, config, isJustSynced);
    };

    const triggerJustSynced = () => {
        isJustSynced = true;
        if (justSyncedTimer) clearTimeout(justSyncedTimer);
        render();
        justSyncedTimer = setTimeout(() => {
            isJustSynced = false;
            render();
        }, 2500);
    };

    const handlers = createSyncHandlers(elements, onSyncCompleted, triggerJustSynced, render);
    bindCloudSyncEvents(elements, handlers);

    const unsubscribeCloudSync = cloudSyncService.subscribe((state) => {
        if (state?.status === 'success') {
            triggerJustSynced();
        } else {
            render(state);
        }
    });

    const unsubscribeGameChanges = gameStorageManager.addChangeListener((change) => {
        handleStorageMutation(change, onSyncCompleted);
    });

    render();

    return () => {
        if (justSyncedTimer) clearTimeout(justSyncedTimer);
        unbindCloudSyncEvents(elements, handlers);
        unsubscribeCloudSync();
        unsubscribeGameChanges();
    };
}

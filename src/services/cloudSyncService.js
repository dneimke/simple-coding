/**
 * CloudSyncService - Client-side Google Drive sync service
 *
 * Provides personal cloud sync across devices using Google Drive (drive.file scope).
 * Syncs saved matches as lossless Sportscode XML files in a dedicated 'SimpleCoding' folder.
 * Preserves Invariant 1 (Client-side first) and the Eyes-on-Pitch rule:
 * live logging and local saves never wait on network requests.
 */

import { storageService } from './storageService.js';
import { gameStorageManager } from './gameStorageManager.js';
import { generateGameXml, parseXmlToEvents, mergeXmlEventStreams } from '../utils/xmlUtils.js';
import { logger } from '../utils/formatUtils.js';

export const CLOUD_SYNC_STORAGE_KEY = 'fieldHockeyCloudSync_v1';
const GOOGLE_DRIVE_FOLDER_NAME = 'SimpleCoding';
const GOOGLE_OAUTH_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

/**
 * Builds a deterministic, clean remote filename for a game
 * @param {Object} game
 * @returns {string} e.g. "fire-vs-tigers_game-123.xml"
 */
export function buildRemoteFileName(game) {
    const rawTitle = (game && game.teams) ? game.teams : 'match';
    const slug = rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'match';
    const id = (game && game.id) ? game.id : 'unknown';
    return `${slug}_${id}.xml`;
}

/**
 * Extracts gameId from remote filename formatted as slug_gameId.xml
 * @param {string} fileName
 * @returns {string}
 */
export function extractGameIdFromRemoteFileName(fileName) {
    if (!fileName) return '';
    const withoutExt = fileName.replace(/\.xml$/i, '');
    const lastUnderscore = withoutExt.lastIndexOf('_');
    if (lastUnderscore >= 0) {
        return withoutExt.slice(lastUnderscore + 1);
    }
    return withoutExt;
}

function buildMergedGameFromRemote(existing, meta, parsedEvents) {
    const baseEvents = (existing && existing.events) || [];
    const mergedEvents = mergeXmlEventStreams(baseEvents, parsedEvents);
    const existingElapsed = Number(existing && existing.elapsedTime) || 0;
    const remoteElapsed = Number(meta && meta.elapsedTime) || 0;
    const maxEventMs = mergedEvents.reduce((max, ev) => Math.max(max, ev.timeMs || 0), 0);

    return {
        ...existing,
        id: existing.id,
        teams: existing.teams || meta.teams || null,
        events: mergedEvents,
        elapsedTime: Math.max(existingElapsed, remoteElapsed, maxEventMs),
        timestamp: meta.timestamp || existing.timestamp || new Date().toISOString(),
        teamCodes: existing.teamCodes || meta.teamCodes || undefined,
        teamMeta: existing.teamMeta || meta.teamMeta || undefined,
        videoOffsetMs: existing.videoOffsetMs ?? meta.videoOffsetMs ?? undefined
    };
}

function buildNewGameFromRemote(gameId, meta, parsedEvents) {
    const maxEventMs = parsedEvents.reduce((max, ev) => Math.max(max, ev.timeMs || 0), 0);
    const elapsedTime = meta.elapsedTime !== null && meta.elapsedTime !== undefined
        ? Math.max(meta.elapsedTime, maxEventMs)
        : maxEventMs;

    return {
        id: gameId,
        teams: meta.teams || 'Imported Game',
        events: parsedEvents,
        elapsedTime,
        timestamp: meta.timestamp || new Date().toISOString(),
        teamCodes: meta.teamCodes || undefined,
        teamMeta: meta.teamMeta || undefined,
        videoOffsetMs: meta.videoOffsetMs ?? undefined
    };
}

/**
 * Pure deterministic reconciliation between local games and remote XML files
 * @param {Array<Object>} localGames
 * @param {Array<{id: string, name: string, xmlContent: string, modifiedTime?: string}>} remoteEntries
 * @returns {{ updatedLocalGames: Array<Object>, dirtyGameIdsToUpload: Array<string> }}
 */
export function reconcileCloudGames(localGames = [], remoteEntries = []) {
    const localMap = new Map();
    (localGames || []).forEach(g => {
        if (g && g.id) localMap.set(g.id, { ...g });
    });

    const remoteProcessedIds = new Set();

    (remoteEntries || []).forEach(entry => {
        if (!entry || !entry.xmlContent) return;
        try {
            const parsedEvents = parseXmlToEvents(entry.xmlContent);
            const meta = parsedEvents.gameMetadata || {};
            const gameId = meta.gameId || extractGameIdFromRemoteFileName(entry.name);
            if (!gameId) return;

            remoteProcessedIds.add(gameId);

            if (localMap.has(gameId)) {
                const existing = localMap.get(gameId);
                const merged = buildMergedGameFromRemote(existing, meta, parsedEvents);
                localMap.set(gameId, merged);
            } else {
                const newGame = buildNewGameFromRemote(gameId, meta, parsedEvents);
                localMap.set(gameId, newGame);
            }
        } catch (err) {
            logger.warn('Failed to parse remote cloud XML:', entry.name, err);
        }
    });

    const updatedLocalGames = Array.from(localMap.values());
    const dirtyGameIdsToUpload = [];

    (localGames || []).forEach(g => {
        if (g && g.id && !remoteProcessedIds.has(g.id)) {
            dirtyGameIdsToUpload.push(g.id);
        }
    });

    return { updatedLocalGames, dirtyGameIdsToUpload };
}

async function fetchDriveApi(path, options = {}, token) {
    const url = path.startsWith('http') ? path : `https://www.googleapis.com/drive/v3/${path}`;
    const headers = {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`
    };
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Google Drive API error (${response.status}): ${text}`);
    }
    return response;
}

async function downloadXmlContent(token, fileId) {
    const res = await fetchDriveApi(`files/${fileId}?alt=media`, {}, token);
    return res.text();
}

function buildMultipartXmlPayload(metadata, xmlContent) {
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelim = `\r\n--${boundary}--`;

    const body =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/xml; charset=utf-8\r\n\r\n' +
        xmlContent +
        closeDelim;

    return { body, boundary };
}

async function uploadGameFile(token, folderId, game, existingRemoteFiles = []) {
    const xmlContent = generateGameXml(game);
    const fileName = buildRemoteFileName(game);
    const existing = existingRemoteFiles.find(f => f.name.includes(game.id) || f.name === fileName);

    if (existing) {
        const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`;
        await fetchDriveApi(uploadUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/xml; charset=utf-8' },
            body: xmlContent
        }, token);
        return existing.id;
    }

    const metadata = { name: fileName, parents: [folderId] };
    const { body, boundary } = buildMultipartXmlPayload(metadata, xmlContent);
    const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const res = await fetchDriveApi(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body
    }, token);

    const data = await res.json();
    return data.id;
}

async function fetchRemoteEntries(token, remoteFiles) {
    return Promise.all(
        remoteFiles.map(async file => ({
            id: file.id,
            name: file.name,
            modifiedTime: file.modifiedTime,
            xmlContent: await downloadXmlContent(token, file.id)
        }))
    );
}

async function uploadDirtyGames(token, folderId, games, remoteFiles, dirtyIds) {
    const remaining = new Set(dirtyIds);
    for (const gameId of dirtyIds) {
        const gameToUpload = games.find(g => g && g.id === gameId);
        if (!gameToUpload) {
            remaining.delete(gameId);
            continue;
        }
        try {
            await uploadGameFile(token, folderId, gameToUpload, remoteFiles);
            remaining.delete(gameId);
        } catch (uploadErr) {
            logger.error('Failed to upload game to Drive:', gameId, uploadErr);
        }
    }
    return Array.from(remaining);
}

export class CloudSyncService {
    constructor() {
        this._token = null;
        this._tokenExpiresAt = 0;
        this._listeners = new Set();
        this._gisLoadingPromise = null;
        this._syncing = false;
    }

    getConfig() {
        const stored = storageService.getItem(CLOUD_SYNC_STORAGE_KEY);
        return {
            clientId: (stored && stored.clientId) || '',
            folderId: (stored && stored.folderId) || null,
            lastSyncedAt: (stored && stored.lastSyncedAt) || null,
            dirtyGameIds: Array.isArray(stored && stored.dirtyGameIds) ? [...stored.dirtyGameIds] : []
        };
    }

    saveConfig(updates = {}) {
        const current = this.getConfig();
        const next = { ...current, ...updates };
        storageService.setItem(CLOUD_SYNC_STORAGE_KEY, next);
        this._notifyListeners();
        return next;
    }

    clearConfig() {
        this._token = null;
        this._tokenExpiresAt = 0;
        storageService.removeItem(CLOUD_SYNC_STORAGE_KEY);
        this._notifyListeners();
    }

    isConnected() {
        return Boolean(this.getConfig().clientId);
    }

    isSyncing() {
        return this._syncing;
    }

    markGameDirty(gameId) {
        if (!gameId) return;
        const config = this.getConfig();
        if (!config.dirtyGameIds.includes(gameId)) {
            this.saveConfig({ dirtyGameIds: [...config.dirtyGameIds, gameId] });
        }
    }

    clearDirtyGame(gameId) {
        if (!gameId) return;
        const config = this.getConfig();
        if (config.dirtyGameIds.includes(gameId)) {
            this.saveConfig({ dirtyGameIds: config.dirtyGameIds.filter(id => id !== gameId) });
        }
    }

    subscribe(listener) {
        if (typeof listener === 'function') {
            this._listeners.add(listener);
        }
        return () => this._listeners.delete(listener);
    }

    _notifyListeners(status = null) {
        const state = {
            isConnected: this.isConnected(),
            isSyncing: this._syncing,
            lastSyncedAt: this.getConfig().lastSyncedAt,
            status
        };
        this._listeners.forEach(fn => {
            try { fn(state); } catch (err) { logger.error('Error in cloud sync listener:', err); }
        });
    }

    async loadGoogleIdentityServices() {
        if (typeof window === 'undefined') return false;
        if (window.google?.accounts?.oauth2) return true;
        if (this._gisLoadingPromise) return this._gisLoadingPromise;

        this._gisLoadingPromise = new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = GIS_SCRIPT_URL;
            script.async = true;
            script.defer = true;
            script.onload = () => resolve(true);
            script.onerror = () => {
                logger.error('Failed to load Google Identity Services');
                resolve(false);
            };
            document.head.appendChild(script);
        });

        return this._gisLoadingPromise;
    }

    async requestToken(clientId) {
        const ready = await this.loadGoogleIdentityServices();
        if (!ready || !window.google?.accounts?.oauth2) {
            throw new Error('Google Identity Services unavailable');
        }

        return new Promise((resolve, reject) => {
            try {
                const tokenClient = window.google.accounts.oauth2.initTokenClient({
                    client_id: clientId,
                    scope: GOOGLE_OAUTH_SCOPE,
                    callback: (response) => {
                        if (response.error) {
                            reject(new Error(response.error_description || response.error));
                            return;
                        }
                        this._token = response.access_token;
                        const expiresIn = Number(response.expires_in) || 3600;
                        this._tokenExpiresAt = Date.now() + (expiresIn - 60) * 1000;
                        resolve(this._token);
                    }
                });
                tokenClient.requestAccessToken({ prompt: '' });
            } catch (err) {
                reject(err);
            }
        });
    }

    async getAccessToken() {
        if (this._token && Date.now() < this._tokenExpiresAt) {
            return this._token;
        }
        const { clientId } = this.getConfig();
        if (!clientId) return null;
        return this.requestToken(clientId);
    }

    async ensureFolder(token) {
        const config = this.getConfig();
        if (config.folderId) return config.folderId;

        const q = `mimeType = 'application/vnd.google-apps.folder' and name = '${GOOGLE_DRIVE_FOLDER_NAME}' and trashed = false`;
        const searchRes = await fetchDriveApi(`files?q=${encodeURIComponent(q)}&fields=files(id,name)`, {}, token);
        const searchData = await searchRes.json();

        if (Array.isArray(searchData.files) && searchData.files.length > 0) {
            const folderId = searchData.files[0].id;
            this.saveConfig({ folderId });
            return folderId;
        }

        const createRes = await fetchDriveApi('files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: GOOGLE_DRIVE_FOLDER_NAME,
                mimeType: 'application/vnd.google-apps.folder'
            })
        }, token);
        const createData = await createRes.json();
        const folderId = createData.id;
        this.saveConfig({ folderId });
        return folderId;
    }

    async listRemoteXmlFiles(token, folderId) {
        const q = `'${folderId}' in parents and trashed = false and name contains '.xml'`;
        const res = await fetchDriveApi(`files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)`, {}, token);
        const data = await res.json();
        return Array.isArray(data.files) ? data.files : [];
    }

    async syncNow() {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            logger.warn('Cloud sync skipped: offline');
            return { success: false, reason: 'offline' };
        }
        if (!this.isConnected()) return { success: false, reason: 'unconfigured' };
        if (this._syncing) return { success: false, reason: 'already_syncing' };

        this._syncing = true;
        this._notifyListeners('syncing');

        try {
            const token = await this.getAccessToken();
            if (!token) {
                this._syncing = false;
                this._notifyListeners('auth_required');
                return { success: false, reason: 'auth_required' };
            }

            const folderId = await this.ensureFolder(token);
            const remoteFiles = await this.listRemoteXmlFiles(token, folderId);
            const remoteEntries = await fetchRemoteEntries(token, remoteFiles);

            const localGames = gameStorageManager.getAllGames();
            const { updatedLocalGames, dirtyGameIdsToUpload } = reconcileCloudGames(localGames, remoteEntries);

            storageService.setItem(gameStorageManager.STORAGE_KEY, updatedLocalGames);
            if (typeof gameStorageManager._updateCache === 'function') {
                gameStorageManager._updateCache(updatedLocalGames);
            }

            const combinedDirty = [...new Set([...this.getConfig().dirtyGameIds, ...dirtyGameIdsToUpload])];
            const nextDirty = await uploadDirtyGames(token, folderId, updatedLocalGames, remoteFiles, combinedDirty);

            this.saveConfig({
                dirtyGameIds: nextDirty,
                lastSyncedAt: new Date().toISOString()
            });

            this._syncing = false;
            this._notifyListeners('success');
            return { success: true, pulledCount: remoteEntries.length };
        } catch (error) {
            logger.error('Cloud sync error:', error);
            this._syncing = false;
            this._notifyListeners('error');
            return { success: false, error: error.message };
        }
    }

    async syncIfConnected() {
        if (!this.isConnected()) return;
        return this.syncNow();
    }
}

export const cloudSyncService = new CloudSyncService();

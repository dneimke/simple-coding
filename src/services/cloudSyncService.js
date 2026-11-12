/**
 * CloudSyncService - Client-side Google Drive sync service
 *
 * Provides personal cloud sync across devices using Google Drive (drive.file scope).
 * Syncs saved matches as lossless Sportscode XML files in a dedicated 'SimpleCoding' folder.
 * Preserves Invariant 1 (Client-side first) and the Eyes-on-Pitch rule:
 * live logging and local saves never wait on network requests.
 *
 * See docs/feat/cloud-sync/spec.md for reconciliation and lifecycle rules.
 */

import { storageService } from './storageService.js';
import { gameStorageManager } from './gameStorageManager.js';
import { generateGameXml, parseXmlToEvents } from '../utils/xmlUtils.js';
import { logger } from '../utils/formatUtils.js';

export const DEFAULT_GOOGLE_CLIENT_ID = '604920442128-appggcqdfj7e90qoe9ntqb83eh18qsq9.apps.googleusercontent.com';
export const CLOUD_SYNC_STORAGE_KEY = 'fieldHockeyCloudSync_v1';
export const CLOUD_SYNC_SESSION_TOKEN_KEY = 'fieldHockeyCloudSyncToken_v1';
const GOOGLE_DRIVE_FOLDER_NAME = 'SimpleCoding';
const GOOGLE_OAUTH_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

/**
 * Builds a deterministic, clean remote filename for a game
 * @param {Object} game
 * @returns {string} e.g. "fire-vs-tigers_game-123.xml"
 */
export function buildRemoteFileName(game) {
    const rawTitle = (game && game.teams) ? String(game.teams) : 'match';
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

function firstDefined(...values) {
    for (const val of values) {
        if (val !== undefined && val !== null && val !== '') return val;
    }
    return undefined;
}

function computeSnapshotElapsedTime(meta, parsedEvents) {
    const maxEventMs = parsedEvents.reduce((max, ev) => Math.max(max, ev.timeMs || 0), 0);
    const remoteElapsed = Number(meta.elapsedTime) || 0;
    return Math.max(remoteElapsed, maxEventMs);
}

function buildSnapshotMetadata(existing, videoUrl, lastUpdated) {
    const baseMeta = (existing && existing.metadata) ? { ...existing.metadata } : {};
    if (videoUrl) baseMeta.videoUrl = videoUrl;
    if (lastUpdated) baseMeta.lastUpdated = lastUpdated;
    return Object.keys(baseMeta).length > 0 ? baseMeta : undefined;
}

function buildRemoteSnapshotGame(gameId, meta, parsedEvents, existing = null, remoteModifiedTime = null) {
    const base = existing || {};
    const baseMeta = base.metadata || {};
    const videoUrl = firstDefined(meta.videoUrl, base.videoUrl, baseMeta.videoUrl);
    const lastUpdated = firstDefined(meta.lastUpdated, remoteModifiedTime, baseMeta.lastUpdated);
    const metadata = buildSnapshotMetadata(base, videoUrl, lastUpdated);

    const snapshot = {
        ...base,
        id: gameId,
        teams: firstDefined(meta.teams, base.teams, 'Imported Game'),
        events: parsedEvents,
        elapsedTime: computeSnapshotElapsedTime(meta, parsedEvents),
        timestamp: firstDefined(meta.timestamp, base.timestamp, new Date().toISOString()),
        teamCodes: firstDefined(meta.teamCodes, base.teamCodes),
        teamMeta: firstDefined(meta.teamMeta, base.teamMeta),
        videoOffsetMs: meta.videoOffsetMs ?? base.videoOffsetMs
    };
    if (videoUrl) snapshot.videoUrl = videoUrl;
    if (metadata) snapshot.metadata = metadata;
    return snapshot;
}

function isLocalGameNewerOrEqual(localGame, remoteMeta, remoteModifiedTime) {
    const localUpdatedStr = firstDefined(localGame?.lastUpdated, localGame?.metadata?.lastUpdated);
    const remoteUpdatedStr = firstDefined(remoteMeta?.lastUpdated, remoteModifiedTime);
    if (!remoteUpdatedStr || !localUpdatedStr) return true;
    const localMs = new Date(localUpdatedStr).getTime();
    const remoteMs = new Date(remoteUpdatedStr).getTime();
    if (Number.isNaN(localMs) || Number.isNaN(remoteMs)) return true;
    return localMs >= remoteMs;
}

function sortGamesNewestFirst(games = []) {
    return [...games].sort((a, b) => {
        const tA = a && a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tB = b && b.timestamp ? new Date(b.timestamp).getTime() : 0;
        const validA = Number.isFinite(tA) ? tA : 0;
        const validB = Number.isFinite(tB) ? tB : 0;
        return validB - validA;
    });
}

function resolveCommonGameEntry(existing, isDirty, meta, parsedEvents, entry, dirtyToUpload) {
    if (!isDirty) {
        return {
            game: buildRemoteSnapshotGame(existing.id, meta, parsedEvents, existing, entry.modifiedTime),
            updatedFromRemote: true
        };
    }
    if (isLocalGameNewerOrEqual(existing, meta, entry.modifiedTime)) {
        dirtyToUpload.add(existing.id);
        return { game: existing, updatedFromRemote: false };
    }
    return {
        game: buildRemoteSnapshotGame(existing.id, meta, parsedEvents, existing, entry.modifiedTime),
        updatedFromRemote: true
    };
}

function capReconciledGames(sortedGames, maxGames, dirtyToUpload) {
    if (maxGames <= 0 || sortedGames.length <= maxGames) return sortedGames;
    return sortedGames.filter((g, idx) => idx < maxGames || dirtyToUpload.has(g.id));
}

function shouldKeepLocalGameBeforePull(game, deletedSet, dirtySet, previouslySyncedSet, activeRemoteSet) {
    if (!game || !game.id || deletedSet.has(game.id)) return false;
    if (activeRemoteSet && previouslySyncedSet.has(game.id) && !activeRemoteSet.has(game.id) && !dirtySet.has(game.id)) {
        return false;
    }
    return true;
}

/**
 * Pure deterministic reconciliation between local games and remote XML files.
 * Follows docs/feat/cloud-sync/spec.md Reconciliation Authority Matrix.
 *
 * @param {Array<Object>} localGames
 * @param {Array<{id: string, name: string, xmlContent: string, modifiedTime?: string}>} remoteEntries
 * @param {Object} [options]
 * @param {Array<string>} [options.dirtyGameIds]
 * @param {Array<string>} [options.deletedGameIds]
 * @param {Object} [options.remoteFileMeta]
 * @param {Array<string>} [options.activeRemoteIds]
 * @param {number} [options.maxGames]
 * @returns {{ updatedLocalGames: Array<Object>, dirtyGameIdsToUpload: Array<string>, pulledCount: number, remotelyDeletedCount: number }}
 */
export function reconcileCloudGames(localGames = [], remoteEntries = [], options = {}) {
    const dirtySet = new Set(options.dirtyGameIds || []);
    const deletedSet = new Set(options.deletedGameIds || []);
    const knownRemoteMeta = options.remoteFileMeta || {};
    const previouslySyncedSet = new Set(Object.keys(knownRemoteMeta));
    const activeRemoteSet = Array.isArray(options.activeRemoteIds) ? new Set(options.activeRemoteIds) : null;
    const maxGames = Number(options.maxGames) > 0 ? Number(options.maxGames) : 0;

    const localMap = new Map();
    let remotelyDeletedCount = 0;

    (localGames || []).forEach(g => {
        if (!g || !g.id || deletedSet.has(g.id)) return;
        if (!shouldKeepLocalGameBeforePull(g, deletedSet, dirtySet, previouslySyncedSet, activeRemoteSet)) {
            remotelyDeletedCount++;
            return;
        }
        localMap.set(g.id, { ...g });
    });

    const remoteProcessedIds = new Set(activeRemoteSet || previouslySyncedSet);
    const dirtyToUpload = new Set();
    let pulledCount = 0;

    dirtySet.forEach(id => {
        if (localMap.has(id) && !deletedSet.has(id)) {
            dirtyToUpload.add(id);
        }
    });

    (remoteEntries || []).forEach(entry => {
        if (!entry || !entry.xmlContent) return;
        try {
            const parsedEvents = parseXmlToEvents(entry.xmlContent);
            const meta = parsedEvents.gameMetadata || {};
            const gameId = meta.gameId || extractGameIdFromRemoteFileName(entry.name);
            if (!gameId || deletedSet.has(gameId)) return;

            remoteProcessedIds.add(gameId);

            if (localMap.has(gameId)) {
                const resolved = resolveCommonGameEntry(
                    localMap.get(gameId),
                    dirtySet.has(gameId),
                    meta,
                    parsedEvents,
                    entry,
                    dirtyToUpload
                );
                localMap.set(gameId, resolved.game);
                if (resolved.updatedFromRemote) {
                    dirtyToUpload.delete(gameId);
                    pulledCount++;
                }
            } else {
                localMap.set(gameId, buildRemoteSnapshotGame(gameId, meta, parsedEvents, null, entry.modifiedTime));
                pulledCount++;
            }
        } catch (err) {
            logger.warn('Failed to parse remote cloud XML:', entry.name, err);
        }
    });

    (localGames || []).forEach(g => {
        if (g && g.id && localMap.has(g.id) && !remoteProcessedIds.has(g.id)) {
            dirtyToUpload.add(g.id);
        }
    });

    const sorted = sortGamesNewestFirst(Array.from(localMap.values()));
    return {
        updatedLocalGames: capReconciledGames(sorted, maxGames, dirtyToUpload),
        dirtyGameIdsToUpload: Array.from(dirtyToUpload),
        pulledCount,
        remotelyDeletedCount
    };
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

async function safeParseJson(res) {
    try {
        return (await res.json()) || {};
    } catch {
        return {};
    }
}

async function patchExistingRemoteFile(token, existing, fileName, xmlContent) {
    if (existing.name !== fileName) {
        const { body, boundary } = buildMultipartXmlPayload({ name: fileName }, xmlContent);
        const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart&fields=id,name,modifiedTime`;
        const res = await fetchDriveApi(uploadUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
            body
        }, token);
        const data = await safeParseJson(res);
        return { id: existing.id, modifiedTime: data.modifiedTime };
    }
    const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media&fields=id,name,modifiedTime`;
    const res = await fetchDriveApi(uploadUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
        body: xmlContent
    }, token);
    const data = await safeParseJson(res);
    return { id: existing.id, modifiedTime: data.modifiedTime };
}

async function uploadGameFile(token, folderId, game, existingRemoteFiles = []) {
    const xmlContent = generateGameXml(game);
    const fileName = buildRemoteFileName(game);
    const existing = existingRemoteFiles.find(
        f => extractGameIdFromRemoteFileName(f.name) === game.id || f.name.includes(game.id) || f.name === fileName
    );

    if (existing) {
        return patchExistingRemoteFile(token, existing, fileName, xmlContent);
    }

    const metadata = { name: fileName, parents: [folderId] };
    const { body, boundary } = buildMultipartXmlPayload(metadata, xmlContent);
    const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime';
    const res = await fetchDriveApi(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body
    }, token);

    const data = await safeParseJson(res);
    return { id: data.id, modifiedTime: data.modifiedTime };
}

function shouldDownloadRemoteFile(file, localIds, deletedSet, remoteFileMeta) {
    const gameId = extractGameIdFromRemoteFileName(file.name);
    if (gameId && deletedSet.has(gameId)) return false;
    const cached = gameId ? remoteFileMeta[gameId] : null;
    if (cached && file.modifiedTime && cached.modifiedTime === file.modifiedTime && localIds.has(gameId)) {
        return false;
    }
    return true;
}

async function fetchRemoteEntries(token, remoteFiles, options = {}) {
    const localIds = new Set((options.localGames || []).map(g => g && g.id).filter(Boolean));
    const deletedSet = new Set(options.deletedGameIds || []);
    const remoteFileMeta = options.remoteFileMeta || {};

    const filesToDownload = remoteFiles.filter(f =>
        shouldDownloadRemoteFile(f, localIds, deletedSet, remoteFileMeta)
    );

    const entries = await Promise.all(
        filesToDownload.map(async file => {
            try {
                const xmlContent = await downloadXmlContent(token, file.id);
                return {
                    id: file.id,
                    name: file.name,
                    modifiedTime: file.modifiedTime,
                    xmlContent
                };
            } catch (err) {
                logger.warn('Failed to download remote XML file:', file.name, err);
                return null;
            }
        })
    );
    return entries.filter(Boolean);
}

async function trashDeletedGamesOnDrive(token, remoteFiles, deletedIds = [], remoteFileMeta = {}) {
    const remainingDeleted = new Set(deletedIds);
    const updatedMeta = { ...remoteFileMeta };

    for (const gameId of deletedIds) {
        const matchFile = remoteFiles.find(
            f => extractGameIdFromRemoteFileName(f.name) === gameId || f.name.includes(gameId)
        );
        const fileId = (matchFile && matchFile.id) || (updatedMeta[gameId] && updatedMeta[gameId].fileId);
        if (!fileId) {
            remainingDeleted.delete(gameId);
            delete updatedMeta[gameId];
            continue;
        }
        try {
            await fetchDriveApi(`files/${fileId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trashed: true })
            }, token);
            remainingDeleted.delete(gameId);
            delete updatedMeta[gameId];
        } catch (err) {
            logger.warn('Failed to trash deleted game on Drive:', gameId, err);
        }
    }
    return {
        remainingDeletedIds: Array.from(remainingDeleted),
        updatedRemoteMeta: updatedMeta
    };
}

async function uploadSingleDirtyGame(token, folderId, gameToUpload, remoteFiles, remaining, updatedMeta) {
    try {
        const uploaded = await uploadGameFile(token, folderId, gameToUpload, remoteFiles);
        remaining.delete(gameToUpload.id);
        if (uploaded && uploaded.id) {
            updatedMeta[gameToUpload.id] = {
                fileId: uploaded.id,
                name: buildRemoteFileName(gameToUpload),
                modifiedTime: uploaded.modifiedTime || new Date().toISOString()
            };
        }
    } catch (uploadErr) {
        logger.error('Failed to upload game to Drive:', gameToUpload.id, uploadErr);
    }
}

async function uploadDirtyGames(token, folderId, games, remoteFiles, dirtyIds, remoteFileMeta = {}) {
    const remaining = new Set(dirtyIds);
    const updatedMeta = { ...remoteFileMeta };

    for (const gameId of dirtyIds) {
        const gameToUpload = games.find(g => g && g.id === gameId);
        if (!gameToUpload) {
            remaining.delete(gameId);
            continue;
        }
        await uploadSingleDirtyGame(token, folderId, gameToUpload, remoteFiles, remaining, updatedMeta);
    }
    return {
        remainingDirtyIds: Array.from(remaining),
        updatedRemoteMeta: updatedMeta
    };
}

function readSessionToken() {
    if (typeof sessionStorage === 'undefined') return null;
    try {
        const raw = sessionStorage.getItem(CLOUD_SYNC_SESSION_TOKEN_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && parsed.token && Number(parsed.expiresAt) > Date.now()) {
            return parsed;
        }
        sessionStorage.removeItem(CLOUD_SYNC_SESSION_TOKEN_KEY);
    } catch {
        // Ignore sessionStorage errors
    }
    return null;
}

function writeSessionToken(token, expiresAt) {
    if (typeof sessionStorage === 'undefined') return;
    try {
        if (!token) {
            sessionStorage.removeItem(CLOUD_SYNC_SESSION_TOKEN_KEY);
            return;
        }
        sessionStorage.setItem(CLOUD_SYNC_SESSION_TOKEN_KEY, JSON.stringify({ token, expiresAt }));
    } catch {
        // Ignore sessionStorage errors
    }
}

function normalizeStoredArray(val) {
    return Array.isArray(val) ? [...val] : [];
}

function normalizeStoredObject(val) {
    return val && typeof val === 'object' ? { ...val } : {};
}

function deriveConnectedFlag(stored) {
    if (!stored) return false;
    if (stored.connected !== undefined) return Boolean(stored.connected);
    return Boolean(stored.lastSyncedAt || stored.folderId);
}

function buildActiveRemoteMetaMap(activeRemoteFiles) {
    const activeMeta = {};
    activeRemoteFiles.forEach(f => {
        const gId = extractGameIdFromRemoteFileName(f.name);
        if (gId) {
            activeMeta[gId] = { fileId: f.id, name: f.name, modifiedTime: f.modifiedTime };
        }
    });
    return activeMeta;
}

export class CloudSyncService {
    constructor() {
        const cached = readSessionToken();
        this._token = cached ? cached.token : null;
        this._tokenExpiresAt = cached ? cached.expiresAt : 0;
        this._listeners = new Set();
        this._gisLoadingPromise = null;
        this._syncing = false;
        this._lastStatus = null;
    }

    getConfig() {
        const stored = storageService.getItem(CLOUD_SYNC_STORAGE_KEY) || {};
        const customClientId = stored.clientId || '';
        return {
            clientId: customClientId || DEFAULT_GOOGLE_CLIENT_ID,
            customClientId,
            connected: deriveConnectedFlag(stored),
            folderId: stored.folderId || null,
            lastSyncedAt: stored.lastSyncedAt || null,
            dirtyGameIds: normalizeStoredArray(stored.dirtyGameIds),
            deletedGameIds: normalizeStoredArray(stored.deletedGameIds),
            remoteFileMeta: normalizeStoredObject(stored.remoteFileMeta)
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
        this._lastStatus = null;
        writeSessionToken(null, 0);
        storageService.removeItem(CLOUD_SYNC_STORAGE_KEY);
        this._notifyListeners();
    }

    isConnected() {
        const config = this.getConfig();
        return Boolean(config.connected && config.clientId);
    }

    hasValidSessionToken() {
        if (this._token && Date.now() < this._tokenExpiresAt) {
            return true;
        }
        const cached = readSessionToken();
        if (cached) {
            this._token = cached.token;
            this._tokenExpiresAt = cached.expiresAt;
            return true;
        }
        return false;
    }

    isSyncing() {
        return this._syncing;
    }

    getLastStatus() {
        return this._lastStatus;
    }

    markGameDirty(gameId) {
        if (!gameId) return;
        const config = this.getConfig();
        const nextDirty = config.dirtyGameIds.includes(gameId)
            ? config.dirtyGameIds
            : [...config.dirtyGameIds, gameId];
        const nextDeleted = config.deletedGameIds.filter(id => id !== gameId);
        this.saveConfig({ dirtyGameIds: nextDirty, deletedGameIds: nextDeleted });
    }

    markGameDeleted(gameId) {
        if (!gameId) return;
        const config = this.getConfig();
        const nextDeleted = config.deletedGameIds.includes(gameId)
            ? config.deletedGameIds
            : [...config.deletedGameIds, gameId];
        const nextDirty = config.dirtyGameIds.filter(id => id !== gameId);
        this.saveConfig({ dirtyGameIds: nextDirty, deletedGameIds: nextDeleted });
    }

    subscribe(listener) {
        if (typeof listener === 'function') {
            this._listeners.add(listener);
        }
        return () => this._listeners.delete(listener);
    }

    _notifyListeners(status = null) {
        if (status !== null) {
            this._lastStatus = status;
        }
        const state = {
            isConnected: this.isConnected(),
            isSyncing: this._syncing,
            lastSyncedAt: this.getConfig().lastSyncedAt,
            status: status ?? this._lastStatus
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
                        this._lastStatus = null;
                        writeSessionToken(this._token, this._tokenExpiresAt);
                        resolve(this._token);
                    }
                });
                tokenClient.requestAccessToken({ prompt: '' });
            } catch (err) {
                reject(err);
            }
        });
    }

    async getAccessToken(options = {}) {
        if (this.hasValidSessionToken()) {
            return this._token;
        }
        if (options.interactive === false) {
            return null;
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
        const res = await fetchDriveApi(`files?q=${encodeURIComponent(q)}&pageSize=100&fields=files(id,name,modifiedTime)`, {}, token);
        const data = await res.json();
        return Array.isArray(data.files) ? data.files : [];
    }

    async syncNow(options = {}) {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            logger.warn('Cloud sync skipped: offline');
            return { success: false, reason: 'offline' };
        }
        if (!this.isConnected()) return { success: false, reason: 'unconfigured' };
        if (this._syncing) return { success: false, reason: 'already_syncing' };

        this._syncing = true;
        this._notifyListeners('syncing');

        try {
            const token = await this.getAccessToken({ interactive: options.interactive !== false });
            if (!token) {
                this._syncing = false;
                this._notifyListeners('auth_required');
                return { success: false, reason: 'auth_required' };
            }

            const config = this.getConfig();
            const folderId = await this.ensureFolder(token);
            const remoteFiles = await this.listRemoteXmlFiles(token, folderId);

            const { remainingDeletedIds, updatedRemoteMeta: metaAfterTrash } = await trashDeletedGamesOnDrive(
                token,
                remoteFiles,
                config.deletedGameIds,
                config.remoteFileMeta
            );

            const deletedSet = new Set(config.deletedGameIds);
            const activeRemoteFiles = remoteFiles.filter(f => !deletedSet.has(extractGameIdFromRemoteFileName(f.name)));
            const activeRemoteMeta = buildActiveRemoteMetaMap(activeRemoteFiles);
            const activeRemoteIds = Object.keys(activeRemoteMeta);

            const localGames = gameStorageManager.getAllGames();
            const remoteEntries = await fetchRemoteEntries(token, activeRemoteFiles, {
                localGames,
                deletedGameIds: config.deletedGameIds,
                remoteFileMeta: metaAfterTrash
            });

            const { updatedLocalGames, dirtyGameIdsToUpload, pulledCount, remotelyDeletedCount } = reconcileCloudGames(localGames, remoteEntries, {
                dirtyGameIds: config.dirtyGameIds,
                deletedGameIds: config.deletedGameIds,
                remoteFileMeta: metaAfterTrash,
                activeRemoteIds,
                maxGames: gameStorageManager.MAX_GAMES || 20
            });

            storageService.setItem(gameStorageManager.STORAGE_KEY, updatedLocalGames);
            if (typeof gameStorageManager._updateCache === 'function') {
                gameStorageManager._updateCache(updatedLocalGames);
            }

            const { remainingDirtyIds, updatedRemoteMeta: finalRemoteMeta } = await uploadDirtyGames(
                token,
                folderId,
                updatedLocalGames,
                activeRemoteFiles,
                dirtyGameIdsToUpload,
                activeRemoteMeta
            );

            this.saveConfig({
                dirtyGameIds: remainingDirtyIds,
                deletedGameIds: remainingDeletedIds,
                remoteFileMeta: finalRemoteMeta,
                lastSyncedAt: new Date().toISOString()
            });

            const uploadedCount = dirtyGameIdsToUpload.length - remainingDirtyIds.length;
            const localTrashCount = config.deletedGameIds.length - remainingDeletedIds.length;
            const deletedCount = localTrashCount + (remotelyDeletedCount || 0);
            this._syncing = false;
            this._notifyListeners('success');
            return { success: true, pulledCount, uploadedCount, deletedCount };
        } catch (error) {
            logger.error('Cloud sync error:', error);
            this._syncing = false;
            this._notifyListeners('error');
            return { success: false, error: error.message };
        }
    }

    async syncIfConnected() {
        if (!this.isConnected()) return;
        return this.syncNow({ interactive: false });
    }
}

export const cloudSyncService = new CloudSyncService();

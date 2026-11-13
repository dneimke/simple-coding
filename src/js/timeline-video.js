import { ChordEngine } from '../utils/chordEngine.js';
import { bindChordDock } from '../utils/chordDockController.js';
import { renderTimeline } from './timeline.js';
import { storageService } from '../services/storageService.js';
import { notificationService } from '../services/notificationService.js';
import { generateGameId, gameStorageManager, findGameInArray } from '../services/gameStorageManager.js';
import { checkAndApplyMockSeed, ensureSampleGameExists, SAMPLE_GAME_ID } from '../utils/seedData.js';
import { getLabelSchemaForEvent, formatLabelText, getFriendlyEventName, getSweepScopeOptions, extractTeamFromEvent, getSweepSeekSeconds } from '../utils/eventAnalysisUtils.js';
import { DEFAULT_TEAMS } from '../components/teamPalette.js';
import { loadLastTeams, openTeamSetupDialog, saveLastTeams } from '../components/teamSetupDialog.js';
import { calculateVideoOffset, shiftEventTimings } from '../utils/gameUtils.js';
import { appendZoneSuffix, stripTrailingZoneDigit, zoneForTeam } from '../utils/zoneUtils.js';
import { setupMobileMenu } from '../utils/domUtils.js';
import { PresentationController } from './presentationController.js';
import { openMatchReport } from '../utils/matchReportGenerator.js';
import { cloudSyncService } from '../services/cloudSyncService.js';
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
} from './playlistManager.js';

import {
    validateVideoUrl,
    updateVideoStageOverlays,
    updateCurrentVideoBanner,
    switchAttachVideoTab,
    openAttachVideoModal,
    closeAttachVideoModal
} from './videoSourceManager.js';
import {
    shiftGameTimings as execShiftGameTimings,
    revertGameTimings as execRevertGameTimings,
    calculateAlignmentState,
    canOpenAlignmentModal,
    updateAlignmentModalPreview,
    buildAlignmentPreviewState
} from './videoAlignmentManager.js';
import { createQuickTagElement } from './quickTagEditorHelper.js';

const teamStripButtons = (slot, codes) => codes.map(([label, timing, zoned]) => ({
    id: `t${slot}-${label.toLowerCase()}`,
    label,
    team: slot === 1 ? 'team1' : 'team2',
    zoned: Boolean(zoned),
    lead: timing[0],
    lag: timing[1]
}));

const VIDEO_STRIP = [
    ...teamStripButtons(1, [
        ['BS', [10, 10], true],
        ['BW', [5, 5], true],
        ['A25E', [5, 10], false],
        ['CE', [10, 10], false],
        ['SHOT', [15, 5], false],
        ['GOAL', [15, 5], false]
    ]),
    ...teamStripButtons(2, [
        ['BS', [10, 10], true],
        ['BW', [5, 5], true],
        ['A25E', [5, 10], false],
        ['CE', [10, 10], false],
        ['SHOT', [15, 5], false],
        ['GOAL', [15, 5], false]
    ]),
    { id: 'pc', label: 'PC', team: 'none', colorClass: 'btn-green', lead: 2, lag: 10 },
    { id: 'special', label: 'SPECIAL', team: 'none', colorClass: 'btn-blue', lead: 5, lag: 5 }
];

const VIDEO_ZONES = { values: ['1', '2', '3', '4'], default: '1', perspective: 'mirrored' };

const DEFAULT_QUICK_TAGS = VIDEO_STRIP;
const CORE_QUICK_TAGS = VIDEO_STRIP;

// Sport-standard lead/lag pre-roll and post-roll clip timings (seconds) from MyVA scheme
const CLIP_KEYWORDS = [
    [['GOAL', 'SHOT'], { lead: 15, lag: 5 }],
    [['CIRCLE ENTRY', 'ENTRY', 'CE'], { lead: 10, lag: 10 }],
    [['PENALTY CORNER', 'CORNER', 'PC', 'PCA', 'SO'], { lead: 2, lag: 10 }],
    [['GREEN'], { lead: 20, lag: 130 }],
    [['YELLOW'], { lead: 20, lag: 360 }],
    [['START', 'END'], { lead: 1, lag: 1 }],
    [['UMP'], { lead: 7, lag: 7 }],
    [['A25E', 'OH'], { lead: 5, lag: 10 }], [['ASC', 'APS'], { lead: 10, lag: 1 }], [['PS'], { lead: 3, lag: 2 }], [['BS'], { lead: 10, lag: 10 }]
];

function getDefaultClipTimings(label) {
    if (!label || typeof label !== 'string') return { lead: 5, lag: 5 };
    const upper = label.trim().toUpperCase();
    const match = CLIP_KEYWORDS.find(([keys]) => keys.some(k => upper === k || upper.includes(k)));
    return match ? match[1] : { lead: 5, lag: 5 };
}

const LOCAL_STORAGE_KEY_GAMES = 'fieldHockeyGames_v1';
let videoChordEngine = null;

function attachEventLabel(event, label) {
    if (!Array.isArray(event.labels)) event.labels = [];
    event.labels.push(label);
}

function refreshTimelineForUpdatedEvent(ev) {
    if (isTimelineCollapsed) {
        timelineNeedsRender = true;
        updateFilterToggleUI();
        return;
    }
    if (!replaceTimelineEventCardInPlace(ev)) {
        renderTimelineEvents();
        return;
    }
    updateFilterToggleUI();
}

function updateGameEventLabels(game, eventId, labels) {
    const ev = game?.events?.find(e => e.id === eventId);
    if (!ev) return;
    ev.labels = labels;
    invalidateUnlabelledCountCache();
    saveGame(game.id, game.events, { ...game.metadata, ...(game.teams && { teams: game.teams }) });
    timelineEvents = game.events;
    refreshTimelineForUpdatedEvent(ev);
    updateQuickTagTicker(game);
}

function handleChordResolved({ event, label }) {
    if (!label || !currentGameId) return;
    attachEventLabel(event, label);
    const savedGames = getSavedGames();
    const { game } = findGameById(savedGames, currentGameId);
    updateGameEventLabels(game, event.id, event.labels);
}

function initVideoChordEngine() {
    if (videoChordEngine) return;
    videoChordEngine = bindChordDock({
        dockElement: document.getElementById('video-chord-dock'),
        badgeElement: document.getElementById('video-chord-badge'),
        promptElement: document.getElementById('video-chord-prompt'),
        countdownElement: document.getElementById('video-chord-countdown'),
        progressBarElement: document.getElementById('video-chord-progress'),
        pillsContainer: document.getElementById('video-chord-pills'),
        decayDuration: 1500,
        pillClass: 'chord-action-pill px-3 py-1.5 rounded bg-slate-800 hover:bg-blue-600 text-white font-bold text-xs border border-slate-700 flex items-center gap-1.5 transition active:scale-95',
        keyClass: 'text-[10px] opacity-75 font-mono',
        onResolved: handleChordResolved
    });
}

let currentGameId = null;
let timelineEvents = [];
let activeTypeFilters = new Set();
let favoritesOnly = false;
let filterViewMode = 'all'; // 'all' | 'favorites' | 'unlabelled'
let activePlaylistId = FAVORITES_PLAYLIST_ID;
let presentationModeActive = false;
const presentationController = new PresentationController();

let sweepModeActive = false;
let currentSweepIndex = 0;
let sweepEvents = [];
let isTaggingMode = false;
let activeVideoZone = '1';

function videoZoneConfig() {
    return {
        values: VIDEO_ZONES.values.slice(),
        default: VIDEO_ZONES.default,
        perspective: VIDEO_ZONES.perspective
    };
}

function videoZoneValues() {
    return videoZoneConfig().values;
}

function normalizeVideoZone(zone) {
    const { values, default: fallback } = videoZoneConfig();
    const value = String(zone ?? '');
    return values.includes(value) ? value : fallback;
}

function prepareZoneAwareLabel(label, zoned) {
    const trimmed = String(label ?? '').trim();
    if (!trimmed || !zoned) return trimmed;
    return stripTrailingZoneDigit(trimmed, videoZoneValues());
}

function codeLabelForTag(tag) {
    const stem = String(tag?.label ?? '').trim();
    if (!tag?.zoned) return stem;
    const zone = normalizeVideoZone(activeVideoZone);
    const slot = tag.team === 'team2' ? 2 : 1;
    return appendZoneSuffix(stem, zoneForTeam(zone, slot, videoZoneConfig()));
}
let currentPlaylistIndex = 0;
let favoriteEvents = [];
let activeEditingEventId = null;
let currentDraftGame = null;

// Helper to generate a unique event id
function generateEventId() {
    return 'evt-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
}

function getCurrentGame() {
    if (currentDraftGame && currentDraftGame.id === currentGameId) {
        return currentDraftGame;
    }
    const games = getSavedGames();
    if (!Array.isArray(games) || !currentGameId) return null;
    return games.find(g => g.id === currentGameId) || null;
}

// Utility: Format milliseconds or seconds as mm:ss
function formatTime(input) {
    let seconds = typeof input === 'number' ? input : 0;
    if (seconds > 10000) seconds = Math.floor(seconds / 1000); // treat as ms if large
    if (isNaN(seconds)) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function parseColonTime(parts) {
    if (parts.length !== 2) return null;
    const [m, s] = parts;
    if (Number.isNaN(m) || Number.isNaN(s)) return null;
    return m * 60 + s;
}

function parseSingleNumber(str) {
    const num = Number(str);
    return Number.isNaN(num) ? 0 : num;
}

function isValidTimeString(str) {
    return Boolean(str && typeof str === 'string');
}

// Utility: Parse mm:ss to seconds
function parseTime(str) {
    if (!isValidTimeString(str)) return 0;
    const colonResult = parseColonTime(str.split(':').map(Number));
    return colonResult !== null ? colonResult : parseSingleNumber(str);
}

// Update Match Title in UI and edit forms
function updateTitleUI(title) {
    const gameTitle = document.getElementById('review-game-title');
    const editBtn = document.getElementById('edit-title-btn');
    const input = document.getElementById('inline-title-input');

    if (gameTitle) {
        gameTitle.textContent = title;
        gameTitle.title = 'Click to rename match';
        gameTitle.classList.remove('hidden');
    }
    if (editBtn) {
        editBtn.classList.remove('hidden');
    }
    if (input) {
        input.value = title;
    }
}

// Update Draft badge and Auto-Save Status Indicator
function updateSaveStatusUI() {
    const draftBadge = document.getElementById('draft-badge');
    const statusIndicator = document.getElementById('save-status-indicator');
    const isDraft = Boolean(currentDraftGame && currentDraftGame.id === currentGameId);

    if (draftBadge) {
        draftBadge.classList.toggle('hidden', !isDraft);
    }
    if (statusIndicator) {
        if (isDraft) {
            statusIndicator.innerHTML = '<span class="text-amber-700"><i class="fas fa-pencil-alt text-amber-500 mr-1"></i>Draft (not saved)</span>';
            statusIndicator.classList.remove('hidden');
            statusIndicator.classList.add('inline-flex');
        } else if (currentGameId) {
            statusIndicator.innerHTML = '<span class="text-slate-600"><i class="fas fa-check-circle text-emerald-600 mr-1"></i>Saved</span>';
            statusIndicator.classList.remove('hidden');
            statusIndicator.classList.add('inline-flex');
        } else {
            statusIndicator.classList.add('hidden');
            statusIndicator.classList.remove('inline-flex');
        }
    }
}

let timelineCloudSyncTimer = null;

function scheduleTimelineCloudSync(gameId) {
    if (!gameId) return;
    cloudSyncService.markGameDirty(gameId);
    if (timelineCloudSyncTimer) clearTimeout(timelineCloudSyncTimer);
    timelineCloudSyncTimer = setTimeout(() => {
        timelineCloudSyncTimer = null;
        cloudSyncService.syncIfConnected().catch(() => {});
    }, 3000);
}

// Commit draft game session to persistent storage (prevents saved game spam)
function commitDraftGame() {
    if (currentDraftGame && currentDraftGame.id === currentGameId) {
        currentDraftGame.metadata.isDraft = false;
        currentDraftGame.metadata.lastUpdated = new Date().toISOString();
        const savedGames = getSavedGames();
        const existingIdx = savedGames.findIndex(g => g.id === currentDraftGame.id);
        if (existingIdx >= 0) {
            savedGames[existingIdx] = currentDraftGame;
        } else {
            savedGames.unshift(currentDraftGame);
        }
        storageService.setItem(LOCAL_STORAGE_KEY_GAMES, savedGames);
        invalidateSavedGamesCache();
        const committed = currentDraftGame;
        currentDraftGame = null;
        scheduleTimelineCloudSync(committed.id);
        updateSaveStatusUI();
        showNotification('Match saved to Matches');
        return committed;
    }
    return getCurrentGame();
}

// Rename match title in memory and storage
function freezeMatchTeams(game) {
    if (!game.metadata) game.metadata = {};
    if (Array.isArray(game.metadata.teamsData) && game.metadata.teamsData.length === 2) return;
    const pair = getMatchTeams(game).map(team => ({ code: team.code, color: team.color }));
    game.metadata.teamsData = pair;
    game.metadata.teamCodes = pair.map(team => team.code);
    game.metadata.teamColors = pair.map(team => team.color);
}

function renameMatch(newName) {
    const trimmed = String(newName || '').trim();
    if (!trimmed) return false;

    const game = getCurrentGame();
    if (!game) return false;

    freezeMatchTeams(game);
    game.teams = trimmed;
    if (currentDraftGame && currentDraftGame.id === game.id) {
        currentDraftGame.teams = trimmed;
        commitDraftGame();
    } else {
        const metadata = { ...game.metadata, teams: trimmed, lastUpdated: new Date().toISOString() };
        saveGame(game.id, game.events, metadata);
    }

    updateTitleUI(trimmed);
    return true;
}

// Auto-rename from video file name if title is currently generic
function autoRenameFromVideo(filename) {
    if (!filename || typeof filename !== 'string') return;
    const game = getCurrentGame();
    if (!game) return;

    const isDefaultTitle = !game.teams ||
        game.teams.startsWith('Video Match') ||
        game.teams === 'Video Match';

    if (isDefaultTitle) {
        const cleanName = filename
            .replace(/\.[^/.]+$/, '')
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (cleanName) {
            renameMatch(cleanName);
        }
    }
}

function draftHasVideo(metadata) {
    return Boolean(metadata && metadata.hasVideo);
}

function draftHasEvents(events) {
    return Array.isArray(events) && events.length > 0;
}

function draftHasContent(draft) {
    if (!draft) return false;
    return draftHasEvents(draft.events) || draftHasVideo(draft.metadata);
}

function shouldCommitDraftOnExit(draft, activeGameId) {
    if (!draft || draft.id !== activeGameId) return false;
    return draftHasContent(draft);
}

// Save & Exit to Saved Games
function saveAndExit() {
    if (shouldCommitDraftOnExit(currentDraftGame, currentGameId)) {
        commitDraftGame();
    }
    if (timelineCloudSyncTimer) {
        clearTimeout(timelineCloudSyncTimer);
        timelineCloudSyncTimer = null;
    }
    if (typeof window !== 'undefined') {
        window.location.href = 'index.html#saved-games';
    }
}

// Auto-create or initialize a new video match draft (not saved until event or video is added)
function teamTitle(teams) {
    return `${teams[0].code} vs ${teams[1].code}`;
}

function trimmedText(value) {
    if (typeof value !== 'string') return '';
    return value.trim();
}

function matchTitleFromGame(game, fallback = '') {
    const record = game || {};
    const fromTeams = trimmedText(record.teams);
    if (fromTeams) return fromTeams;
    const fromName = trimmedText(record.name);
    if (fromName) return fromName;
    const pair = normalizeMatchTeams(record.teams);
    if (pair) return teamTitle(pair);
    return fallback;
}

function normalizeMatchTeams(teams) {
    if (!Array.isArray(teams) || teams.length !== 2) return null;
    return [
        { code: String(teams[0].code || 'TEAM1').trim().toUpperCase(), color: teams[0].color || 'red' },
        { code: String(teams[1].code || 'TEAM2').trim().toUpperCase(), color: teams[1].color || 'yellow' }
    ];
}

function createNewVideoGame(customName, teams = null) {
    const gameId = generateGameId();
    const now = new Date();
    const dateStr = now.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const pair = normalizeMatchTeams(teams);
    const title = customName || (pair ? teamTitle(pair) : `Video Match — ${dateStr}`);
    const newGame = {
        id: gameId,
        events: [],
        teams: title,
        timestamp: now.toISOString(),
        metadata: {
            source: 'video',
            isDraft: true,
            created: now.toISOString(),
            lastUpdated: now.toISOString(),
            ...(pair && {
                teamsData: pair,
                teamCodes: pair.map(team => team.code),
                teamColors: pair.map(team => team.color)
            })
        }
    };

    currentDraftGame = newGame;
    currentGameId = gameId;
    activeVideoZone = normalizeVideoZone(null);
    timelineEvents = [];

    if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
        try {
            const url = new URL(window.location.href);
            url.searchParams.set('game', gameId);
            url.searchParams.delete('new');
            window.history.replaceState({}, '', url.toString());
        } catch (_) {}
    }

    const noGameState = document.getElementById('no-game-selected-state');
    if (noGameState) noGameState.classList.add('hidden');

    updateTitleUI(title);
    updateSaveStatusUI();
    timelineNeedsRender = false;
    updateEventFilters();
    renderTimelineEvents();
    updateQuickTagTicker();
    setTimelineCollapsed(true);
    setTaggingMode(true);
    updateTeamsControl();

    return newGame;
}

// fallow-ignore-next-line complexity
function resolveQuickTagInfo(eventType, game = null) {
    let eventLabel = typeof eventType === 'string' ? eventType : (eventType && eventType.label);
    let isTeam1 = null;
    let lead = (typeof eventType === 'object' && eventType) ? eventType.lead : undefined;
    let lag = (typeof eventType === 'object' && eventType) ? eventType.lag : undefined;
    const teams = getMatchTeams(game);

    if (typeof eventType === 'object' && eventType !== null) {
        const resolved = resolveTagDisplay(eventType, teams);
        eventLabel = resolved.displayLabel;
        isTeam1 = resolved.isTeam1;
    } else if (typeof eventType === 'string') {
        const tags = loadQuickTags();
        const match = tags.find(t => t.label === eventType || resolveTagDisplay(t, teams).displayLabel === eventType);
        if (match) {
            const resolved = resolveTagDisplay(match, teams);
            eventLabel = resolved.displayLabel;
            isTeam1 = resolved.isTeam1;
            if (lead === undefined) lead = match.lead;
            if (lag === undefined) lag = match.lag;
        }
    }

    const defaultTimings = getDefaultClipTimings(eventLabel);
    return {
        eventLabel,
        isTeam1,
        lead: (lead !== undefined && Number.isFinite(Number(lead))) ? Number(lead) : defaultTimings.lead,
        lag: (lag !== undefined && Number.isFinite(Number(lag))) ? Number(lag) : defaultTimings.lag
    };
}

// Quick-tag an event at the current video playhead (1-tap, non-blocking)
function quickTagEvent(eventType, note = '') {
    const video = document.getElementById('video-player');
    const sec = video ? (video.currentTime || 0) : 0;
    const timeMs = Math.round(sec * 1000);
    const ts = formatTime(sec);

    let game = getCurrentGame() || createNewVideoGame();
    if (currentDraftGame && currentDraftGame.id === game.id) {
        commitDraftGame();
        game = getCurrentGame();
    }

    const { eventLabel, isTeam1, lead, lag } = resolveQuickTagInfo(eventType, game);

    if (!Array.isArray(game.events)) game.events = [];
    const newEvent = {
        id: generateEventId(),
        event: eventLabel,
        note,
        timestamp: ts,
        timeMs,
        lead,
        lag,
        ...(isTeam1 !== null && { isTeam1 }),
        isFavorite: false
    };
    game.events.push(newEvent);

    persistGameEventsAndRefresh(game, {}, { insertedEvent: newEvent });
    updateQuickTagTicker(game);
    showQuickTagFeedback(eventType, ts);
    if (!isTimelineCollapsed) {
        highlightTimelineEvent(newEvent.id, { scroll: false });
    }
    if (videoChordEngine) videoChordEngine.startChord(newEvent);

    return newEvent;
}

// Update note for slow analysis pass
function updateEventNote(eventId, note) {
    const { game, event } = findEventInCurrentGame(eventId);
    if (!game || !event) return false;

    event.note = String(note || '').trim();
    const metadata = { ...game.metadata, teams: game.teams };
    saveGame(game.id, game.events, metadata);
    timelineEvents = game.events;
    renderTimelineEvents();
    return true;
}

// Nudge or retarget event timestamp
function retargetEventTime(eventId, timeSeconds) {
    const { game, event } = findEventInCurrentGame(eventId);
    if (!game || !event) return false;

    const clampedSec = Math.max(0, timeSeconds);
    event.timeMs = Math.round(clampedSec * 1000);
    event.timestamp = formatTime(clampedSec);

    const metadata = { ...game.metadata, teams: game.teams };
    saveGame(game.id, game.events, metadata);
    timelineEvents = game.events;
    renderTimelineEvents();
    return true;
}

// Screen-reader status announcement (visually hidden via .sr-only to avoid vertical layout shifts)
function showQuickTagFeedback(eventType, timestamp) {
    const feedback = document.getElementById('quick-tag-feedback');
    if (!feedback) return;
    feedback.textContent = `Tagged ${formatEventTypeName(eventType)} at ${timestamp}`;
}

// Adjust video playback speed
function setPlaybackRate(rate) {
    const video = document.getElementById('video-player');
    if (video) {
        video.playbackRate = rate;
    }
    const buttons = document.querySelectorAll('[data-speed]');
    buttons.forEach(btn => {
        const btnSpeed = parseFloat(btn.getAttribute('data-speed'));
        const isActive = btnSpeed === rate;
        btn.classList.toggle('is-active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
}

// Precision seek
function seekRelative(seconds) {
    const video = document.getElementById('video-player');
    if (video && video.readyState > 0) {
        video.currentTime = Math.max(0, video.currentTime + seconds);
    }
}

function parseTeamsFromString(teamsStr) {
    if (typeof teamsStr !== 'string') return null;
    const parts = teamsStr.split(/\s+(?:vs\.?|v)\s+/i);
    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) return null;
    const cleanCode = (str) => {
        const words = str.trim().split(/\s+/);
        const code = words[words.length - 1].toUpperCase().replace(/[^A-Z0-9]/g, '');
        return code || 'TEAM';
    };
    let last = [];
    try { last = loadLastTeams(); } catch (_) {}
    return [
        { code: cleanCode(parts[0]), color: last?.[0]?.color || 'red' },
        { code: cleanCode(parts[1]), color: last?.[1]?.color || 'yellow' }
    ];
}

// Get current match teams (team1, team2) with code and color
// Extract match teams from game metadata if present
function getTeamsFromMetadata(meta) {
    const teams = meta?.teamsData;
    if (Array.isArray(teams) && teams.length === 2) return teams;
    const codes = meta?.teamCodes;
    if (Array.isArray(codes) && codes.length >= 2) {
        const colors = meta.teamColors || ['red', 'yellow'];
        return [
            { code: codes[0], color: colors[0] || 'red' },
            { code: codes[1], color: colors[1] || 'yellow' }
        ];
    }
    return null;
}

// Get current match teams (team1, team2) with code and color
function getMatchTeams(providedGame = null) {
    const game = providedGame || getCurrentGame();
    const fromMeta = getTeamsFromMetadata(game?.metadata);
    if (fromMeta) return fromMeta;

    const fromString = parseTeamsFromString(game?.teams);
    if (fromString) return fromString;

    try {
        const last = loadLastTeams();
        if (Array.isArray(last) && last.length === 2) return last;
    } catch (_) {}
    return DEFAULT_TEAMS.map(t => ({ ...t }));
}
// Persist match teams on game metadata and last teams
function setMatchTeams(teams) {
    const normalized = normalizeMatchTeams(teams);
    if (!normalized) return null;

    try {
        saveLastTeams(normalized);
    } catch (_) {}

    const game = getCurrentGame();
    if (game) {
        if (!game.metadata) game.metadata = {};
        game.metadata.teamsData = normalized;
        game.metadata.teamCodes = normalized.map(t => t.code);
        game.metadata.teamColors = normalized.map(t => t.color);
        const isUncommittedDraft = currentDraftGame && currentDraftGame.id === game.id;
        if (!isUncommittedDraft) {
            saveGame(game.id, game.events, game.metadata);
        }
    }

    renderQuickTagButtons();
    updateTeamsControl();
    return normalized;
}

function canEditMatchTeams(game = getCurrentGame()) {
    if (!game) return false;
    return !Array.isArray(game.events) || game.events.length === 0;
}

function updateTeamsControl() {
    const button = document.getElementById('edit-match-teams-btn');
    if (!button) return;
    button.classList.toggle('hidden', !canEditMatchTeams());
}

function applyConfirmedTeams(teams) {
    if (!canEditMatchTeams()) return false;
    const applied = setMatchTeams(teams);
    if (!applied) return false;
    const game = getCurrentGame();
    if (game) {
        const nextTitle = teamTitle(applied);
        game.teams = nextTitle;
        if (currentDraftGame && currentDraftGame.id === game.id) {
            currentDraftGame.teams = nextTitle;
        }
        updateTitleUI(nextTitle);
    }
    return true;
}

async function requestConfirmedTeams() {
    try {
        return await openTeamSetupDialog(loadLastTeams());
    } catch (_) {
        return null;
    }
}

function rememberConfirmedTeams(teams) {
    try {
        saveLastTeams(teams);
    } catch (_) {}
}

async function startNewVideoMatch() {
    const teams = await requestConfirmedTeams();
    if (!teams) {
        if (!currentGameId) showNoGameSelectedState();
        return null;
    }
    rememberConfirmedTeams(teams);
    return createNewVideoGame(null, teams);
}

// Swap Team 1 and Team 2 codes and colors
function swapMatchTeams() {
    const current = getMatchTeams();
    const swapped = [current[1], current[0]];
    return setMatchTeams(swapped);
}

// Dynamically resolve tag display label, color class, and team affiliation
function resolveTagDisplay(tag, teams = null) {
    const matchTeams = teams || getMatchTeams();
    const team1 = matchTeams[0] || { code: 'T1', color: 'red' };
    const team2 = matchTeams[1] || { code: 'T2', color: 'yellow' };

    const codeLabel = codeLabelForTag(tag);

    if (tag.team === 'team1') {
        const colorClass = `team-color-${team1.color || 'red'}`;
        return {
            displayLabel: `${team1.code} ${codeLabel}`,
            codeLabel,
            baseLabel: tag.label,
            colorClass,
            isTeam1: true,
            team: 'team1'
        };
    } else if (tag.team === 'team2') {
        const colorClass = `team-color-${team2.color || 'yellow'}`;
        return {
            displayLabel: `${team2.code} ${codeLabel}`,
            codeLabel,
            baseLabel: tag.label,
            colorClass,
            isTeam1: false,
            team: 'team2'
        };
    } else {
        return {
            displayLabel: codeLabel,
            codeLabel,
            baseLabel: tag.label,
            colorClass: tag.colorClass || 'btn-blue',
            isTeam1: null,
            team: 'none'
        };
    }
}

function loadQuickTags() {
    return VIDEO_STRIP.map((tag, index) => ({
        ...tag,
        key: index < 9 ? String(index + 1) : ''
    }));
}

// 1-Tap Undo for last logged event during video tagging
function undoLastQuickTag() {
    if (videoChordEngine) videoChordEngine.cancel();
    if (!currentGameId) return false;
    const savedGames = getSavedGames();
    const { game } = findGameById(savedGames, currentGameId);
    if (!game || !Array.isArray(game.events) || game.events.length === 0) return false;

    const removedEvent = game.events.pop();
    persistGameEventsAndRefresh(game, {}, { removedEventId: removedEvent.id });
    updateQuickTagTicker();
    showNotification(`Undid ${formatEventTypeName(removedEvent.event)}`, 'info');
    return true;
}

function syncTimelineCounters(count) {
    const text = String(count);
    setElementText('ticker-event-count', text);
    setElementText('timeline-events-counter', text);
    if (isTimelineCollapsed) {
        setElementText('quick-tag-review-label', `Events Panel (${text}) ▾`);
    }
}

function setUndoButtonDisabled(undoBtn, disabled) {
    if (!undoBtn) return;
    undoBtn.disabled = disabled;
    undoBtn.classList.toggle('opacity-40', disabled);
}

// Update Focus Tagging Ticker (Last event + Undo status + Event count)
function updateQuickTagTicker(providedGame = null) {
    const tickerLast = document.getElementById('ticker-last-event');
    const undoBtn = document.getElementById('quick-tag-undo-btn');
    const game = providedGame || getCurrentGame();
    const events = Array.isArray(game?.events) ? game.events : [];

    syncTimelineCounters(events.length);

    updateTeamsControl();

    if (!events.length) {
        if (tickerLast) tickerLast.textContent = 'No events logged yet';
        setUndoButtonDisabled(undoBtn, true);
        return;
    }

    const last = events[events.length - 1];
    if (tickerLast) {
        const labelText = last.labels?.length ? ` [${last.labels.map(l => l.text).join(', ')}]` : '';
        tickerLast.textContent = `${formatEventTypeName(last.event)}${labelText} (${last.timestamp || formatTime(last.timeMs)})`;
    }
    setUndoButtonDisabled(undoBtn, false);
}

let isTimelineCollapsed = false;
let timelineNeedsRender = false;

// Collapse or expand the events side panel
function setTimelineCollapsed(collapsed) {
    isTimelineCollapsed = Boolean(collapsed);
    const layout = document.querySelector('.review-layout');
    const label = document.getElementById('quick-tag-review-label');
    const countSpan = document.getElementById('ticker-event-count');
    const count = countSpan ? countSpan.textContent : '0';

    if (layout) {
        layout.classList.toggle('timeline-collapsed', isTimelineCollapsed);
    }
    if (label) {
        label.textContent = isTimelineCollapsed
            ? `Events Panel (${count}) ▾`
            : `Hide Events ▴`;
    }
    if (!isTimelineCollapsed && timelineNeedsRender) {
        timelineNeedsRender = false;
        updateEventFilters();
        renderTimelineEvents();
    }
    return isTimelineCollapsed;
}

// Toggle Tagging Mode (Focus video + quick tags bar vs clean Review Mode)
function setTaggingMode(enabled) {
    isTaggingMode = Boolean(enabled);
    const layout = document.querySelector('.review-layout');
    const panel = document.getElementById('video-coding-panel');
    if (layout) {
        layout.classList.toggle('tagging-mode-active', isTaggingMode);
    }
    if (panel) {
        panel.classList.toggle('hidden', !isTaggingMode);
    }
    updateFabVisibility();

    if (isTaggingMode) {
        setTimelineCollapsed(true);
        renderQuickTagButtons();
        updateQuickTagTicker();
    } else {
        setTimelineCollapsed(false);
    }
    return isTaggingMode;
}

function renderQuickTagButtons() {
    const container = document.getElementById('quick-tags-container');
    const hintSpan = document.getElementById('quick-tag-hint');
    if (!container) return;
    container.innerHTML = '';

    const tags = loadQuickTags();
    const teams = getMatchTeams();
    if (hintSpan) {
        hintSpan.textContent = `(Tap or press 1–${Math.min(tags.length, 9)} during playback)`;
    }

    tags.forEach((tag, index) => {
        const btn = createQuickTagElement(tag, index, tags.length, {
            isEditing: false,
            teams,
            resolveTagDisplay,
            onTagClick: (t) => quickTagEvent(t)
        });
        container.appendChild(btn);
    });

    renderVideoZoneBar();
}

function renderVideoZoneBar() {
    const bar = document.getElementById('video-zone-bar');
    const grid = document.getElementById('video-zone-buttons');
    if (!bar || !grid) return;

    const tags = loadQuickTags();
    const show = tags.some(tag => tag.zoned);
    bar.classList.toggle('hidden', !show);
    grid.innerHTML = '';
    if (!show) return;

    const zones = videoZoneConfig();
    const zone = normalizeVideoZone(activeVideoZone);
    activeVideoZone = zone;
    const team2 = getMatchTeams()[1];
    const mirrored = zones.perspective === 'mirrored';

    zones.values.forEach(value => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'zone-button';
        button.dataset.zone = value;
        const main = document.createElement('span');
        main.textContent = `Zone ${value}`;
        button.appendChild(main);
        if (mirrored && team2) {
            const mirror = document.createElement('span');
            mirror.className = 'zone-button-mirror';
            mirror.textContent = `${team2.code} ${zoneForTeam(value, 2, zones)}`;
            button.appendChild(mirror);
        }
        const isActive = value === zone;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
        button.addEventListener('click', (event) => {
            event.preventDefault();
            selectVideoZone(value);
        });
        grid.appendChild(button);
    });
}

function selectVideoZone(zone) {
    const next = String(zone ?? '');
    if (!videoZoneValues().includes(next)) return false;
    activeVideoZone = next;

    const game = getCurrentGame();
    if (game) {
        if (!game.metadata) game.metadata = {};
        game.metadata.activeZone = next;
        const savedGames = getSavedGames();
        const { game: existing } = findGameById(savedGames, game.id);
        if (existing) {
            saveGame(game.id, Array.isArray(game.events) ? game.events : [], {
                ...(existing.metadata || {}),
                ...(game.metadata || {}),
                activeZone: next
            });
        }
    }

    renderQuickTagButtons();
    return true;
}

function isTextInputElement(target) {
    return Boolean(target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable));
}

function handleChordNavigation(e, chordEngine) {
    if (!chordEngine || !chordEngine.isListening()) return false;
    if (['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        chordEngine.selectOption(e.key);
        return true;
    }
    if (e.key === 'Escape') {
        e.preventDefault();
        chordEngine.cancel();
        return true;
    }
    return false;
}

function toggleVideoPlayback(video) {
    if (!video) return;
    if (video.paused) {
        const playPromise = video.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => {});
        }
    } else {
        video.pause();
    }
}

function handleVideoPlaybackShortcut(e, video) {
    if (e.code === 'Space' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        toggleVideoPlayback(video);
        return true;
    }
    const seekOffsets = {
        ArrowLeft: -5,
        ArrowRight: 5,
        j: -10,
        J: -10,
        l: 10,
        L: 10
    };
    const offset = seekOffsets[e.key];
    if (offset !== undefined) {
        if (e.key.startsWith('Arrow')) e.preventDefault();
        seekRelative(offset);
        return true;
    }
    return false;
}

// Keyboard navigation and hotkey coding
function handleVideoCodingKey(e) {
    if (isTextInputElement(e.target)) return;

    const video = document.getElementById('video-player');
    if (!video) return;

    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        undoLastQuickTag();
        return;
    }

    if (handleChordNavigation(e, videoChordEngine)) return;
    if (handleVideoPlaybackShortcut(e, video)) return;

    const keyNum = parseInt(e.key, 10);
    const tags = loadQuickTags();
    if (keyNum >= 1 && keyNum <= tags.length) {
        e.preventDefault();
        const tagDef = tags[keyNum - 1];
        if (tagDef) {
            quickTagEvent(tagDef);
        }
    }
}

function initKeyboardShortcuts() {
    document.addEventListener('keydown', handleVideoCodingKey);
}

function pauseVideoIfPlaying(video) {
    if (video && !video.paused) {
        video.pause();
    }
}

function syncVideoTimestampToInput(video, timestampInput) {
    if (timestampInput && video) {
        timestampInput.value = formatTime(video.currentTime);
    }
}

function focusModalInitialInput(form) {
    const firstInput = form?.querySelector('input:not([readonly])');
    if (firstInput) firstInput.focus();
}

function openAddEventModal(modal, form, video, timestampInput) {
    pauseVideoIfPlaying(video);
    syncVideoTimestampToInput(video, timestampInput);
    modal?.classList.remove('hidden');
    setTimeout(() => focusModalInitialInput(form), 100);
}

function extractEventFormData(form, timestampInput) {
    return {
        event: form['event-type'].value.trim(),
        note: form['event-note'].value.trim(),
        timestamp: timestampInput ? timestampInput.value : '00:00',
        id: generateEventId()
    };
}

function handleAddEventSubmit(e, form, timestampInput, closeModal) {
    e.preventDefault();
    const eventData = extractEventFormData(form, timestampInput);
    eventData.timeMs = parseTime(eventData.timestamp) * 1000;

    const game = getCurrentGame() || createNewVideoGame();
    if (!Array.isArray(game.events)) {
        game.events = [];
    }
    game.events.push(eventData);

    persistGameEventsAndRefresh(game);
    closeModal();
}

function setupAddEventModal() {
    const modal = document.getElementById('add-event-modal');
    const form = document.getElementById('add-event-form');
    if (!modal || !form) return;

    const fab = document.getElementById('add-event-fab');
    const closeBtn = document.getElementById('close-add-event-modal');
    const cancelBtn = document.getElementById('cancel-add-event');
    const timestampInput = document.getElementById('event-timestamp');
    const video = document.getElementById('video-player');

    const closeModal = () => {
        modal.classList.add('hidden');
        form.reset();
    };

    fab?.addEventListener('click', (e) => {
        e.preventDefault();
        openAddEventModal(modal, form, video, timestampInput);
    });

    [closeBtn, cancelBtn].forEach(btn => btn?.addEventListener('click', closeModal));

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeModal();
        }
    });

    form.addEventListener('submit', (e) => handleAddEventSubmit(e, form, timestampInput, closeModal));
    updateFavoritesToggleUI();
}

// --- FAB and Add Event Modal Logic ---
document.addEventListener('DOMContentLoaded', () => {
    initVideoChordEngine();
    setupAddEventModal();
});

// Helper: normalize whatever is stored into an array of game objects
// Returns an object { games, changed } where changed=true if we assigned ids or converted shape
function normalizeSavedGamesToArray(raw) {
    if (!raw) return { games: [], changed: false };
    // If it's already an array, ensure each entry has an id
    if (Array.isArray(raw)) {
        let changed = false;
        const mapped = raw.map(entry => {
            if (!entry) return entry;
            if (!entry.id) {
                entry.id = generateGameId();
                changed = true;
            }
            return entry;
        });
        return { games: mapped, changed };
    }
    // If it's an object keyed by id, map to array
    if (typeof raw === 'object') {
        try {
            const mapped = Object.keys(raw).map(id => {
                const entry = raw[id] || {};
                // ensure id property exists on the entry as well
                if (!entry.id) entry.id = id;
                return { id, ...entry };
            });
            return { games: mapped, changed: true };
        } catch (e) {
            console.warn('Could not normalize saved games object to array', e);
            return { games: [], changed: false };
        }
    }
    return { games: [], changed: false };
}

function findEventInCurrentGame(eventId) {
    if (!currentGameId) return { game: null, event: null };
    const savedGames = getSavedGames();
    const { game } = findGameById(savedGames, currentGameId);
    if (!game || !Array.isArray(game.events)) return { game: null, event: null };
    const event = game.events.find(e => e.id === eventId);
    return { game, event };
}

function isEventVisibleInCurrentFilter(event) {
    const matchesType = activeTypeFilters.size === 0 || activeTypeFilters.has(event.event);
    if (!matchesType) return false;
    if (filterViewMode === 'favorites') {
        const game = getCurrentGame() || { events: timelineEvents, metadata: {} };
        return isEventInPlaylist(game, activePlaylistId, event);
    }
    if (filterViewMode === 'unlabelled') {
        const schema = getLabelSchemaForEvent(event);
        if (!schema) return false;
        return !Array.isArray(event.labels) || event.labels.length === 0;
    }
    return true;
}

function hasFilterOptionForType(eventType) {
    if (!eventType) return true;
    const container = document.getElementById('filter-options-container');
    if (!container) return true;
    return Array.from(container.querySelectorAll('.filter-checkbox')).some(
        cb => cb.getAttribute('data-filter') === eventType
    );
}

function findNextTimelineCard(timelineContainer, newTime) {
    const lastCard = timelineContainer.lastElementChild;
    if (!lastCard || newTime >= (Number(lastCard.dataset.timeMs) || 0)) return null;
    const existingCards = timelineContainer.querySelectorAll('.timeline-event');
    return Array.from(existingCards).find(el => (Number(el.dataset.timeMs) || 0) > newTime) || null;
}

function insertTimelineEventCardIncremental(newEvent) {
    const timelineContainer = document.getElementById('timeline-events');
    if (!timelineContainer || timelineNeedsRender || !timelineContainer.firstElementChild) return false;

    if (!hasFilterOptionForType(newEvent.event)) {
        updateEventFilters();
    } else {
        syncFilterUI();
    }

    if (isEventVisibleInCurrentFilter(newEvent)) {
        const card = createTimelineEventCard(newEvent, timelineEvents.length - 1);
        const nextCard = findNextTimelineCard(timelineContainer, Number(newEvent.timeMs) || 0);
        if (nextCard) {
            timelineContainer.insertBefore(card, nextCard);
        } else {
            timelineContainer.appendChild(card);
        }
    }

    updateFilterToggleUI();
    return true;
}

function removeTimelineEventCardIncremental(removedEventId) {
    if (!removedEventId || timelineNeedsRender || timelineEvents.length === 0) return false;
    const card = document.querySelector(`#timeline-events .timeline-event[data-event-id="${removedEventId}"]`);
    if (!card) return false;
    card.remove();
    syncFilterUI();
    updateFilterToggleUI();
    return true;
}

function replaceTimelineEventCardInPlace(event) {
    if (filterViewMode !== 'all' || timelineNeedsRender) return false;
    const existing = document.querySelector(`#timeline-events .timeline-event[data-event-id="${event.id}"]`);
    if (!existing) return false;
    existing.replaceWith(createTimelineEventCard(event, Math.max(0, timelineEvents.indexOf(event))));
    return true;
}

function canSkipFullTimelineRefresh(options) {
    if (options.insertedEvent && insertTimelineEventCardIncremental(options.insertedEvent)) return true;
    return Boolean(options.removedEventId && removeTimelineEventCardIncremental(options.removedEventId));
}

function persistGameEventsAndRefresh(game, metadata = {}, options = {}) {
    const meta = (game && game.metadata) ? { ...game.metadata, ...metadata } : { ...metadata };
    if (game && game.teams) {
        meta.teams = game.teams;
    }
    saveGame(game.id, game.events, meta);

    syncUnlabelledCacheForMutation(game.events, options);
    timelineEvents = game.events;
    if (isTimelineCollapsed) {
        timelineNeedsRender = true;
        updateFilterToggleUI();
        return;
    }

    if (canSkipFullTimelineRefresh(options)) {
        return;
    }

    timelineNeedsRender = false;
    updateEventFilters();
    renderTimelineEvents();
}

function findGameById(gamesArray, gameId) {
    return findGameInArray(gamesArray, gameId);
}

// Initialize navigation functionality
document.addEventListener('DOMContentLoaded', () => {
    // Set up mobile menu toggle
    initMobileMenu();

    // Set up favorites toggle and playlist functionality
    initFavoritesUI();
    initPresentationMode();
    initLabelSweep();
});

function initMobileMenu() {
    setupMobileMenu('#mobileMenuButton', '#mainMenu');
}

function closePlaylistsDropdown() {
    const menu = document.getElementById('playlists-dropdown-menu');
    const trigger = document.getElementById('show-favorites');
    if (menu) menu.classList.add('hidden');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
}

function selectPlaylist(playlistId) {
    activePlaylistId = playlistId || FAVORITES_PLAYLIST_ID;
    closePlaylistsDropdown();
    setFilterViewMode('favorites');
}

function persistCurrentGamePlaylists(game) {
    if (!game || !currentGameId) return;
    const baseMeta = game.metadata || {};
    const metadata = game.teams ? { ...baseMeta, teams: game.teams } : { ...baseMeta };
    saveGame(currentGameId, game.events || timelineEvents, metadata);
}

function createPlaylistDeleteButton(game, pl) {
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'playlist-dropdown-delete';
    delBtn.title = `Delete playlist ${pl.name}`;
    delBtn.setAttribute('aria-label', `Delete playlist ${pl.name}`);
    delBtn.innerHTML = '<i class="fas fa-trash-alt text-xs" aria-hidden="true"></i>';
    delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!deletePlaylist(game, pl.id)) return;
        persistCurrentGamePlaylists(game);
        if (activePlaylistId === pl.id) {
            activePlaylistId = FAVORITES_PLAYLIST_ID;
            setFilterViewMode('all');
        }
        renderPlaylistsDropdown();
        renderTimelineEvents();
        showNotification(`Deleted playlist "${pl.name}"`, 'info');
    });
    return delBtn;
}

function createPlaylistDropdownRow(game, pl) {
    const row = document.createElement('div');
    row.className = 'playlist-dropdown-row';

    const btn = document.createElement('button');
    btn.type = 'button';
    const isSelected = filterViewMode === 'favorites' && activePlaylistId === pl.id;
    btn.className = `playlist-dropdown-item${isSelected ? ' is-selected' : ''}`;
    btn.setAttribute('role', 'menuitem');
    btn.dataset.playlistId = pl.id;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'truncate flex items-center gap-1.5';
    nameSpan.innerHTML = `<i class="${pl.isBuiltIn ? 'fas fa-star text-amber-500' : 'fas fa-list text-slate-400'} text-xs" aria-hidden="true"></i><span class="truncate"></span>`;
    nameSpan.querySelector('span').textContent = pl.name;

    const countSpan = document.createElement('span');
    countSpan.className = 'text-xs text-slate-400 tabular-nums flex-shrink-0';
    countSpan.textContent = String(pl.count);

    btn.append(nameSpan, countSpan);
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectPlaylist(pl.id);
    });
    row.appendChild(btn);

    if (!pl.isBuiltIn) {
        row.appendChild(createPlaylistDeleteButton(game, pl));
    }
    return row;
}

function renderPlaylistsDropdown() {
    const menu = document.getElementById('playlists-dropdown-menu');
    if (!menu) return;
    const game = getCurrentGame() || { events: timelineEvents, metadata: {} };
    const playlists = getGamePlaylists(game);

    menu.innerHTML = '';
    playlists.forEach((pl) => menu.appendChild(createPlaylistDropdownRow(game, pl)));

    const divider = document.createElement('div');
    divider.className = 'border-t border-slate-200 my-1';
    menu.appendChild(divider);

    const newBtn = document.createElement('button');
    newBtn.type = 'button';
    newBtn.className = 'playlist-dropdown-item text-blue-600 font-semibold';
    newBtn.innerHTML = '<span><i class="fas fa-plus text-xs mr-1.5" aria-hidden="true"></i>New playlist...</span>';
    newBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const form = document.createElement('form');
        form.className = 'flex items-center gap-1 p-1';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'field text-xs py-1 px-2 flex-1 min-w-0';
        input.placeholder = 'Playlist name...';
        input.maxLength = 40;
        const createBtn = document.createElement('button');
        createBtn.type = 'submit';
        createBtn.className = 'btn btn-primary btn-compact text-xs';
        createBtn.textContent = 'Create';
        form.append(input, createBtn);
        newBtn.replaceWith(form);
        input.focus();
        form.addEventListener('submit', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const res = createPlaylist(game, input.value);
            if (!res.playlist) {
                showNotification(res.error || 'Please enter a playlist name', 'warning');
                return;
            }
            persistCurrentGamePlaylists(game);
            selectPlaylist(res.playlist.id);
        });
    });
    menu.appendChild(newBtn);
}

// Initialize favorites UI and handlers
function initFavoritesUI() {
    const showAllBtn = document.getElementById('show-all-events');
    const showFavoritesBtn = document.getElementById('show-favorites');
    const showUnlabelledBtn = document.getElementById('show-unlabelled');
    const playlistsMenu = document.getElementById('playlists-dropdown-menu');

    if (showAllBtn) {
        showAllBtn.addEventListener('click', () => {
            closePlaylistsDropdown();
            showAllEvents();
        });
    }

    if (showFavoritesBtn) {
        showFavoritesBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!playlistsMenu) {
                showFavoritesOnly();
                return;
            }
            const isHidden = playlistsMenu.classList.contains('hidden');
            if (isHidden) {
                renderPlaylistsDropdown();
                playlistsMenu.classList.remove('hidden');
                showFavoritesBtn.setAttribute('aria-expanded', 'true');
            } else {
                closePlaylistsDropdown();
            }
        });
    }

    if (showUnlabelledBtn) {
        showUnlabelledBtn.addEventListener('click', () => {
            closePlaylistsDropdown();
            setFilterViewMode('unlabelled');
        });
    }
}

function initPresentationMode() {
    presentationController.deps = {
        ...presentationController.deps,
        getTimelineEvents: () => timelineEvents,
        highlightTimelineEvent: (id) => highlightTimelineEvent(id),
        showNotification: (msg, type) => showNotification(msg, type)
    };
    presentationController.init({
        onToggle: () => togglePresentationMode(),
        onNavigate: (dir) => navigatePlaylist(dir)
    });
}

function resolveActivePresentationTarget(game) {
    const targetId = filterViewMode === 'favorites' ? activePlaylistId : FAVORITES_PLAYLIST_ID;
    const playlists = getGamePlaylists(game);
    const active = playlists.find((p) => p.id === targetId) || playlists[0];
    const id = active ? active.id : FAVORITES_PLAYLIST_ID;
    const name = active ? active.name : FAVORITES_PLAYLIST_NAME;
    return { events: getPlaylistEvents(game, id), playlistName: name };
}

// Presentation mode delegates to PresentationController
function togglePresentationMode() {
    const ctrl = presentationController;
    const game = getCurrentGame() || { events: timelineEvents, metadata: {} };
    const { events, playlistName } = resolveActivePresentationTarget(game);

    ctrl.toggle(timelineEvents, {
        events,
        playlistName,
        skipFilterSync: true
    });
    presentationModeActive = ctrl.isActive;
    favoriteEvents = ctrl.favoriteEvents;
    currentPlaylistIndex = ctrl.currentIndex;
}

function navigatePlaylist(direction) {
    const ctrl = presentationController;
    ctrl.navigate(direction);
    currentPlaylistIndex = ctrl.currentIndex;
}

function updatePlaylistCounter() {
    presentationController.updateCounter();
}

function jumpToEventTime(event) {
    presentationController.jumpToEvent(event);
}

function updatePresentationOverlay(event) {
    presentationController.updateOverlay(event);
}

function resolveTimelineCardById(container, eventId) {
    const lastChild = container.lastElementChild;
    if (lastChild && lastChild.dataset?.eventId === eventId) return lastChild;
    return container.querySelector(`.timeline-event[data-event-id="${eventId}"]`);
}

function scrollCardIntoViewIfNeeded(card, shouldScroll) {
    if (shouldScroll && typeof card.scrollIntoView === 'function') {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Highlight the current event in the timeline
function highlightTimelineEvent(eventId, { scroll = true } = {}) {
    const container = document.getElementById('timeline-events') || document;
    const activeEls = container.getElementsByClassName
        ? Array.from(container.getElementsByClassName('is-active'))
        : container.querySelectorAll('.timeline-event.is-active');
    activeEls.forEach(el => el.classList.remove('is-active'));

    const currentEvent = resolveTimelineCardById(container, eventId);
    if (currentEvent) {
        currentEvent.classList.add('is-active');
        scrollCardIntoViewIfNeeded(currentEvent, scroll);
    }
}

// --- Label Sweep & Rapid Tagging Engine ---

let activeSweepFilterFn = null;

function attachSweepDockButtonListeners() {
    const dockPrevBtn = document.getElementById('dock-prev-sweep-btn');
    const dockSkipBtn = document.getElementById('dock-skip-sweep-btn');
    const dockExitBtn = document.getElementById('dock-exit-sweep-btn');
    const dockReplayBtn = document.getElementById('dock-replay-clip-btn');

    dockPrevBtn?.addEventListener('click', () => navigateSweep('previous'));
    dockSkipBtn?.addEventListener('click', () => navigateSweep('next'));
    dockExitBtn?.addEventListener('click', () => exitLabelSweep());
    dockReplayBtn?.addEventListener('click', () => replayCurrentSweepClip());
}

function handleSweepOptionKey(e, key) {
    const currentEvent = sweepEvents[currentSweepIndex];
    const schema = currentEvent ? getLabelSchemaForEvent(currentEvent) : null;
    const opt = schema?.options.find(o => o.key === key);
    if (opt) {
        e.preventDefault();
        applySweepLabel(schema.group, opt.text);
    }
}

const SWEEP_KEY_ACTIONS = {
    Escape: exitLabelSweep,
    Space: () => navigateSweep('next'),
    ' ': () => navigateSweep('next'),
    ArrowLeft: () => navigateSweep('previous'),
    p: () => navigateSweep('previous'),
    P: () => navigateSweep('previous'),
    r: replayCurrentSweepClip,
    R: replayCurrentSweepClip
};

function resolveSweepAction(e) {
    if (e.code === 'Space') return SWEEP_KEY_ACTIONS.Space;
    return SWEEP_KEY_ACTIONS[e.key] || null;
}

function isSweepInputTarget(target) {
    return Boolean(target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'));
}

function canHandleSweepKey(target) {
    return Boolean(sweepModeActive && !isSweepInputTarget(target));
}

function handleSweepDockKeyDown(e) {
    if (!canHandleSweepKey(e.target)) return;
    const action = resolveSweepAction(e);
    if (action) {
        e.preventDefault();
        action();
        return;
    }
    handleSweepOptionKey(e, e.key);
}

function initLabelSweep() {
    const sweepBtn = document.getElementById('label-sweep-btn');
    const scopeDialog = document.getElementById('sweep-scope-dialog');
    const closeScopeDialogBtn = document.getElementById('close-sweep-scope-dialog');

    sweepBtn?.addEventListener('click', () => {
        if (sweepModeActive) {
            exitLabelSweep();
        } else {
            openSweepScopeDialog();
        }
    });

    closeScopeDialogBtn?.addEventListener('click', () => closeSweepScopeDialog());

    scopeDialog?.addEventListener('click', (e) => {
        if (e.target === scopeDialog) closeSweepScopeDialog();
    });

    attachSweepDockButtonListeners();
    window.addEventListener('keydown', handleSweepDockKeyDown);
}

function getSweepOptionTeamBadge(team) {
    if (!team || team === 'Unassigned') return '';
    return `<span class="badge ${getTeamColorBadgeClass(team)} text-[10px] font-bold uppercase tracking-wider mr-1.5 px-2 py-0.5">${team}</span>`;
}

function getSweepOptionBadgeClass(optId = '') {
    return optId.includes('CE')
        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
        : 'bg-slate-900 text-slate-300 border border-slate-700';
}

function createSweepOptionButton(opt, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'w-full text-left p-3 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 transition flex items-center justify-between group focus:outline-none focus:ring-2 focus:ring-primary-500';
    
    const teamBadgeHtml = getSweepOptionTeamBadge(opt.team);
    const badgeClass = getSweepOptionBadgeClass(opt.id);
    const descriptionText = opt.description || '';

    btn.innerHTML = `
        <div class="min-w-0 pr-2">
            <div class="font-semibold text-sm text-white group-hover:text-primary-400 flex items-center truncate">
                ${teamBadgeHtml}
                <span class="truncate">${opt.label}</span>
            </div>
            <p class="text-[11px] text-slate-400 mt-0.5 truncate">${descriptionText}</p>
        </div>
        <span class="text-xs font-semibold px-2.5 py-1 rounded-full ${badgeClass} flex-shrink-0">
            ${opt.estTime}
        </span>
    `;

    btn.addEventListener('click', onClick);
    return btn;
}

function renderSweepScopeButtons(container, options) {
    container.innerHTML = '';
    options.forEach(opt => {
        const btn = createSweepOptionButton(opt, () => {
            closeSweepScopeDialog();
            startLabelSweep(opt.filter);
        });
        container.appendChild(btn);
    });
}

function showSweepDialog(dialog) {
    if (typeof dialog.showModal === 'function') {
        dialog.showModal();
    } else {
        dialog.classList.remove('hidden');
    }
}

function openSweepScopeDialog() {
    const dialog = document.getElementById('sweep-scope-dialog');
    const optionsContainer = document.getElementById('sweep-scope-options');
    if (!dialog || !optionsContainer) {
        startLabelSweep();
        return;
    }

    const options = getSweepScopeOptions(timelineEvents);
    if (options.length === 0) {
        showNotification('No events matching label schemas found to sweep', 'warning');
        return;
    }

    renderSweepScopeButtons(optionsContainer, options);
    showSweepDialog(dialog);
}

function closeSweepScopeDialog() {
    const dialog = document.getElementById('sweep-scope-dialog');
    if (!dialog) return;
    if (typeof dialog.close === 'function') {
        dialog.close();
    } else {
        dialog.classList.add('hidden');
    }
}

const TEAM_BADGE_CLASS_MAP = [
    { key: 'PRIDE', className: 'bg-amber-500 text-black' },
    { key: 'THUNDER', className: 'bg-cyan-800 text-white' },
    { key: 'FIRE', className: 'bg-red-600 text-white' },
    { key: 'TIGERS', className: 'bg-amber-600 text-white' }
];

function getTeamColorBadgeClass(teamName) {
    if (!teamName) return 'bg-slate-700 text-white';
    const upper = String(teamName).toUpperCase();
    const match = TEAM_BADGE_CLASS_MAP.find(entry => upper.includes(entry.key));
    return match ? match.className : 'bg-blue-600 text-white';
}

function seekAndPlaySweepVideo(event) {
    if (!event) return;
    const seekSec = getSweepSeekSeconds(event);
    const video = document.getElementById('video-player');
    if (video) {
        video.currentTime = seekSec;
        const playPromise = video.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => {});
        }
    }
}

function replayCurrentSweepClip() {
    if (!sweepModeActive || sweepEvents.length === 0) return;
    const event = sweepEvents[currentSweepIndex];
    seekAndPlaySweepVideo(event);
}

function matchesSweepCandidate(e, filterFn) {
    const matchesFilter = filterFn
        ? filterFn(e)
        : (activeTypeFilters.size === 0 || activeTypeFilters.has(e.event));
    return Boolean(matchesFilter && getLabelSchemaForEvent(e));
}

function resolveSweepCandidateEvents(events, filterFn) {
    let candidates = events.filter(e => matchesSweepCandidate(e, filterFn));
    if (candidates.length === 0) {
        candidates = events.filter(e => {
            const matchesFilter = filterFn ? filterFn(e) : true;
            return matchesFilter && Boolean(getLabelSchemaForEvent(e));
        });
    }
    candidates.sort((a, b) => a.timeMs - b.timeMs);
    const unlabelled = candidates.filter(e => !Array.isArray(e.labels) || e.labels.length === 0);
    return unlabelled.length > 0 ? unlabelled : candidates;
}

function updateSweepDockVisibility(sweepCount) {
    document.getElementById('sweep-dock')?.classList.remove('hidden');
    document.getElementById('video-coding-panel')?.classList.add('hidden');
    document.getElementById('sweep-controls')?.classList.replace('hidden', 'flex');

    const sweepBtn = document.getElementById('label-sweep-btn');
    const sweepText = document.getElementById('label-sweep-text');
    if (sweepBtn) {
        sweepBtn.classList.add('is-active');
        sweepBtn.setAttribute('aria-pressed', 'true');
    }
    if (sweepText) {
        sweepText.textContent = `Exit Sweep (${sweepCount})`;
    }
}

function startLabelSweep(filterFn = null) {
    activeSweepFilterFn = filterFn;
    const candidates = resolveSweepCandidateEvents(timelineEvents, filterFn);
    if (candidates.length === 0) {
        showNotification('No events matching label schemas found to sweep', 'warning');
        return;
    }

    sweepEvents = candidates;
    currentSweepIndex = 0;
    sweepModeActive = true;

    if (presentationModeActive) {
        togglePresentationMode();
    }

    updateSweepDockVisibility(sweepEvents.length);
    loadSweepEvent(currentSweepIndex);
}

function exitLabelSweep() {
    sweepModeActive = false;
    activeSweepFilterFn = null;

    const sweepDock = document.getElementById('sweep-dock');
    const codingPanel = document.getElementById('video-coding-panel');
    if (sweepDock) {
        sweepDock.classList.add('hidden');
    }
    const sweepControls = document.getElementById('sweep-controls');
    if (sweepControls) {
        sweepControls.classList.replace('flex', 'hidden');
    }
    if (codingPanel && isTaggingMode) {
        codingPanel.classList.remove('hidden');
    }

    const sweepBtn = document.getElementById('label-sweep-btn');
    if (sweepBtn) {
        sweepBtn.classList.remove('is-active');
        sweepBtn.setAttribute('aria-pressed', 'false');
    }

    updateSweepButtonUI();
    renderTimelineEvents();
    updateFilterToggleUI();
}

function navigateSweep(direction) {
    if (!sweepModeActive || sweepEvents.length === 0) return;
    if (direction === 'next') {
        if (currentSweepIndex < sweepEvents.length - 1) {
            currentSweepIndex++;
            loadSweepEvent(currentSweepIndex);
        } else {
            showNotification(`Finished labelling sweep (${sweepEvents.length} clips)!`, 'success');
            exitLabelSweep();
        }
    } else if (direction === 'previous') {
        if (currentSweepIndex > 0) {
            currentSweepIndex--;
            loadSweepEvent(currentSweepIndex);
        }
    }
}

function setElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function updateSweepDockHeader(event, index, total) {
    const team = extractTeamFromEvent(event) || 'Match';
    const dockTeamBadge = document.getElementById('dock-sweep-team-badge');
    if (dockTeamBadge) {
        dockTeamBadge.textContent = team;
        dockTeamBadge.className = `badge font-bold uppercase tracking-wider text-xs px-2.5 py-0.5 rounded ${getTeamColorBadgeClass(team)}`;
    }

    const friendly = getFriendlyEventName(event.event);
    setElementText('dock-sweep-event-name', friendly ? `${friendly} (${event.event})` : event.event);

    const sec = Math.floor((event.timeMs || 0) / 1000);
    const mins = Math.floor(sec / 60);
    const remSec = sec % 60;
    setElementText('dock-sweep-timestamp', `${String(mins).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`);
    setElementText('dock-sweep-counter', `Clip ${index + 1} of ${total}`);
    setElementText('sweep-counter', `${index + 1}/${total}`);

    const dockProgress = document.getElementById('dock-sweep-progress');
    if (dockProgress) {
        const pct = Math.round(((index + 1) / total) * 100);
        dockProgress.style.width = `${pct}%`;
        document.getElementById('dock-sweep-progressbar-container')?.setAttribute('aria-valuenow', String(pct));
    }
}

function renderSweepSchemaButtons(dockChips, schema, event) {
    if (!dockChips || !schema) return;
    dockChips.innerHTML = '';
    const currentLabel = event.labels?.find(l => l.group === schema.group)?.text;
    schema.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.type = 'button';
        const isActive = currentLabel === opt.text;
        btn.className = `sweep-action-card${isActive ? ' is-active' : ''}`;
        btn.setAttribute('aria-pressed', String(isActive));
        btn.innerHTML = `<span class="sweep-action-key">${opt.key}</span> <span>${opt.text}</span>`;
        btn.title = `${opt.text} (Press ${opt.key})`;
        btn.addEventListener('click', () => {
            applySweepLabel(schema.group, opt.text);
        });
        dockChips.appendChild(btn);
    });
}

function loadSweepEvent(index) {
    if (index < 0 || index >= sweepEvents.length) return;
    const event = sweepEvents[index];

    updateSweepDockHeader(event, index, sweepEvents.length);
    seekAndPlaySweepVideo(event);
    highlightTimelineEvent(event.id);

    const schema = getLabelSchemaForEvent(event);
    const dockPrompt = document.getElementById('dock-sweep-prompt');
    if (dockPrompt) {
        dockPrompt.textContent = schema?.prompt || 'Classify this clip:';
    }

    const dockChips = document.getElementById('dock-sweep-chips');
    renderSweepSchemaButtons(dockChips, schema, event);
}
function applySweepLabel(group, text) {
    if (!sweepModeActive || currentSweepIndex >= sweepEvents.length) return;
    const event = sweepEvents[currentSweepIndex];
    if (!event) return;

    updateEventLabel(event.id, group, text);
    showNotification(`Tagged ${event.event} → ${text}`, 'success');
    navigateSweep('next');
}

function updateEventLabel(eventId, group, text) {
    const { game, event } = findEventInCurrentGame(eventId);
    if (!game || !event) return false;

    if (!Array.isArray(event.labels)) event.labels = [];
    const existingIndex = event.labels.findIndex(l => l.group === group);

    if (existingIndex >= 0 && event.labels[existingIndex].text === text) {
        event.labels.splice(existingIndex, 1);
    } else if (existingIndex >= 0) {
        event.labels[existingIndex].text = text;
    } else {
        event.labels.push({ group, text });
    }

    const metadata = { ...game.metadata, teams: game.teams };
    invalidateUnlabelledCountCache();
    saveGame(game.id, game.events, metadata);
    timelineEvents = game.events;
    renderTimelineEvents();
    updateFilterToggleUI();
    return true;
}

// Show all events (disable favorites filter)
function showAllEvents() {
    setFavoritesOnly(false);
}

// Show only favorited events
function showFavoritesOnly() {
    setFavoritesOnly(true);
}

// Use the notification service for notifications
function showNotification(message, type = 'success') {
    notificationService.notify(message, type);
}

let cachedSavedGamesRaw = null;
let cachedSavedGamesList = null;

// Game management functions
function getSavedGames() {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEY_GAMES) : null;
    if (raw && raw === cachedSavedGamesRaw && Array.isArray(cachedSavedGamesList)) {
        return cachedSavedGamesList;
    }

    const storedGames = storageService.getItem(LOCAL_STORAGE_KEY_GAMES);
    const { games: normalized, changed } = normalizeSavedGamesToArray(storedGames);
    if (!normalized || normalized.length === 0) {
        cachedSavedGamesRaw = null;
        cachedSavedGamesList = null;
        return [];
    }

    // If normalization assigned ids or transformed object shape, persist the updated array
    if (changed) {
        try {
            storageService.setItem(LOCAL_STORAGE_KEY_GAMES, normalized);
        } catch (e) {
            console.warn('Failed to persist normalized saved games', e);
        }
    }

    cachedSavedGamesRaw = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEY_GAMES) : null;
    cachedSavedGamesList = normalized;
    gameStorageManager._updateCache(normalized);
    return normalized;
}

function invalidateSavedGamesCache() {
    cachedSavedGamesRaw = null;
    cachedSavedGamesList = null;
    gameStorageManager.invalidateCache();
}

function saveGame(gameId, events, metadata = {}) {
    const success = gameStorageManager.upsertGame(gameId, events, metadata);
    if (!success) {
        invalidateSavedGamesCache();
        showNotification("Error saving game", "error");
        return false;
    }
    cachedSavedGamesRaw = gameStorageManager._cachedRaw;
    cachedSavedGamesList = gameStorageManager._cachedGames ? [...gameStorageManager._cachedGames] : null;
    scheduleTimelineCloudSync(gameId);
    return true;
}


// --- Video URL & Source Management ---

// Video URL & source modal functions imported from ./videoSourceManager.js

function setVideoElementSource(video, cleanUrl) {
    while (video.firstChild) {
        video.removeChild(video.firstChild);
    }
    video.removeAttribute('src');
    video.src = cleanUrl;
    video.load();
    try {
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(err => console.warn("Couldn't auto-play attached video:", err));
        }
    } catch (_) {}
}

function persistAttachedVideoUrl(game, cleanUrl) {
    game.videoUrl = cleanUrl;
    if (!game.metadata) game.metadata = {};
    game.metadata.videoUrl = cleanUrl;

    if (currentDraftGame && currentDraftGame.id === game.id) {
        commitDraftGame();
        return;
    }

    const savedGames = getSavedGames();
    const { game: existing, index } = findGameById(savedGames, game.id);
    if (existing) {
        existing.videoUrl = cleanUrl;
        if (!existing.metadata) existing.metadata = {};
        existing.metadata.videoUrl = cleanUrl;
        existing.metadata.lastUpdated = new Date().toISOString();
        savedGames[index] = existing;
        storageService.setItem(LOCAL_STORAGE_KEY_GAMES, savedGames);
        invalidateSavedGamesCache();
        scheduleTimelineCloudSync(game.id);
    }
}

function attachVideoUrl(url, options = { saveToStorage: true }) {
    const validation = validateVideoUrl(url);
    if (!validation.valid) {
        showNotification(validation.error || 'Invalid video link', 'error');
        return { success: false, error: validation.error };
    }
    const cleanUrl = url.trim();
    const video = document.getElementById('video-player');
    if (!video) return { success: false, error: 'Video element not found' };

    setVideoElementSource(video, cleanUrl);

    let game = getCurrentGame() || createNewVideoGame();

    if (options && options.saveToStorage) {
        persistAttachedVideoUrl(game, cleanUrl);
    }

    updateVideoStageOverlays();
    updateCurrentVideoBanner();
    closeAttachVideoModal();
    updateFabVisibility();

    showNotification('Video URL attached and saved to match', 'success');
    return { success: true, url: cleanUrl };
}

function detachVideo() {
    const video = document.getElementById('video-player');
    if (video) {
        while (video.firstChild) video.removeChild(video.firstChild);
        video.removeAttribute('src');
        video.load();
    }

    let game = getCurrentGame();
    if (game) {
        delete game.videoUrl;
        if (game.metadata) delete game.metadata.videoUrl;

        const savedGames = getSavedGames();
        const { game: existing, index } = findGameById(savedGames, game.id);
        if (existing) {
            delete existing.videoUrl;
            if (existing.metadata) {
                delete existing.metadata.videoUrl;
                existing.metadata.lastUpdated = new Date().toISOString();
            }
            savedGames[index] = existing;
            storageService.setItem(LOCAL_STORAGE_KEY_GAMES, savedGames);
            invalidateSavedGamesCache();
            scheduleTimelineCloudSync(game.id);
        }
    }

    updateVideoStageOverlays();
    updateCurrentVideoBanner();
    updateFabVisibility();
    showNotification('Video removed from match', 'info');
}

function loadGame(gameId) {
    const savedGames = getSavedGames();
    const { game: foundGame } = findGameById(savedGames, gameId);
    if (foundGame) {
        try {
            // Get events from the saved game
            const events = foundGame.events;
            const game = foundGame;


            // Ensure each event has a unique id and isFavorite property
            let needsResave = false;
            events.forEach((evt) => {
                if (!evt.id) {
                    evt.id = generateEventId();
                    needsResave = true;
                }
                if (evt.isFavorite === undefined) {
                    evt.isFavorite = Boolean(evt.favorite ?? evt.favourite);
                }
            });
            // If any ids were added, persist quietly without bumping lastUpdated or marking dirty for cloud sync
            if (needsResave) {
                storageService.setItem(LOCAL_STORAGE_KEY_GAMES, savedGames);
                invalidateSavedGamesCache();
            }

            // Store current game ID
            currentGameId = gameId;
            activeVideoZone = normalizeVideoZone(game.metadata && game.metadata.activeZone);

            // Update current events and render timeline
            syncTimelineAfterGameLoad(events);
            updateQuickTagTicker();

            updateTitleUI(matchTitleFromGame(game, gameId));
            updateSaveStatusUI();
            updateFabVisibility();

            const savedVideoUrl = game.videoUrl || (game.metadata && game.metadata.videoUrl);
            if (savedVideoUrl) {
                attachVideoUrl(savedVideoUrl, { saveToStorage: false });
            } else {
                updateVideoStageOverlays();
                updateCurrentVideoBanner();
            }

            return true;
        } catch (e) {
            console.error("Error loading game:", e);
            showNotification("Error loading game", "error");
            return false;
        }
    } else {
        console.error(`Game with ID "${gameId}" not found`);
        showNotification(`Game "${gameId}" not found`, "error");
        return false;
    }
}



function syncTimelineAfterGameLoad(events) {
    timelineEvents = events;
    if (isTimelineCollapsed) {
        timelineNeedsRender = true;
        updateFilterToggleUI();
        return;
    }
    timelineNeedsRender = false;
    updateEventFilters();
    renderTimelineEvents();
}
function getVisibleEvents() {
    return timelineEvents.filter(isEventVisibleInCurrentFilter);
}

function setTypeFilters(types) {
    activeTypeFilters = new Set(types);
    renderTimelineEvents();
}

function setFilterViewMode(mode) {
    filterViewMode = mode;
    favoritesOnly = (mode === 'favorites');
    updateFilterToggleUI();
    renderTimelineEvents();
}

function getFilterViewMode() {
    return filterViewMode;
}

function setFavoritesOnly(value) {
    setFilterViewMode(value ? 'favorites' : 'all');
}

let cachedUnlabelledEventsRef = null;
let cachedUnlabelledEventsLength = -1;
let cachedUnlabelledCount = 0;

function isUnlabelledSchemaEvent(event) {
    if (!event || !getLabelSchemaForEvent(event)) return false;
    return !Array.isArray(event.labels) || event.labels.length === 0;
}

function invalidateUnlabelledCountCache() {
    cachedUnlabelledEventsRef = null;
    cachedUnlabelledEventsLength = -1;
}

function syncUnlabelledCacheForMutation(events, options) {
    if (options.insertedEvent && cachedUnlabelledEventsRef === events && cachedUnlabelledEventsLength === events.length - 1) {
        if (isUnlabelledSchemaEvent(options.insertedEvent)) {
            cachedUnlabelledCount += 1;
        }
        cachedUnlabelledEventsLength = events.length;
        return;
    }
    invalidateUnlabelledCountCache();
}

function getUnlabelledEventsCount() {
    if (cachedUnlabelledEventsRef === timelineEvents && cachedUnlabelledEventsLength === timelineEvents.length) {
        return cachedUnlabelledCount;
    }
    cachedUnlabelledCount = timelineEvents.filter(isUnlabelledSchemaEvent).length;
    cachedUnlabelledEventsRef = timelineEvents;
    cachedUnlabelledEventsLength = timelineEvents.length;
    return cachedUnlabelledCount;
}

function updateSweepButtonUI(precomputedCount = null) {
    const sweepBtn = document.getElementById('label-sweep-btn');
    const sweepText = document.getElementById('label-sweep-text');
    if (!sweepBtn) return;
    if (sweepModeActive) {
        if (sweepText) sweepText.textContent = `Exit Sweep (${sweepEvents.length})`;
        sweepBtn.classList.add('is-active');
        return;
    }
    const count = precomputedCount !== null ? precomputedCount : getUnlabelledEventsCount();
    if (sweepText) {
        sweepText.textContent = count > 0 ? `Sweep (${count})` : 'Sweep Labels';
    }
    sweepBtn.title = count > 0 ? `Rapidly label ${count} unlabelled events (1-3)` : 'Sweep events for labels';
    sweepBtn.classList.remove('is-active');
}

function updateFilterToggleUI() {
    const showAllBtn = document.getElementById('show-all-events');
    const showFavoritesBtn = document.getElementById('show-favorites');
    const showUnlabelledBtn = document.getElementById('show-unlabelled');
    const playlistsLabel = document.getElementById('playlists-filter-label');

    const unlabelledCount = getUnlabelledEventsCount();
    if (showUnlabelledBtn) {
        const nextHtml = `<i class="fas fa-tag mr-1 text-xs" aria-hidden="true"></i>Unlabelled${unlabelledCount > 0 ? ` (${unlabelledCount})` : ''}`;
        if (showUnlabelledBtn.innerHTML !== nextHtml) {
            showUnlabelledBtn.innerHTML = nextHtml;
        }
    }

    if (playlistsLabel) {
        if (filterViewMode === 'favorites') {
            const game = getCurrentGame() || { events: timelineEvents, metadata: {} };
            const playlists = getGamePlaylists(game);
            const activePl = playlists.find((p) => p.id === activePlaylistId) || playlists[0];
            playlistsLabel.textContent = activePl ? `${activePl.name} (${activePl.count})` : 'Playlists';
        } else {
            playlistsLabel.textContent = 'Playlists';
        }
    }

    const buttons = [
        { btn: showAllBtn, mode: 'all' },
        { btn: showFavoritesBtn, mode: 'favorites' },
        { btn: showUnlabelledBtn, mode: 'unlabelled' }
    ];

    buttons.forEach(({ btn, mode }) => {
        if (!btn) return;
        const isActive = filterViewMode === mode;
        btn.classList.toggle('is-active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
    });

    updateSweepButtonUI(unlabelledCount);
}

function updateFavoritesToggleUI() {
    updateFilterToggleUI();
}

// Delete event by id, update storage, re-render, and notify
function deleteEvent(eventId) {
    if (!currentGameId) return;
    const savedGames = getSavedGames();
    const { game } = findGameById(savedGames, currentGameId);
    if (!game || !Array.isArray(game.events)) return;
    const idx = game.events.findIndex(e => e.id === eventId);
    if (idx === -1) return;
    if (!window.confirm('Are you sure you want to delete this event? This cannot be undone.')) return;
    game.events.splice(idx, 1);
    pruneDeletedEventFromPlaylists(game, eventId);
    persistGameEventsAndRefresh(game);
    updateQuickTagTicker();
    showNotification('Event deleted', 'info');
}


// Shift all event timings for a game (in-place or duplicate copy)
function shiftGameTimings(gameId, offsetMs, createCopy = false) {
    const res = execShiftGameTimings(gameId, offsetMs, createCopy, {
        getSavedGames,
        findGameById,
        getCurrentDraftGame: () => currentDraftGame,
        updateCurrentDraftEvents: (evts) => { timelineEvents = evts; }
    });
    invalidateSavedGamesCache();
    return res;
}

function revertGameTimings(gameId) {
    const res = execRevertGameTimings(gameId, {
        getSavedGames,
        findGameById,
        getCurrentDraftGame: () => currentDraftGame,
        updateCurrentDraftEvents: (evts) => { timelineEvents = evts; }
    });
    invalidateSavedGamesCache();
    return res;
}
function updateModalPreview() {
    const game = getCurrentGame();
    const video = document.getElementById('video-player');
    updateAlignmentModalPreview(game, video, { formatEventTypeName });
}

function applyAlignedCopySuccess(game, formattedOffset) {
    notificationService.notify(`Created shifted copy "${game.title}" (${formattedOffset})`, 'success');
    loadGame(game.id);
    const url = new URL(window.location.href);
    url.searchParams.set('game', game.id);
    window.history.pushState({}, '', url.toString());
}

function applyInplaceShiftSuccess(formattedOffset) {
    renderTimelineEvents();
    updateQuickTagTicker();
    updateEventFilters();
    const game = getCurrentGame();
    const count = game && game.events ? game.events.length : 0;
    notificationService.notify(`Shifted ${count} events by ${formattedOffset}`, 'success');
}

function applyShiftSuccess(result, offset, createCopy) {
    if (createCopy && result.game) {
        applyAlignedCopySuccess(result.game, offset.formatted);
        return;
    }
    applyInplaceShiftSuccess(offset.formatted);
}

function attachModalCloseHandlers(modal, closeBtn, cancelBtn) {
    const closeModal = () => modal.classList.add('hidden');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    return closeModal;
}

function attachShiftActionHandlers(closeModal) {
    const shiftInplaceBtn = document.getElementById('align-shift-inplace-btn');
    const shiftCopyBtn = document.getElementById('align-shift-copy-btn');
    const revertBtn = document.getElementById('align-revert-btn');

    function executeShift(createCopy) {
        const video = document.getElementById('video-player');
        const state = calculateAlignmentState(video, getCurrentGame());
        if (!state) return;
        const result = shiftGameTimings(state.game.id, state.offset.offsetMs, createCopy);
        if (result && result.success) {
            closeModal();
            applyShiftSuccess(result, state.offset, createCopy);
        }
    }

    if (shiftInplaceBtn) shiftInplaceBtn.addEventListener('click', () => executeShift(false));
    if (shiftCopyBtn) shiftCopyBtn.addEventListener('click', () => executeShift(true));
    if (revertBtn) {
        revertBtn.addEventListener('click', () => {
            const game = getCurrentGame();
            if (!game) return;
            const result = revertGameTimings(game.id);
            if (result && result.success) {
                closeModal();
                renderTimelineEvents();
                updateQuickTagTicker();
                updateEventFilters();
                notificationService.notify('Reverted events to original live timings', 'success');
            }
        });
    }
}

// Initialize the Align Video modal and event wiring
function initAlignVideoModal() {
    const modal = document.getElementById('align-video-modal');
    if (!modal) return;

    function openModal() {
        const video = document.getElementById('video-player');
        if (!canOpenAlignmentModal(video, getCurrentGame())) return;
        const attachModal = document.getElementById('attach-video-modal');
        if (attachModal) attachModal.classList.add('hidden');
        updateModalPreview();
        modal.classList.remove('hidden');
    }

    const alignBtn = document.getElementById('align-video-btn');
    const modalAlignBtn = document.getElementById('modal-align-video-btn');
    const usePlayheadBtn = document.getElementById('align-use-playhead-btn');

    if (alignBtn) alignBtn.addEventListener('click', openModal);
    if (modalAlignBtn) modalAlignBtn.addEventListener('click', openModal);
    if (usePlayheadBtn) usePlayheadBtn.addEventListener('click', updateModalPreview);

    const closeModal = attachModalCloseHandlers(
        modal,
        document.getElementById('close-align-video-modal'),
        document.getElementById('cancel-align-modal-btn')
    );
    attachShiftActionHandlers(closeModal);
}

function createTimelineEventSeekButton(event, eventName, timeFormatted) {
    const seekButton = document.createElement('button');
    seekButton.type = 'button';
    seekButton.className = 'timeline-event-seek';
    seekButton.setAttribute('aria-label', `Play ${eventName} at ${timeFormatted}`);

    const timeEl = document.createElement('span');
    timeEl.className = 'timeline-event-time';
    timeEl.textContent = timeFormatted;

    const nameEl = document.createElement('span');
    nameEl.className = 'timeline-event-name flex items-center gap-1 min-w-0';
    const nameText = document.createElement('span');
    nameText.className = 'timeline-event-title-text';
    nameText.textContent = eventName;
    nameEl.appendChild(nameText);

    if (Array.isArray(event.labels) && event.labels.length > 0) {
        const labelsWrapper = document.createElement('span');
        labelsWrapper.className = 'timeline-event-labels';
        event.labels.forEach(lbl => {
            const pill = document.createElement('span');
            pill.className = `timeline-event-label${lbl.group === 'Origin' ? ' is-origin' : ''}`;
            pill.textContent = lbl.text;
            pill.title = `${lbl.group}: ${lbl.text}`;
            labelsWrapper.appendChild(pill);
        });
        nameEl.appendChild(labelsWrapper);
    }

    if (event.note) {
        const notePreview = document.createElement('span');
        notePreview.className = 'timeline-event-note-text block w-full text-xs text-slate-500 font-normal truncate';
        notePreview.textContent = String(event.note);
        nameEl.appendChild(notePreview);
    }

    seekButton.append(timeEl, nameEl);
    return seekButton;
}

function closeAllSavePopovers() {
    document.querySelectorAll('.playlist-popover:not(.hidden)').forEach((pop) => pop.classList.add('hidden'));
    document.querySelectorAll('.favorite-toggle[aria-expanded="true"]').forEach((btn) => btn.setAttribute('aria-expanded', 'false'));
}

function syncSaveButtonState(favoriteBtn, favoriteIcon, isSaved) {
    favoriteBtn.classList.toggle('is-favorite', isSaved);
    favoriteBtn.setAttribute('aria-label', isSaved ? 'Saved in playlists' : 'Save to playlist');
    favoriteIcon.className = isSaved ? 'fas fa-bookmark' : 'far fa-bookmark';
}

function renderSavePopoverContent(popover, event, favoriteBtn, favoriteIcon) {
    const game = getCurrentGame() || { events: timelineEvents, metadata: {} };
    const playlists = getGamePlaylists(game);
    popover.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'playlist-popover-header';
    const title = document.createElement('span');
    title.textContent = 'Save clip to...';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn btn-ghost btn-icon btn-compact text-slate-400 hover:text-slate-700';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '<i class="fas fa-xmark text-xs" aria-hidden="true"></i>';
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllSavePopovers();
    });
    header.append(title, closeBtn);
    popover.appendChild(header);

    const list = document.createElement('div');
    list.className = 'playlist-popover-list';

    playlists.forEach((pl) => {
        const item = document.createElement('label');
        item.className = 'playlist-popover-item';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = isEventInPlaylist(game, pl.id, event);
        cb.addEventListener('click', (e) => e.stopPropagation());
        cb.addEventListener('change', () => {
            toggleEventInPlaylist(game, pl.id, event.id);
            persistCurrentGamePlaylists(game);
            const inMemory = timelineEvents.find((e) => e.id === event.id);
            if (inMemory && pl.id === FAVORITES_PLAYLIST_ID) {
                inMemory.isFavorite = event.isFavorite;
            }
            syncSaveButtonState(favoriteBtn, favoriteIcon, isEventInAnyPlaylist(game, event));
            updateFilterToggleUI();
            if (filterViewMode === 'favorites') {
                renderTimelineEvents();
            } else {
                renderSavePopoverContent(popover, event, favoriteBtn, favoriteIcon);
            }
        });

        const labelText = document.createElement('span');
        labelText.className = 'flex-1 truncate';
        labelText.textContent = pl.isBuiltIn ? `★ ${pl.name}` : pl.name;

        const countText = document.createElement('span');
        countText.className = 'text-xs text-slate-400 tabular-nums';
        countText.textContent = String(pl.count);

        item.append(cb, labelText, countText);
        list.appendChild(item);
    });
    popover.appendChild(list);

    const footer = document.createElement('div');
    footer.className = 'playlist-popover-footer';
    const newPlBtn = document.createElement('button');
    newPlBtn.type = 'button';
    newPlBtn.className = 'playlist-dropdown-item text-blue-600 font-semibold w-full';
    newPlBtn.innerHTML = '<span><i class="fas fa-plus text-xs mr-1.5" aria-hidden="true"></i>New playlist...</span>';
    newPlBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const form = document.createElement('form');
        form.className = 'flex items-center gap-1';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'field text-xs py-1 px-2 flex-1 min-w-0';
        input.placeholder = 'Name (e.g. NSW Press)';
        input.maxLength = 40;
        const addBtn = document.createElement('button');
        addBtn.type = 'submit';
        addBtn.className = 'btn btn-primary btn-compact text-xs';
        addBtn.textContent = 'Create';
        form.append(input, addBtn);
        newPlBtn.replaceWith(form);
        input.focus();
        form.addEventListener('submit', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const res = createPlaylist(game, input.value, event.id);
            if (!res.playlist) {
                showNotification(res.error || 'Please enter a playlist name', 'warning');
                return;
            }
            persistCurrentGamePlaylists(game);
            syncSaveButtonState(favoriteBtn, favoriteIcon, isEventInAnyPlaylist(game, event));
            updateFilterToggleUI();
            renderSavePopoverContent(popover, event, favoriteBtn, favoriteIcon);
            showNotification(`Saved to "${res.playlist.name}"`, 'success');
        });
    });
    footer.appendChild(newPlBtn);
    popover.appendChild(footer);
}

function createTimelineEventActions(eventElementId, note, isSaved) {
    const saveWrapper = document.createElement('div');
    saveWrapper.className = 'timeline-event-save-wrapper';

    const favoriteBtn = document.createElement('button');
    favoriteBtn.type = 'button';
    favoriteBtn.className = `favorite-toggle timeline-event-action${isSaved ? ' is-favorite' : ''}`;
    favoriteBtn.dataset.eventId = eventElementId;
    favoriteBtn.setAttribute('aria-label', isSaved ? 'Saved in playlists' : 'Save to playlist');
    favoriteBtn.setAttribute('aria-haspopup', 'true');
    favoriteBtn.setAttribute('aria-expanded', 'false');
    favoriteBtn.title = 'Save to playlist';
    const favoriteIcon = document.createElement('i');
    favoriteIcon.className = isSaved ? 'fas fa-bookmark' : 'far fa-bookmark';
    favoriteIcon.setAttribute('aria-hidden', 'true');
    favoriteBtn.appendChild(favoriteIcon);

    const playlistPopover = document.createElement('div');
    playlistPopover.className = 'playlist-popover hidden';
    playlistPopover.setAttribute('role', 'dialog');
    playlistPopover.setAttribute('aria-label', 'Save clip to playlist');
    playlistPopover.addEventListener('click', (e) => e.stopPropagation());

    saveWrapper.append(favoriteBtn, playlistPopover);

    const moreWrapper = document.createElement('div');
    moreWrapper.className = 'timeline-event-more-wrapper';

    const moreBtn = document.createElement('button');
    moreBtn.type = 'button';
    moreBtn.className = 'timeline-event-action timeline-event-more-btn';
    moreBtn.dataset.eventId = eventElementId;
    moreBtn.setAttribute('aria-label', 'More options');
    moreBtn.setAttribute('aria-haspopup', 'true');
    moreBtn.setAttribute('aria-expanded', 'false');
    moreBtn.title = 'More options';
    const moreIcon = document.createElement('i');
    moreIcon.className = 'fas fa-ellipsis-vertical text-xs';
    moreIcon.setAttribute('aria-hidden', 'true');
    moreBtn.appendChild(moreIcon);

    const moreMenu = document.createElement('div');
    moreMenu.className = 'timeline-event-more-menu hidden';
    moreMenu.setAttribute('role', 'menu');

    const noteBtn = document.createElement('button');
    noteBtn.type = 'button';
    noteBtn.className = `timeline-event-menu-item edit-note-btn${note ? ' text-blue-600' : ''}`;
    noteBtn.dataset.eventId = eventElementId;
    noteBtn.setAttribute('role', 'menuitem');
    noteBtn.setAttribute('aria-label', note ? 'Edit note' : 'Add note');
    noteBtn.innerHTML = `<i class="${note ? 'fas fa-pen' : 'far fa-comment'} text-xs" aria-hidden="true"></i><span>${note ? 'Edit Note & Labels' : 'Add Note / Labels'}</span>`;

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'timeline-event-menu-item delete-event-btn text-red-600 hover:text-red-700';
    deleteBtn.dataset.eventId = eventElementId;
    deleteBtn.setAttribute('role', 'menuitem');
    deleteBtn.setAttribute('aria-label', 'Delete event');
    deleteBtn.innerHTML = '<i class="fas fa-trash-alt text-xs" aria-hidden="true"></i><span>Delete Event</span>';

    moreMenu.append(noteBtn, deleteBtn);
    moreWrapper.append(moreBtn, moreMenu);

    return { saveWrapper, favoriteBtn, favoriteIcon, playlistPopover, moreWrapper, moreBtn, moreMenu, noteBtn, deleteBtn };
}

function renderEventLabelRow(event) {
    const schema = getLabelSchemaForEvent(event);
    if (!schema) return null;

    const labelRow = document.createElement('div');
    labelRow.className = 'flex items-center gap-1.5 mb-2 flex-wrap';
    const labelTitle = document.createElement('span');
    labelTitle.className = 'text-xs font-semibold text-slate-700 mr-1';
    labelTitle.textContent = `${schema.group}:`;
    labelRow.appendChild(labelTitle);

    const activeText = event.labels?.find(l => l.group === schema.group)?.text;

    schema.options.forEach(opt => {
        const chip = document.createElement('button');
        chip.type = 'button';
        const isActive = activeText === opt.text;
        chip.className = `btn btn-compact text-xs label-chip ${isActive ? 'btn-primary is-active' : 'btn-secondary'}`;
        chip.textContent = opt.text;
        chip.setAttribute('aria-pressed', String(isActive));
        chip.addEventListener('click', (e) => {
            e.stopPropagation();
            updateEventLabel(event.id, schema.group, opt.text);
        });
        labelRow.appendChild(chip);
    });
    return labelRow;
}

function createEventTimeAdjustRow(event) {
    const timeRow = document.createElement('div');
    timeRow.className = 'flex items-center justify-between text-xs text-muted';
    timeRow.innerHTML = `
        <span>Adjust time:</span>
        <div class="flex items-center gap-1">
            <button type="button" class="btn btn-secondary btn-compact nudge-minus" title="1s earlier">-1s</button>
            <button type="button" class="btn btn-secondary btn-compact nudge-plus" title="1s later">+1s</button>
            <button type="button" class="btn btn-secondary btn-compact sync-playhead" title="Sync to video playhead">Sync</button>
        </div>
    `;

    timeRow.querySelector('.nudge-minus')?.addEventListener('click', (e) => {
        e.stopPropagation();
        retargetEventTime(event.id, Math.max(0, (event.timeMs / 1000) - 1));
    });
    timeRow.querySelector('.nudge-plus')?.addEventListener('click', (e) => {
        e.stopPropagation();
        retargetEventTime(event.id, (event.timeMs / 1000) + 1);
    });
    timeRow.querySelector('.sync-playhead')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const vid = document.getElementById('video-player');
        retargetEventTime(event.id, vid ? vid.currentTime : (event.timeMs / 1000));
    });

    return timeRow;
}

function createTimelineEventEditor(event, note) {
    const editorEl = document.createElement('div');
    editorEl.className = 'timeline-event-editor';

    const labelRow = renderEventLabelRow(event);
    if (labelRow) editorEl.appendChild(labelRow);

    const noteRow = document.createElement('div');
    noteRow.className = 'flex items-center gap-2 mb-2';

    const noteInput = document.createElement('input');
    noteInput.type = 'text';
    noteInput.className = 'field text-xs py-1 px-2 flex-1 event-note-input';
    noteInput.placeholder = 'Add coaching note (e.g., high press turnover)';
    noteInput.value = note;

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn btn-primary btn-compact';
    saveBtn.textContent = 'Save';

    noteRow.append(noteInput, saveBtn);

    const timeRow = createEventTimeAdjustRow(event);
    editorEl.append(noteRow, timeRow);

    const commitNote = () => {
        updateEventNote(event.id, noteInput.value);
        activeEditingEventId = null;
    };

    saveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        commitNote();
    });

    noteInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commitNote();
        } else if (e.key === 'Escape') {
            activeEditingEventId = null;
            renderTimelineEvents();
        }
    });

    return editorEl;
}

function closeAllMoreMenus() {
    document.querySelectorAll('.timeline-event-more-menu:not(.hidden)').forEach(m => m.classList.add('hidden'));
    document.querySelectorAll('.timeline-event-more-btn[aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
}

function createTimelineEventCard(event, index) {
    const eventElement = document.createElement('div');
    eventElement.className = 'timeline-event';
    const eventElementId = event.id || `event-${index}`;
    eventElement.dataset.eventId = eventElementId;
    eventElement.dataset.timeMs = String(event.timeMs || 0);

    const timeFormatted = formatTime(event.timeMs);
    const eventName = formatEventTypeName(event.event);
    const game = getCurrentGame() || { events: timelineEvents, metadata: {} };
    const isSaved = isEventInAnyPlaylist(game, event);
    const note = event.note ? String(event.note) : '';
    eventElement.title = note ? `${eventName} — ${note}` : eventName;

    const seekButton = createTimelineEventSeekButton(event, eventName, timeFormatted);
    const { saveWrapper, favoriteBtn, favoriteIcon, playlistPopover, moreWrapper, moreBtn, moreMenu, noteBtn, deleteBtn } =
        createTimelineEventActions(eventElementId, note, isSaved);

    eventElement.append(seekButton, saveWrapper, moreWrapper);

    if (activeEditingEventId === event.id) {
        eventElement.classList.add('has-editor');
        eventElement.appendChild(createTimelineEventEditor(event, note));
    }

    eventElement.addEventListener('click', (e) => {
        if (!e.target.closest('.timeline-event-action') && !e.target.closest('.timeline-event-editor') && !e.target.closest('.playlist-popover')) {
            jumpToEventTime(event);
            highlightTimelineEvent(eventElement.dataset.eventId);
        }
    });

    moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllSavePopovers();
        closePlaylistsDropdown();
        const isHidden = moreMenu.classList.contains('hidden');
        closeAllMoreMenus();
        if (isHidden) {
            moreMenu.classList.remove('hidden');
            moreBtn.setAttribute('aria-expanded', 'true');
        }
    });

    noteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        moreMenu.classList.add('hidden');
        moreBtn.setAttribute('aria-expanded', 'false');
        activeEditingEventId = (activeEditingEventId === event.id ? null : event.id);
        renderTimelineEvents();
    });

    favoriteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = playlistPopover.classList.contains('hidden');
        closeAllSavePopovers();
        closePlaylistsDropdown();
        closeAllMoreMenus();
        if (isHidden) {
            renderSavePopoverContent(playlistPopover, event, favoriteBtn, favoriteIcon);
            playlistPopover.classList.remove('hidden');
            favoriteBtn.setAttribute('aria-expanded', 'true');
        }
    });

    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        moreMenu.classList.add('hidden');
        deleteEvent(eventElement.dataset.eventId);
    });

    return eventElement;
}

function updateEmptyPlaylistTitle() {
    const titleEl = document.getElementById('playlist-empty-title');
    if (!titleEl) return;
    const game = getCurrentGame() || { events: timelineEvents, metadata: {} };
    const activePl = getGamePlaylists(game).find((p) => p.id === activePlaylistId);
    titleEl.textContent = activePl
        ? `No clips in "${activePl.name}" yet`
        : 'No clips in this playlist yet';
}

function updateTimelineEmptyStateUI(timelineContainer, timelineEvents, eventsToRender, favoritesOnly) {
    const favoritesEmptyState = document.getElementById('favorites-empty-state');
    const timelineEmptyState = document.getElementById('timeline-empty-state');
    const filterContainer = document.getElementById('timeline-filters');

    if (timelineEvents.length === 0) {
        timelineEmptyState?.classList.remove('hidden');
        favoritesEmptyState?.classList.add('hidden');
        timelineContainer.classList.add('hidden');
        filterContainer?.classList.add('hidden');
        return false;
    }

    filterContainer?.classList.remove('hidden');

    if (favoritesOnly && eventsToRender.length === 0) {
        if (favoritesEmptyState) {
            updateEmptyPlaylistTitle();
            favoritesEmptyState.classList.remove('hidden');
            if (filterContainer && filterContainer.nextElementSibling !== favoritesEmptyState) {
                filterContainer.parentNode.insertBefore(favoritesEmptyState, filterContainer.nextSibling);
            }
        }
        timelineEmptyState?.classList.add('hidden');
        timelineContainer.classList.add('hidden');
        return false;
    }

    favoritesEmptyState?.classList.add('hidden');
    timelineEmptyState?.classList.add('hidden');
    timelineContainer.classList.remove('hidden');
    return true;
}

// Render timeline with current events (sorted with earliest events at the top)
function renderTimelineEvents() {
    timelineNeedsRender = false;
    const timelineContainer = document.getElementById('timeline-events');
    syncFilterUI();
    if (!timelineContainer) return;

    try {
        const eventsToRender = getVisibleEvents();
        const hasVisible = updateTimelineEmptyStateUI(timelineContainer, timelineEvents, eventsToRender, favoritesOnly);
        if (!hasVisible) return;

        timelineContainer.innerHTML = '';
        eventsToRender.sort((a, b) => a.timeMs - b.timeMs);

        eventsToRender.forEach((event, index) => {
            timelineContainer.appendChild(createTimelineEventCard(event, index));
        });

        updateFilterToggleUI();
        console.log(`Timeline rendered with ${eventsToRender.length} events${favoritesOnly ? ' (favorites only)' : ''}`);
    } catch (error) {
        console.error("Error rendering timeline:", error);
        timelineContainer.innerHTML = '<p class="text-red-600">Could not load timeline events.</p>';
    }
}

// Get unique event types from timeline events
function getUniqueEventTypes(events) {
    const eventTypes = new Set();
    events.forEach(event => {
        if (event.event) {
            eventTypes.add(event.event);
        }
    });
    return Array.from(eventTypes).sort();
}

// Format event type name for display
function formatEventTypeName(eventType) {
    if (!eventType || typeof eventType !== 'string') {
        return '';
    }
    // Handle snake_case
    if (eventType.includes('_')) {
        return eventType
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    // Handle CamelCase
    if (/[a-z][A-Z]/.test(eventType)) {
        return eventType
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/\b\w/g, char => char.toUpperCase());
    }

    return eventType.charAt(0).toUpperCase() + eventType.slice(1).toLowerCase();
}

// Update filter dropdown based on available event types
// Rebuilds the type options; listeners that live outside the list are bound once in initFilterUI()
function updateEventFilters() {
    const optionsContainer = document.getElementById('filter-options-container');
    if (!optionsContainer) return;

    const eventTypes = getUniqueEventTypes(timelineEvents);
    eventTypes.sort((a, b) => formatEventTypeName(a).localeCompare(formatEventTypeName(b)));

    // Keep selections that still exist (e.g. after adding or deleting an event)
    activeTypeFilters = new Set(eventTypes.filter(type => activeTypeFilters.has(type)));

    optionsContainer.innerHTML = '';

    eventTypes.forEach((eventType, index) => {
        const optionWrapper = document.createElement('div');
        optionWrapper.className = 'flex items-center px-4 py-2 hover:bg-gray-100 cursor-pointer';

        // Index-based id: event types may contain spaces or collide with "all"
        const checkboxId = `filter-option-type-${index}`;
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = checkboxId;
        checkbox.className = 'filter-checkbox h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded';
        checkbox.setAttribute('data-filter', eventType);

        const label = document.createElement('label');
        label.htmlFor = checkboxId;
        label.className = 'ml-3 block text-sm font-medium text-gray-700 cursor-pointer w-full';
        label.textContent = formatEventTypeName(eventType);

        optionWrapper.appendChild(checkbox);
        optionWrapper.appendChild(label);

        // The label toggles the checkbox natively; click() on the row padding so `change` still fires
        optionWrapper.addEventListener('click', (e) => {
            if (e.target === optionWrapper) checkbox.click();
        });

        checkbox.addEventListener('change', () => {
            const next = new Set(activeTypeFilters);
            if (checkbox.checked) {
                next.add(eventType);
            } else {
                next.delete(eventType);
            }
            setTypeFilters(next);
        });

        optionsContainer.appendChild(optionWrapper);
    });

    syncFilterUI();
}

// Bind filter listeners that must only be attached once per page load
function initFilterUI() {
    const dropdownButton = document.getElementById('filter-dropdown-button');
    const dropdownPanel = document.getElementById('filter-dropdown-panel');
    const allCheckbox = document.getElementById('filter-option-all');
    if (!dropdownButton || !dropdownPanel || !allCheckbox) return;

    dropdownButton.addEventListener('click', () => {
        const expanded = dropdownButton.getAttribute('aria-expanded') === 'true';
        dropdownButton.setAttribute('aria-expanded', String(!expanded));
        dropdownPanel.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!dropdownButton.contains(e.target) && !dropdownPanel.contains(e.target)) {
            dropdownButton.setAttribute('aria-expanded', 'false');
            dropdownPanel.classList.add('hidden');
        }
    });

    // "All" is only uncheckable when nothing else is selected, so both directions mean "show all"
    allCheckbox.addEventListener('change', () => {
        setTypeFilters([]);
    });

    syncFilterUI();
}

// Reflect activeTypeFilters in the checkboxes, button text and tags
function syncFilterUI() {
    const allCheckbox = document.getElementById('filter-option-all');
    const selectedFiltersText = document.getElementById('selected-filters-text');
    const selectedFiltersTags = document.getElementById('selected-filters-tags');

    if (allCheckbox) allCheckbox.checked = activeTypeFilters.size === 0;
    document.querySelectorAll('#filter-options-container .filter-checkbox').forEach(cb => {
        cb.checked = activeTypeFilters.has(cb.getAttribute('data-filter'));
    });

    if (!selectedFiltersText || !selectedFiltersTags) return;

    selectedFiltersTags.innerHTML = '';
    if (activeTypeFilters.size === 0) {
        selectedFiltersText.textContent = 'All events';
        return;
    }

    const count = activeTypeFilters.size;
    selectedFiltersText.textContent = `${count} filter${count > 1 ? 's' : ''} selected`;

    activeTypeFilters.forEach(filter => {
        const tag = document.createElement('div');
        tag.className = 'filter-tag';

        const tagText = document.createElement('span');
        tagText.className = 'filter-tag-label';
        tagText.textContent = formatEventTypeName(filter);

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'filter-tag-remove';
        removeButton.innerHTML = '&times;';
        removeButton.setAttribute('aria-label', `Remove ${formatEventTypeName(filter)} filter`);

        removeButton.addEventListener('click', () => {
            const next = new Set(activeTypeFilters);
            next.delete(filter);
            setTypeFilters(next);
        });

        tag.appendChild(tagText);
        tag.appendChild(removeButton);
        selectedFiltersTags.appendChild(tag);
    });
}

/**
 * Show the "no game selected" message in place of the timeline
 */
function showNoGameSelectedState() {
    const noGameStateElement = document.getElementById('no-game-selected-state');
    const emptyStateElement = document.getElementById('timeline-empty-state');
    const timelineContainerElement = document.getElementById('timeline-events');

    if (noGameStateElement) noGameStateElement.classList.remove('hidden');
    if (emptyStateElement) emptyStateElement.classList.add('hidden');
    if (timelineContainerElement) timelineContainerElement.classList.add('hidden');
}

// Show the add-event and align-video buttons only when both a video and a game are loaded
function isVideoSourceLoaded(video) {
    if (!video || video.readyState === 0) return false;
    return Boolean(video.currentSrc || video.src || video.querySelector('source'));
}

function updateFabVisibility() {
    const fab = document.getElementById('add-event-fab');
    const alignBtn = document.getElementById('align-video-btn');
    const video = document.getElementById('video-player');
    const hasActiveGame = Boolean(currentGameId);
    const videoReady = isVideoSourceLoaded(video);
    const canAlign = videoReady && hasActiveGame;

    fab?.classList.toggle('hidden', !(canAlign && !isTaggingMode));
    alignBtn?.classList.toggle('hidden', !canAlign);
}

// Toggle favorite status for an event
function toggleFavorite(eventId) {
    // Find the event in current events
    const event = timelineEvents.find(e => e.id === eventId);
    if (!event) return;

    // Toggle favorite status
    event.isFavorite = !event.isFavorite;

    // Save changes to localStorage, preserving teams/game name
    if (currentGameId) {
        // Get the current game object from storage to access metadata and teams
        const savedGames = getSavedGames();
        const { game } = findGameById(savedGames, currentGameId);
        // Compose metadata with teams to ensure game name is preserved
        const metadata = game ? { ...game.metadata, teams: game.teams } : {};
        saveGame(currentGameId, timelineEvents, metadata);
    }

    renderTimelineEvents();
}

function domReady(callback) {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", callback);
    } else {
        callback();
    }
}

function initOutsideClickDismissal() {
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.timeline-event-more-wrapper')) {
            document.querySelectorAll('.timeline-event-more-menu:not(.hidden)').forEach(m => m.classList.add('hidden'));
            document.querySelectorAll('.timeline-event-more-btn[aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
        }
        if (!e.target.closest('.timeline-event-save-wrapper')) {
            closeAllSavePopovers();
        }
        if (!e.target.closest('.playlist-filter-bar')) {
            closePlaylistsDropdown();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const alignModal = document.getElementById('align-video-modal');
            if (alignModal && !alignModal.classList.contains('hidden')) {
                alignModal.classList.add('hidden');
            }
            document.querySelectorAll('.timeline-event-more-menu:not(.hidden)').forEach(m => m.classList.add('hidden'));
            document.querySelectorAll('.timeline-event-more-btn[aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
            closeAllSavePopovers();
            closePlaylistsDropdown();
        }
    });
}

function initPlaybackSpeedAndSeek() {
    document.querySelectorAll('[data-speed]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const spd = parseFloat(btn.getAttribute('data-speed'));
            setPlaybackRate(spd);
        });
    });

    const rewind5s = document.getElementById('rewind-5s');
    const forward5s = document.getElementById('forward-5s');
    if (rewind5s) rewind5s.addEventListener('click', () => { seekRelative(-5); });
    if (forward5s) forward5s.addEventListener('click', () => { seekRelative(5); });

    const customTagBtn = document.getElementById('add-custom-tag-btn');
    const modal = document.getElementById('add-event-modal');
    const timestampInput = document.getElementById('event-timestamp');
    const video = document.getElementById('video-player');
    if (customTagBtn && modal) {
        customTagBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openAddEventModal(modal, null, video, timestampInput);
        });
    }
}

function initTagReviewAndHistoryButtons() {
    const undoQuickTagBtn = document.getElementById('quick-tag-undo-btn');
    undoQuickTagBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        undoLastQuickTag();
    });

    const reviewModeBtn = document.getElementById('quick-tag-review-btn');
    reviewModeBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        setTimelineCollapsed(!isTimelineCollapsed);
    });

    const collapseTimelineBtn = document.getElementById('collapse-timeline-btn');
    collapseTimelineBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        setTimelineCollapsed(true);
    });
}

function initTeamsControl() {
    const teamsButton = document.getElementById('edit-match-teams-btn');
    teamsButton?.addEventListener('click', async (event) => {
        event.preventDefault();
        if (!canEditMatchTeams()) return;
        let teams = null;
        try {
            teams = await openTeamSetupDialog(getMatchTeams());
        } catch (_) {
            teams = null;
        }
        if (teams) applyConfirmedTeams(teams);
    });
    updateTeamsControl();
}

function initMatchTitleEditor() {
    const gameTitleEl = document.getElementById('review-game-title');
    const editTitleBtn = document.getElementById('edit-title-btn');
    const titleForm = document.getElementById('inline-title-form');
    const titleInput = document.getElementById('inline-title-input');
    const cancelTitleBtn = document.getElementById('cancel-title-btn');

    function resolveInitialTitleValue(current, el) {
        if (current && current.teams) return current.teams;
        return el ? el.textContent : '';
    }

    function openTitleEditor() {
        if (!titleForm || !titleInput) return;
        titleInput.value = resolveInitialTitleValue(getCurrentGame(), gameTitleEl);
        gameTitleEl?.classList.add('hidden');
        editTitleBtn?.classList.add('hidden');
        titleForm.classList.remove('hidden');
        titleInput.focus();
        titleInput.select();
    }

    function closeTitleEditor() {
        if (!titleForm) return;
        titleForm.classList.add('hidden');
        gameTitleEl?.classList.remove('hidden');
        editTitleBtn?.classList.remove('hidden');
    }

    if (gameTitleEl) gameTitleEl.addEventListener('click', openTitleEditor);
    if (editTitleBtn) editTitleBtn.addEventListener('click', openTitleEditor);
    if (cancelTitleBtn) cancelTitleBtn.addEventListener('click', closeTitleEditor);
    if (titleForm) {
        titleForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const newName = titleInput.value.trim();
            if (newName) {
                renameMatch(newName);
            }
            closeTitleEditor();
        });
    }

    const saveAndExitBtn = document.getElementById('save-and-exit-btn');
    if (saveAndExitBtn) {
        saveAndExitBtn.addEventListener('click', (e) => {
            e.preventDefault();
            saveAndExit();
        });
    }

    const openReportBtn = document.getElementById('open-match-report-btn');
    if (openReportBtn) {
        openReportBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!currentGameId) {
                notificationService.notify('No match currently loaded to report on.', 'warning');
                return;
            }
            const savedGames = getSavedGames();
            const { game } = findGameById(savedGames, currentGameId);
            if (game) {
                openMatchReport(game);
            } else {
                notificationService.notify('Current match could not be found.', 'error');
            }
        });
    }

    const startNewBtn = document.getElementById('start-new-video-game-btn');
    if (startNewBtn) {
        startNewBtn.addEventListener('click', (e) => {
            e.preventDefault();
            startNewVideoMatch();
        });
    }
}

function initAttachModalButtons() {
    const bindClick = (id, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', handler);
    };

    bindClick('attach-video-btn', () => openAttachVideoModal('url'));
    bindClick('open-attach-video-direct-btn', () => openAttachVideoModal('url'));
    bindClick('stage-attach-video-btn', () => openAttachVideoModal('url'));
    bindClick('stage-upload-file-btn', () => openAttachVideoModal('file'));
    bindClick('close-attach-video-modal', closeAttachVideoModal);
    bindClick('cancel-attach-url-btn', closeAttachVideoModal);
    bindClick('cancel-attach-file-btn', closeAttachVideoModal);
    bindClick('tab-attach-url', () => switchAttachVideoTab('url'));
    bindClick('tab-attach-file', () => switchAttachVideoTab('file'));
    bindClick('detach-video-btn', detachVideo);
    bindClick('change-video-url-btn', () => openAttachVideoModal('url'));

    const retryBtn = document.getElementById('retry-video-url-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            const errOverlay = document.getElementById('video-error-overlay');
            if (errOverlay) errOverlay.classList.add('hidden');
            const player = document.getElementById('video-player');
            if (player) {
                player.load();
                player.play().catch(e => console.warn('Retry play error:', e));
            }
        });
    }
}

function initVideoUrlInput() {
    const videoUrlInput = document.getElementById('video-url-input');
    const videoUrlWarning = document.getElementById('video-url-warning');
    const videoUrlWarningText = document.getElementById('video-url-warning-text');
    if (!videoUrlInput) return;

    function updateUrlWarning(warning) {
        if (!videoUrlWarning) return;
        const hasWarning = Boolean(warning && videoUrlWarningText);
        if (hasWarning) videoUrlWarningText.textContent = warning;
        videoUrlWarning.classList.toggle('hidden', !hasWarning);
    }

    videoUrlInput.addEventListener('input', () => {
        const check = validateVideoUrl(videoUrlInput.value);
        updateUrlWarning(check.warning);
    });

    videoUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (videoUrlInput.value.trim()) {
                attachVideoUrl(videoUrlInput.value.trim());
            }
        }
    });

    const submitBtn = document.getElementById('submit-attach-url-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', () => {
            if (videoUrlInput.value.trim()) {
                attachVideoUrl(videoUrlInput.value.trim());
            } else {
                showNotification('Please enter a video URL', 'error');
            }
        });
    }
}

function loadVideoFileToPlayer(file) {
    const player = document.getElementById('video-player');
    if (!player || !file) return;
    while (player.firstChild) player.removeChild(player.firstChild);
    const source = document.createElement('source');
    source.src = URL.createObjectURL(file);
    source.type = file.type;
    player.appendChild(source);
    player.load();
    const playPromise = player.play();
    if (playPromise !== undefined) {
        playPromise.catch(err => console.warn("Couldn't auto-play video:", err));
    }
}

function isValidVideoFile(file) {
    return Boolean(file && file.type && file.type.startsWith('video/'));
}

function syncGameWithSelectedVideo(fileName) {
    if (!currentGameId) {
        const baseName = fileName.replace(/\.[^/.]+$/, '');
        createNewVideoGame(baseName);
    } else {
        autoRenameFromVideo(fileName);
    }
    commitDraftGame();
}

function handleVideoFileSelection(file) {
    if (!isValidVideoFile(file)) {
        if (file) showNotification('Please select a valid video file', 'error');
        return;
    }
    syncGameWithSelectedVideo(file.name);
    loadVideoFileToPlayer(file);
}

function initVideoFileInputs() {
    const bindFileInput = (id, onLoaded) => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;
                handleVideoFileSelection(file);
                if (onLoaded) onLoaded();
            });
        }
    };

    bindFileInput('video-upload-direct');
    bindFileInput('video-upload');
    bindFileInput('video-modal-file-input', () => {
        updateVideoStageOverlays();
        updateCurrentVideoBanner();
        closeAttachVideoModal();
        updateFabVisibility();
        showNotification('Video file loaded', 'success');
    });
}

function initVideoAttachmentUI() {
    initVideoFileInputs();
    initAttachModalButtons();
    initVideoUrlInput();
}

function initVideoPlayerControls() {
    const videoPlayer = document.getElementById('video-player');
    if (!videoPlayer) {
        console.warn('Video player element not found.');
        return;
    }

    console.log('Video player element found.');

    const rewind10sButton = document.getElementById('rewind-10s');
    const forward10sButton = document.getElementById('forward-10s');

    if (rewind10sButton) {
        rewind10sButton.addEventListener('click', () => {
            if (videoPlayer.readyState > 0) {
                videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 10);
            }
        });
    }

    if (forward10sButton) {
        forward10sButton.addEventListener('click', () => {
            if (videoPlayer.readyState > 0) {
                videoPlayer.currentTime = Math.min(videoPlayer.duration, videoPlayer.currentTime + 10);
            }
        });
    }

    videoPlayer.addEventListener('error', () => {
        console.error('Video Player Error:', videoPlayer.error);
        const errorOverlay = document.getElementById('video-error-overlay');
        const errorMessageEl = document.getElementById('video-error-message');
        if (errorOverlay) {
            if (errorMessageEl) {
                errorMessageEl.textContent = 'Unable to stream video from this source. Please verify that the link is accessible and is a direct MP4 or WebM file.';
            }
            errorOverlay.classList.remove('hidden');
        }
    });

    document.addEventListener('timeline-event-clicked', (e) => {
        const { event, seekTime } = e.detail;
        console.log(`Seeking video to ${seekTime} seconds for event: ${event}`);

        try {
            if (videoPlayer.readyState > 0) {
                videoPlayer.currentTime = seekTime;
                if (videoPlayer.paused) {
                    videoPlayer.play().catch(err => {
                        console.warn("Couldn't auto-play video:", err);
                    });
                }
            } else {
                console.warn("Video not ready for seeking");
                showNotification("Video not loaded yet. Please try again.");
            }
        } catch (error) {
            console.error("Error seeking video:", error);
            showNotification("Error seeking video.");
        }
    });
}

domReady(() => {
    console.log('DOM fully loaded and parsed');

    const video = document.getElementById('video-player');
    if (video) {
        video.addEventListener('loadeddata', updateFabVisibility);
        video.addEventListener('emptied', updateFabVisibility);
    }

    initFilterUI();
    initAlignVideoModal();
    loadGameFromQuery();
    renderQuickTagButtons();
    initKeyboardShortcuts();

    initOutsideClickDismissal();
    initPlaybackSpeedAndSeek();
    initTagReviewAndHistoryButtons();
    initTeamsControl();
    initMatchTitleEditor();
    initVideoAttachmentUI();
    initVideoPlayerControls();
});
// Load the game named by the ?game=<id> query parameter, set by the Saved Games list
function loadGameFromQuery() {
    checkAndApplyMockSeed();
    const params = new URLSearchParams(window.location.search);
    const gameId = params.get('game');
    const isNewVideo = params.get('new') === 'video';
    const initialMode = params.get('mode');

    if (isNewVideo) {
        startNewVideoMatch();
        return;
    }

    if (gameId === SAMPLE_GAME_ID) {
        ensureSampleGameExists();
    }
    if (initialMode === 'tag') {
        setTaggingMode(true);
    }
    if (!gameId || !loadGame(gameId)) {
        showNoGameSelectedState();
    }
}

// Jump to a specific time or event in the video
function jumpToVideoTime(timeOrEvent, leadSeconds = 0) {
    const videoPlayer = document.getElementById('video-player');
    if (!videoPlayer) return;

    if (timeOrEvent && typeof timeOrEvent === 'object' && timeOrEvent.timeMs !== undefined) {
        jumpToEventTime(timeOrEvent);
        return;
    }

    const timeMs = Number(timeOrEvent) || 0;
    const timeSeconds = Math.max(0, (timeMs / 1000) - (Number(leadSeconds) || 0));
    videoPlayer.currentTime = timeSeconds;
    videoPlayer.play().catch(e => console.error("Error playing video:", e));
}

export {
    validateVideoUrl,
    attachVideoUrl,
    detachVideo,
    openAttachVideoModal,
    closeAttachVideoModal,
    switchAttachVideoTab,
    updateVideoStageOverlays,
    updateCurrentVideoBanner,
    CORE_QUICK_TAGS,
    DEFAULT_QUICK_TAGS,
    loadQuickTags,
    canEditMatchTeams,
    applyConfirmedTeams,
    startNewVideoMatch,
    resolveTagDisplay,
    parseTeamsFromString,
    createTimelineEventSeekButton,
    createTimelineEventCard,
    getMatchTeams,
    setMatchTeams,
    swapMatchTeams,
    undoLastQuickTag,
    setTaggingMode,
    setTimelineCollapsed,
    updateQuickTagTicker,
    quickTagEvent,
    handleVideoCodingKey,
    selectVideoZone,
    prepareZoneAwareLabel,
    createNewVideoGame,
    commitDraftGame,
    renameMatch,
    autoRenameFromVideo,
    saveAndExit,
    getCurrentGame,
    updateTitleUI,
    updateSaveStatusUI,
    updateEventNote,
    retargetEventTime,
    setPlaybackRate,
    seekRelative,
    getVisibleEvents,
    setTypeFilters,
    setFavoritesOnly,
    updateEventFilters,
    loadGame,
    deleteEvent,
    toggleFavorite,
    formatTime,
    parseTime,
    updateFabVisibility,
    showQuickTagFeedback,
    setFilterViewMode,
    getFilterViewMode,
    getUnlabelledEventsCount,
    updateEventLabel,
    initLabelSweep,
    startLabelSweep,
    exitLabelSweep,
    applySweepLabel,
    replayCurrentSweepClip,
    shiftGameTimings,
    revertGameTimings,
    initAlignVideoModal,
    loadVideoFileToPlayer,
    handleVideoFileSelection,
    getDefaultClipTimings,
    jumpToEventTime,
    jumpToVideoTime,
    buildAlignmentPreviewState,
    initFavoritesUI,
    initPresentationMode
};

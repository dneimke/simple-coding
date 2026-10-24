import { renderTimeline } from './timeline.js';
import { storageService } from '../services/storageService.js';
import { notificationService } from '../services/notificationService.js';
import { generateGameId } from '../services/gameStorageManager.js';
import { checkAndApplyMockSeed, ensureSampleGameExists, SAMPLE_GAME_ID } from '../utils/seedData.js';

const DEFAULT_QUICK_TAGS = [
    { id: 'goal', label: 'Goal', colorClass: 'btn-green', key: '1' },
    { id: 'shot', label: 'Shot', colorClass: 'btn-blue', key: '2' },
    { id: 'circle-entry', label: 'Circle Entry', colorClass: 'btn-accent-purple', key: '3' },
    { id: 'penalty-corner', label: 'Penalty Corner', colorClass: 'btn-yellow', key: '4' },
    { id: 'turnover', label: 'Turnover', colorClass: 'btn-orange', key: '5' },
    { id: 'card-foul', label: 'Card / Foul', colorClass: 'btn-red', key: '6' }
];

const CORE_QUICK_TAGS = DEFAULT_QUICK_TAGS;

const QUICK_TAG_COLORS = [
    { label: 'Green', colorClass: 'btn-green', hex: '#16a34a' },
    { label: 'Blue', colorClass: 'btn-blue', hex: '#2563eb' },
    { label: 'Purple', colorClass: 'btn-accent-purple', hex: '#7c3aed' },
    { label: 'Yellow', colorClass: 'btn-yellow', hex: '#ca8a04' },
    { label: 'Orange', colorClass: 'btn-orange', hex: '#ea580c' },
    { label: 'Red', colorClass: 'btn-red', hex: '#dc2626' }
];

const LOCAL_STORAGE_KEY_GAMES = 'fieldHockeyGames_v1';
const LOCAL_STORAGE_KEY_QUICK_TAGS = 'fieldHockeyVideoQuickTags_v1';
let currentGameId = null;
let timelineEvents = [];
let activeTypeFilters = new Set();
let favoritesOnly = false;
let presentationModeActive = false;
let isTaggingMode = false;
let isEditingQuickTags = false;
let selectedNewTagColor = 'btn-blue';
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

// Utility: Parse mm:ss to seconds
function parseTime(str) {
    if (!str || typeof str !== 'string') return 0;
    const parts = str.split(':').map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return parts[0] * 60 + parts[1];
    }
    const num = Number(str);
    return isNaN(num) ? 0 : num;
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
        } else if (currentGameId) {
            statusIndicator.innerHTML = '<span class="text-slate-600"><i class="fas fa-check-circle text-emerald-600 mr-1"></i>Saved</span>';
            statusIndicator.classList.remove('hidden');
        } else {
            statusIndicator.classList.add('hidden');
        }
    }
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
        const committed = currentDraftGame;
        currentDraftGame = null;
        updateSaveStatusUI();
        showNotification('Match saved to Matches');
        return committed;
    }
    return getCurrentGame();
}

// Rename match title in memory and storage
function renameMatch(newName) {
    const trimmed = String(newName || '').trim();
    if (!trimmed) return false;

    const game = getCurrentGame();
    if (!game) return false;

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

// Save & Exit to Saved Games
function saveAndExit() {
    if (currentDraftGame && currentDraftGame.id === currentGameId) {
        if (currentDraftGame.events.length > 0 || (currentDraftGame.metadata && currentDraftGame.metadata.hasVideo)) {
            commitDraftGame();
        }
    }
    if (typeof window !== 'undefined') {
        window.location.href = 'index.html#saved-games';
    }
}

// Auto-create or initialize a new video match draft (not saved until event or video is added)
function createNewVideoGame(customName) {
    const gameId = generateGameId();
    const now = new Date();
    const dateStr = now.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const teams = customName || `Video Match — ${dateStr}`;
    const newGame = {
        id: gameId,
        events: [],
        teams,
        timestamp: now.toISOString(),
        metadata: {
            source: 'video',
            isDraft: true,
            created: now.toISOString(),
            lastUpdated: now.toISOString()
        }
    };

    currentDraftGame = newGame;
    currentGameId = gameId;
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

    updateTitleUI(teams);
    updateSaveStatusUI();
    updateEventFilters();
    renderTimelineEvents();
    updateQuickTagTicker();
    setTimelineCollapsed(true);
    setTaggingMode(true);

    return newGame;
}

// Quick-tag an event at the current video playhead (1-tap, non-blocking)
function quickTagEvent(eventType, note = '') {
    const video = document.getElementById('video-player');
    const sec = video ? (video.currentTime || 0) : 0;
    const timeMs = Math.round(sec * 1000);
    const ts = formatTime(sec);

    let game = getCurrentGame();
    if (!game) {
        game = createNewVideoGame();
    }

    // Auto-commit draft game if this is the first event logged
    if (currentDraftGame && currentDraftGame.id === game.id) {
        commitDraftGame();
        game = getCurrentGame();
    }

    if (!Array.isArray(game.events)) game.events = [];
    const newEvent = {
        id: generateEventId(),
        event: eventType,
        note,
        timestamp: ts,
        timeMs,
        isFavorite: false
    };
    game.events.push(newEvent);

    const metadata = (game && game.metadata) ? { ...game.metadata } : {};
    saveGame(game.id, game.events, metadata);

    const savedGames = getSavedGames();
    if (game.teams) {
        const { game: existing, index } = findGameById(savedGames, game.id);
        if (existing) {
            existing.teams = game.teams;
            savedGames[index] = existing;
            storageService.setItem(LOCAL_STORAGE_KEY_GAMES, savedGames);
        }
    }

    timelineEvents = game.events;
    updateEventFilters();
    renderTimelineEvents();
    updateQuickTagTicker();

    showQuickTagFeedback(eventType, ts);
    highlightTimelineEvent(newEvent.id);

    return newEvent;
}

// Update note for slow analysis pass
function updateEventNote(eventId, note) {
    if (!currentGameId) return false;
    const savedGames = getSavedGames();
    const { game } = findGameById(savedGames, currentGameId);
    if (!game || !Array.isArray(game.events)) return false;

    const event = game.events.find(e => e.id === eventId);
    if (!event) return false;

    event.note = String(note || '').trim();
    const metadata = { ...game.metadata, teams: game.teams };
    saveGame(game.id, game.events, metadata);
    timelineEvents = game.events;
    renderTimelineEvents();
    return true;
}

// Nudge or retarget event timestamp
function retargetEventTime(eventId, timeSeconds) {
    if (!currentGameId) return false;
    const savedGames = getSavedGames();
    const { game } = findGameById(savedGames, currentGameId);
    if (!game || !Array.isArray(game.events)) return false;

    const event = game.events.find(e => e.id === eventId);
    if (!event) return false;

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

// Load quick tags from storage or fall back to defaults
function loadQuickTags() {
    try {
        const stored = storageService.getItem(LOCAL_STORAGE_KEY_QUICK_TAGS);
        if (Array.isArray(stored) && stored.length > 0) {
            return stored.map((t, i) => ({
                id: t.id || `tag-${i}`,
                label: String(t.label || 'Tag').trim(),
                colorClass: t.colorClass || 'btn-blue',
                key: String(i + 1 <= 9 ? i + 1 : '')
            }));
        }
    } catch (_) {}
    return DEFAULT_QUICK_TAGS.map(t => ({ ...t }));
}

// Persist quick tags in storage
function saveQuickTags(tags) {
    if (!Array.isArray(tags)) return [];
    const sanitized = tags.map((t, i) => ({
        id: t.id || `tag-${i}`,
        label: String(t.label || 'Tag').trim(),
        colorClass: t.colorClass || 'btn-blue',
        key: String(i + 1 <= 9 ? i + 1 : '')
    }));
    storageService.setItem(LOCAL_STORAGE_KEY_QUICK_TAGS, sanitized);
    return sanitized;
}

// Add a new quick tag
function addQuickTag(label, colorClass = 'btn-blue') {
    const trimmed = String(label || '').trim();
    if (!trimmed) return loadQuickTags();
    const current = loadQuickTags();
    const id = 'tag-' + trimmed.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString(36);
    const newTag = {
        id,
        label: trimmed,
        colorClass,
        key: String(current.length + 1 <= 9 ? current.length + 1 : '')
    };
    current.push(newTag);
    saveQuickTags(current);
    renderQuickTagButtons();
    return current;
}

// Remove a quick tag by ID and re-index shortcut keys
function removeQuickTag(tagId) {
    const current = loadQuickTags();
    const filtered = current.filter(t => t.id !== tagId);
    saveQuickTags(filtered);
    renderQuickTagButtons();
    return loadQuickTags();
}

// Reset quick tags to 6 defaults
function resetQuickTags() {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(LOCAL_STORAGE_KEY_QUICK_TAGS);
        }
    } catch (_) {}
    renderQuickTagButtons();
    return DEFAULT_QUICK_TAGS.map(t => ({ ...t }));
}

// 1-Tap Undo for last logged event during video tagging
function undoLastQuickTag() {
    if (!currentGameId) return false;
    const savedGames = getSavedGames();
    const { game } = findGameById(savedGames, currentGameId);
    if (!game || !Array.isArray(game.events) || game.events.length === 0) return false;

    const removedEvent = game.events.pop();
    const metadata = { ...game.metadata, teams: game.teams };
    saveGame(game.id, game.events, metadata);
    timelineEvents = game.events;
    updateEventFilters();
    renderTimelineEvents();
    updateQuickTagTicker();
    showNotification(`Undid ${formatEventTypeName(removedEvent.event)}`, 'info');
    return true;
}

// Update Focus Tagging Ticker (Last event + Undo status + Event count)
function updateQuickTagTicker() {
    const tickerLast = document.getElementById('ticker-last-event');
    const undoBtn = document.getElementById('quick-tag-undo-btn');
    const countSpan = document.getElementById('ticker-event-count');
    const game = getCurrentGame();
    const events = (game && Array.isArray(game.events)) ? game.events : [];

    if (countSpan) {
        countSpan.textContent = events.length.toString();
    }
    const timelineCounter = document.getElementById('timeline-events-counter');
    if (timelineCounter) {
        timelineCounter.textContent = events.length.toString();
    }

    if (!events.length) {
        if (tickerLast) tickerLast.textContent = 'No events logged yet';
        if (undoBtn) {
            undoBtn.disabled = true;
            undoBtn.classList.add('opacity-40');
        }
        return;
    }

    const last = events[events.length - 1];
    if (tickerLast) {
        tickerLast.textContent = `${formatEventTypeName(last.event)} (${last.timestamp || formatTime(last.timeMs)})`;
    }
    if (undoBtn) {
        undoBtn.disabled = false;
        undoBtn.classList.remove('opacity-40');
    }
}

let isTimelineCollapsed = false;

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

// Render color pills for adding a new tag
function renderQuickTagColorSelector() {
    const container = document.getElementById('new-tag-color-selector');
    if (!container) return;
    container.innerHTML = '';

    QUICK_TAG_COLORS.forEach(c => {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = `color-pill-btn ${c.colorClass} ${c.colorClass === selectedNewTagColor ? 'is-selected' : ''}`;
        pill.setAttribute('aria-label', `Select color ${c.label}`);
        pill.title = c.label;
        pill.addEventListener('click', (e) => {
            e.preventDefault();
            selectedNewTagColor = c.colorClass;
            renderQuickTagColorSelector();
        });
        container.appendChild(pill);
    });
}

// Render quick tag buttons (supports normal 1-tap mode and edit/delete mode)
function renderQuickTagButtons() {
    const container = document.getElementById('quick-tags-container');
    const hintSpan = document.getElementById('quick-tag-hint');
    if (!container) return;
    container.innerHTML = '';

    const tags = loadQuickTags();
    if (hintSpan) {
        hintSpan.textContent = `(Tap or press 1–${Math.min(tags.length, 9)} during playback)`;
    }

    tags.forEach((tag) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `quick-tag-btn ${tag.colorClass}`;
        btn.setAttribute('data-quick-tag', tag.label);
        btn.setAttribute('data-tag-id', tag.id);
        btn.setAttribute('aria-label', `Tag ${tag.label} (Press ${tag.key || ''})`);

        const labelSpan = document.createElement('span');
        labelSpan.className = 'tag-label';
        labelSpan.textContent = tag.label;

        const keySpan = document.createElement('span');
        keySpan.className = 'tag-shortcut';
        keySpan.textContent = tag.key ? `[${tag.key}]` : '';

        btn.append(labelSpan, keySpan);

        if (isEditingQuickTags) {
            const delBadge = document.createElement('button');
            delBadge.type = 'button';
            delBadge.className = 'quick-tag-delete-badge';
            delBadge.setAttribute('aria-label', `Remove tag ${tag.label}`);
            delBadge.title = `Remove ${tag.label}`;
            delBadge.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';
            delBadge.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                removeQuickTag(tag.id);
            });
            btn.appendChild(delBadge);
        } else {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                quickTagEvent(tag.label);
            });
        }

        container.appendChild(btn);
    });
}

// Keyboard navigation and hotkey coding
function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        const target = e.target;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
            return;
        }

        const video = document.getElementById('video-player');
        if (!video) return;

        if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
            e.preventDefault();
            undoLastQuickTag();
            return;
        }

        if (e.code === 'Space') {
            e.preventDefault();
            if (video.paused) {
                video.play().catch(() => {});
            } else {
                video.pause();
            }
            return;
        }

        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            seekRelative(-5);
            return;
        }
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            seekRelative(5);
            return;
        }

        if (e.key === 'j' || e.key === 'J') {
            seekRelative(-10);
            return;
        }
        if (e.key === 'l' || e.key === 'L') {
            seekRelative(10);
            return;
        }
        if (e.key === 'k' || e.key === 'K') {
            if (video.paused) video.play().catch(() => {});
            else video.pause();
            return;
        }

        const keyNum = parseInt(e.key, 10);
        const tags = loadQuickTags();
        if (keyNum >= 1 && keyNum <= tags.length) {
            e.preventDefault();
            const tagDef = tags[keyNum - 1];
            if (tagDef) {
                quickTagEvent(tagDef.label);
            }
        }
    });
}

// --- FAB and Add Event Modal Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const fab = document.getElementById('add-event-fab');
    const modal = document.getElementById('add-event-modal');
    const closeBtn = document.getElementById('close-add-event-modal');
    const cancelBtn = document.getElementById('cancel-add-event');
    const form = document.getElementById('add-event-form');
    const timestampInput = document.getElementById('event-timestamp');
    const video = document.getElementById('video-player');

    // Show modal and fill timestamp
    function openModal() {
        if (video && !video.paused) video.pause();
        if (timestampInput && video) {
            timestampInput.value = formatTime(video.currentTime);
        }
        modal.classList.remove('hidden');
        setTimeout(() => {
            const firstInput = form.querySelector('input:not([readonly])');
            if (firstInput) firstInput.focus();
        }, 100);
    }

    // Hide modal
    function closeModal() {
        modal.classList.add('hidden');
        form.reset();
    }

    if (fab) {
        fab.addEventListener('click', (e) => {
            e.preventDefault();
            openModal();
        });
    }
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
    });

    // Handle add event form submit
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const type = form['event-type'].value.trim();
            const note = form['event-note'].value.trim();
            const ts = timestampInput.value;
            let game = getCurrentGame();
            if (!game) {
                game = createNewVideoGame();
            }

            if (!Array.isArray(game.events)) game.events = [];
            game.events.push({
                event: type,
                note,
                timestamp: ts,
                timeMs: parseTime(ts) * 1000,
                id: generateEventId()
            });

            const metadata = (game && game.metadata) ? { ...game.metadata } : {};
            saveGame(game.id, game.events, metadata);

            const savedGames = getSavedGames();
            if (game.teams) {
                const { game: existing, index } = findGameById(savedGames, game.id);
                if (existing) {
                    existing.teams = game.teams;
                    savedGames[index] = existing;
                    storageService.setItem(LOCAL_STORAGE_KEY_GAMES, savedGames);
                }
            }
            timelineEvents = game.events;
            updateEventFilters();
            renderTimelineEvents();
            closeModal();
        });
    }

    updateFavoritesToggleUI();
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

function findGameById(gamesArray, gameId) {
    if (!Array.isArray(gamesArray)) return { game: null, index: -1 };
    const index = gamesArray.findIndex(g => g && g.id === gameId);
    return { game: index >= 0 ? gamesArray[index] : null, index };
}

// Initialize navigation functionality
document.addEventListener('DOMContentLoaded', () => {
    // Set up mobile menu toggle
    initMobileMenu();

    // Set up favorites toggle and playlist functionality
    initFavoritesUI();
    initPresentationMode();
});

// Initialize mobile menu functionality
function initMobileMenu() {
    const mobileMenuButton = document.getElementById('mobileMenuButton');
    const mainMenu = document.getElementById('mainMenu');

    if (mobileMenuButton && mainMenu) {
        mobileMenuButton.addEventListener('click', () => {
            const isOpen = !mainMenu.classList.contains('hidden');

            if (isOpen) {
                // Close menu with smooth transition
                mainMenu.classList.add('opacity-0');
                setTimeout(() => {
                    mainMenu.classList.add('hidden');
                    mainMenu.classList.remove('opacity-0');
                }, 200);
                mobileMenuButton.innerHTML = '<i class="fas fa-bars text-xl"></i>';
                mobileMenuButton.setAttribute('aria-expanded', 'false');
            } else {
                // Open menu with smooth transition
                mainMenu.classList.remove('hidden');
                // Small delay to allow the display change before starting opacity transition
                setTimeout(() => {
                    mainMenu.classList.add('flex');
                }, 10);
                mobileMenuButton.innerHTML = '<i class="fas fa-times text-xl"></i>';
                mobileMenuButton.setAttribute('aria-expanded', 'true');
            }
        });
    }
    // Initialize with menu closed
    mobileMenuButton.setAttribute('aria-expanded', 'false');
}

// Initialize favorites UI and handlers
function initFavoritesUI() {
    const showAllBtn = document.getElementById('show-all-events');
    const showFavoritesBtn = document.getElementById('show-favorites');

    if (showAllBtn && showFavoritesBtn) {
        showAllBtn.addEventListener('click', () => {
            showAllEvents();
        });

        showFavoritesBtn.addEventListener('click', () => {
            showFavoritesOnly();
        });
    }
}

// Initialize presentation mode functionality
function initPresentationMode() {
    const presentationModeBtn = document.getElementById('presentation-mode');
    const playlistControls = document.getElementById('playlist-controls');
    const prevFavoriteBtn = document.getElementById('prev-favorite');
    const nextFavoriteBtn = document.getElementById('next-favorite');

    if (presentationModeBtn && playlistControls) {
        presentationModeBtn.addEventListener('click', () => {
            togglePresentationMode();
        });

        if (prevFavoriteBtn && nextFavoriteBtn) {
            prevFavoriteBtn.addEventListener('click', () => {
                navigatePlaylist('previous');
            });

            nextFavoriteBtn.addEventListener('click', () => {
                navigatePlaylist('next');
            });
        }
    }
}

// Toggle between presentation mode and normal mode
function togglePresentationMode() {
    presentationModeActive = !presentationModeActive;
    const presentationModeBtn = document.getElementById('presentation-mode');
    const playlistControls = document.getElementById('playlist-controls');
    const timelineContainer = document.getElementById('timeline-container');

    if (presentationModeActive) {
        // First, filter out only favorite events
        favoriteEvents = timelineEvents.filter(event => event.isFavorite);

        // Ensure all favorite events have a unique id
        favoriteEvents.forEach((evt, idx) => {
            if (!evt.id) evt.id = `event-fav-${idx}`;
        });

        // If no favorites, show notification and exit presentation mode
        if (favoriteEvents.length === 0) {
            showNotification('Add some favorites first to start a presentation', 'warning');
            presentationModeActive = false;
            return;
        }

        // Enter presentation mode
        presentationModeBtn.classList.add('is-active');
        presentationModeBtn.setAttribute('aria-pressed', 'true');
        playlistControls.classList.replace('hidden', 'flex');

        // Give the video the full width
        timelineContainer.classList.add('hidden');

        // Reset playlist position and navigate to first favorite
        currentPlaylistIndex = 0;
        updatePlaylistCounter();
        // Render timeline filtered to favorites before jumping
        setFavoritesOnly(true);
        if (favoriteEvents.length > 0) {
            setTimeout(() => {
                jumpToEventTime(favoriteEvents[0]);
            }, 50); // Allow DOM update
        }
    } else {
        // Exit presentation mode
        presentationModeBtn.classList.remove('is-active');
        presentationModeBtn.setAttribute('aria-pressed', 'false');
        playlistControls.classList.replace('flex', 'hidden');

        // Restore original layout
        timelineContainer.classList.remove('hidden');

        // Hide overlay when exiting presentation mode
        updatePresentationOverlay(null);
    }
}

// Navigate through the playlist of favorite events
function navigatePlaylist(direction) {
    if (favoriteEvents.length === 0) return;

    if (direction === 'next') {
        currentPlaylistIndex = (currentPlaylistIndex + 1) % favoriteEvents.length;
    } else {
        currentPlaylistIndex = (currentPlaylistIndex - 1 + favoriteEvents.length) % favoriteEvents.length;
    }

    updatePlaylistCounter();
    jumpToEventTime(favoriteEvents[currentPlaylistIndex]);
}

// Update the playlist counter display
function updatePlaylistCounter() {
    const counter = document.getElementById('playlist-counter');
    if (counter && favoriteEvents.length > 0) {
        counter.textContent = `${currentPlaylistIndex + 1}/${favoriteEvents.length}`;
    }
}

// Jump to a specific event time in the video
function jumpToEventTime(event) {
    const videoPlayer = document.getElementById('video-player');
    if (!videoPlayer || !event || !event.timeMs) return;

    // Convert milliseconds to seconds
    const timeSeconds = event.timeMs / 1000;
    videoPlayer.currentTime = timeSeconds;

    // Start playing from this point
    videoPlayer.play().catch(e => console.error("Error playing video:", e));

    // Highlight the event in the timeline (fallback if id is missing)
    if (event.id) {
        highlightTimelineEvent(event.id);
    } else {
        // Try to highlight by time if id is missing
        const events = document.querySelectorAll('.timeline-event');
        for (const el of events) {
            if (el.textContent.includes(formatTime(event.timeMs))) {
                el.classList.add('is-active');
                if (typeof el.scrollIntoView === 'function') {
                    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
                break;
            }
        }
    }

    // Show overlay with tag and description if in presentation mode
    updatePresentationOverlay(event);
}

// Update the presentation overlay with tag and description
function updatePresentationOverlay(event) {
    const overlay = document.getElementById('presentation-overlay');
    const tag = document.getElementById('presentation-tag');
    const desc = document.getElementById('presentation-description');
    if (!overlay || !tag || !desc) {
        console.warn('Presentation overlay elements not found.');
        return;
    }

    // Debug: Log event and mode
    console.log('updatePresentationOverlay called', { presentationModeActive, event });

    // Only show overlay in presentation mode
    if (presentationModeActive && event) {
        tag.textContent = formatEventTypeName(event.event);
        desc.textContent = event.note || '';
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
    }
}

// Highlight the current event in the timeline
function highlightTimelineEvent(eventId) {
    // Remove highlight from all events
    const events = document.querySelectorAll('.timeline-event');
    events.forEach(el => {
        el.classList.remove('is-active');
    });

    // Add highlight to current event
    const currentEvent = document.querySelector(`.timeline-event[data-event-id="${eventId}"]`);
    if (currentEvent) {
        currentEvent.classList.add('is-active');

        // Scroll to make event visible if needed
        if (typeof currentEvent.scrollIntoView === 'function') {
            currentEvent.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
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

// Game management functions
function getSavedGames() {
    const storedGames = storageService.getItem(LOCAL_STORAGE_KEY_GAMES);
    const { games: normalized, changed } = normalizeSavedGamesToArray(storedGames);
    if (!normalized || normalized.length === 0) return [];

    // If normalization assigned ids or transformed object shape, persist the updated array
    if (changed) {
        try {
            storageService.setItem(LOCAL_STORAGE_KEY_GAMES, normalized);
        } catch (e) {
            console.warn('Failed to persist normalized saved games', e);
        }
    }

    return normalized;
}

function saveGame(gameId, events, metadata = {}) {
    const savedGames = getSavedGames() || [];

    // Ensure all events are in standard format while preserving any existing properties (eventCode, team, leadTime, lagTime, etc.)
    const standardEvents = events.map(evt => ({
        ...evt,
        event: evt.event,
        timeMs: evt.timeMs,
        id: evt.id,
        isFavorite: evt.isFavorite || false,
        ...(evt.note !== undefined && { note: evt.note }),
        ...(evt.timestamp !== undefined && { timestamp: evt.timestamp }),
        ...(evt.lead !== undefined && { lead: evt.lead }),
        ...(evt.lag !== undefined && { lag: evt.lag })
    }));

    // Preserve existing entry fields (timestamp, teams, teamCodes, elapsedTime, metadata) when possible
    const { game: existing, index } = findGameById(savedGames, gameId);
    const existingTeams = (existing && (existing.teams || (existing.metadata && existing.metadata.teams))) || null;
    const existingTimestamp = (existing && (existing.timestamp || (existing.metadata && existing.metadata.timestamp))) || null;

    const teamsName = metadata.teams ?? existingTeams ?? null;
    const timestamp = existingTimestamp ?? new Date().toISOString();
    const maxEventTimeMs = standardEvents.reduce((max, e) => Math.max(max, Number(e.timeMs) || 0), 0);
    const reconciledElapsedTime = Math.max(Number(existing && existing.elapsedTime) || 0, maxEventTimeMs);
    const shouldIncludeElapsedTime = (existing && existing.elapsedTime !== undefined) || maxEventTimeMs > 0;

    // Merge metadata, preferring incoming metadata but keeping existing metadata where absent
    const mergedMetadata = {
        ...((existing && existing.metadata) || {}),
        ...metadata,
        lastUpdated: new Date().toISOString()
    };

    // Create or update game in the saved games object, keeping top-level properties for compatibility
    const mergedGame = {
        ...(existing || {}),
        id: gameId,
        events: standardEvents,
        teams: teamsName,
        timestamp,
        ...(shouldIncludeElapsedTime && { elapsedTime: reconciledElapsedTime }),
        metadata: mergedMetadata
    };

    if (index >= 0) {
        savedGames[index] = mergedGame;
    } else {
        savedGames.unshift(mergedGame);
    }

    // Save to localStorage using storage service
    const result = storageService.setItem(LOCAL_STORAGE_KEY_GAMES, savedGames);
    if (result === true) {
        return true;
    } else {
        console.error("Error saving game:", result.message);
        showNotification("Error saving game: " + result.message, "error");
        return false;
    }
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
                    evt.isFavorite = false;
                }
            });
            // If any ids were added, persist the update
            if (needsResave) {
                saveGame(gameId, events, game.metadata);
            }

            // Store current game ID
            currentGameId = gameId;

            // Update current events and render timeline
            timelineEvents = events;
            updateEventFilters();
            renderTimelineEvents();
            updateQuickTagTicker();

            const displayName = game.teams || gameId;
            updateTitleUI(displayName);
            updateSaveStatusUI();
            updateFabVisibility();

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



// Events that pass both the type filter and the favorites toggle
function getVisibleEvents() {
    return timelineEvents.filter(event =>
        (activeTypeFilters.size === 0 || activeTypeFilters.has(event.event)) &&
        (!favoritesOnly || event.isFavorite)
    );
}

function setTypeFilters(types) {
    activeTypeFilters = new Set(types);
    renderTimelineEvents();
}

function setFavoritesOnly(value) {
    favoritesOnly = value;
    updateFavoritesToggleUI();
    renderTimelineEvents();
}

function updateFavoritesToggleUI() {
    const showAllBtn = document.getElementById('show-all-events');
    const showFavoritesBtn = document.getElementById('show-favorites');
    if (!showAllBtn || !showFavoritesBtn) return;

    const [activeBtn, inactiveBtn] = favoritesOnly
        ? [showFavoritesBtn, showAllBtn]
        : [showAllBtn, showFavoritesBtn];
    activeBtn.classList.add('is-active');
    activeBtn.setAttribute('aria-pressed', 'true');
    inactiveBtn.classList.remove('is-active');
    inactiveBtn.setAttribute('aria-pressed', 'false');
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
    // Ensure teams property is preserved when saving
    const metadata = { ...game.metadata, teams: game.teams };
    saveGame(game.id, game.events, metadata);
    timelineEvents = game.events;
    updateEventFilters();
    renderTimelineEvents();
    updateQuickTagTicker();
    showNotification('Event deleted', 'info');
}

// Render timeline with current events (sorted with earliest events at the top)
function renderTimelineEvents() {
    const timelineContainerId = 'timeline-events';
    const timelineContainer = document.getElementById(timelineContainerId);
    const favoritesEmptyState = document.getElementById('favorites-empty-state');
    const timelineEmptyState = document.getElementById('timeline-empty-state');

    syncFilterUI();

    if (!timelineContainer) return;

    try {
        const eventsToRender = getVisibleEvents();

        // Check if there are events to display
        if (timelineEvents.length === 0) {
            // No events at all - show regular empty state
            if (timelineEmptyState) timelineEmptyState.classList.remove('hidden');
            if (favoritesEmptyState) favoritesEmptyState.classList.add('hidden');
            timelineContainer.classList.add('hidden');

            // Hide filter container
            const filterContainer = document.getElementById('timeline-filters');
            if (filterContainer) {
                filterContainer.classList.add('hidden');
            }

            return;
        }

        const filterContainer = document.getElementById('timeline-filters');
        if (filterContainer) filterContainer.classList.remove('hidden');

        // There are events, but need to check if favorites mode has events
        if (favoritesOnly && eventsToRender.length === 0) {
            // No favorites - show favorites empty state
            if (favoritesEmptyState) {
                favoritesEmptyState.classList.remove('hidden');

                // Move the favorites empty state element to be right after the timeline filters
                const timelineFilters = document.getElementById('timeline-filters');
                if (timelineFilters && timelineFilters.nextElementSibling !== favoritesEmptyState) {
                    timelineFilters.parentNode.insertBefore(favoritesEmptyState, timelineFilters.nextSibling);
                }

                // Make sure timeline filters are visible even when no favorites
                if (timelineFilters) timelineFilters.classList.remove('hidden');
            }

            if (timelineEmptyState) timelineEmptyState.classList.add('hidden');
            timelineContainer.classList.add('hidden');
            return;
        }

        // Has events to display - hide empty states
        if (favoritesEmptyState) favoritesEmptyState.classList.add('hidden');
        if (timelineEmptyState) timelineEmptyState.classList.add('hidden');
        timelineContainer.classList.remove('hidden');

        // Generate custom timeline with star buttons
        timelineContainer.innerHTML = '';

        // Sort events by time (earliest first)
        eventsToRender.sort((a, b) => a.timeMs - b.timeMs);


        // Create events in timeline
        eventsToRender.forEach((event, index) => {
            const eventElement = document.createElement('div');
            eventElement.className = 'timeline-event';
            eventElement.dataset.eventId = event.id || `event-${index}`;

            const timeFormatted = formatTime(event.timeMs);
            const eventName = formatEventTypeName(event.event);
            const isFavorite = !!event.isFavorite;
            const note = event.note ? String(event.note) : '';
            eventElement.title = note ? `${eventName} — ${note}` : eventName;

            const seekButton = document.createElement('button');
            seekButton.type = 'button';
            seekButton.className = 'timeline-event-seek';
            seekButton.setAttribute('aria-label', `Play ${eventName} at ${timeFormatted}`);

            const timeEl = document.createElement('span');
            timeEl.className = 'timeline-event-time';
            timeEl.textContent = timeFormatted;

            const nameEl = document.createElement('span');
            nameEl.className = 'timeline-event-name';
            nameEl.textContent = eventName;

            if (note) {
                const notePreview = document.createElement('span');
                notePreview.className = 'timeline-event-note-text block text-xs text-slate-500 font-normal truncate';
                notePreview.textContent = note;
                nameEl.appendChild(notePreview);
            }

            seekButton.append(timeEl, nameEl);

            const noteBtn = document.createElement('button');
            noteBtn.type = 'button';
            noteBtn.className = `edit-note-btn timeline-event-action${note ? ' text-blue-600' : ''}`;
            noteBtn.dataset.eventId = eventElement.dataset.eventId;
            noteBtn.setAttribute('aria-label', note ? 'Edit note' : 'Add note');
            noteBtn.title = note ? `Note: ${note}` : 'Add note';
            const noteIcon = document.createElement('i');
            noteIcon.className = note ? 'fas fa-pen text-xs' : 'far fa-comment text-xs';
            noteIcon.setAttribute('aria-hidden', 'true');
            noteBtn.appendChild(noteIcon);

            const favoriteBtn = document.createElement('button');
            favoriteBtn.type = 'button';
            favoriteBtn.className = `favorite-toggle timeline-event-action${isFavorite ? ' is-favorite' : ''}`;
            favoriteBtn.dataset.eventId = eventElement.dataset.eventId;
            favoriteBtn.setAttribute('aria-label', isFavorite ? 'Remove from favorites' : 'Add to favorites');
            favoriteBtn.setAttribute('aria-pressed', isFavorite ? 'true' : 'false');
            const favoriteIcon = document.createElement('i');
            favoriteIcon.className = isFavorite ? 'fas fa-star' : 'far fa-star';
            favoriteIcon.setAttribute('aria-hidden', 'true');
            favoriteBtn.appendChild(favoriteIcon);

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'delete-event-btn timeline-event-action';
            deleteBtn.dataset.eventId = eventElement.dataset.eventId;
            deleteBtn.setAttribute('aria-label', 'Delete event');
            const deleteIcon = document.createElement('i');
            deleteIcon.className = 'fas fa-xmark';
            deleteIcon.setAttribute('aria-hidden', 'true');
            deleteBtn.appendChild(deleteIcon);

            eventElement.append(seekButton, noteBtn, favoriteBtn, deleteBtn);

            if (activeEditingEventId === event.id) {
                eventElement.classList.add('has-editor');
                const editorEl = document.createElement('div');
                editorEl.className = 'timeline-event-editor';

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

                editorEl.append(noteRow, timeRow);
                eventElement.appendChild(editorEl);

                saveBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    updateEventNote(event.id, noteInput.value);
                    activeEditingEventId = null;
                });

                noteInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        updateEventNote(event.id, noteInput.value);
                        activeEditingEventId = null;
                    } else if (e.key === 'Escape') {
                        activeEditingEventId = null;
                        renderTimelineEvents();
                    }
                });

                const nudgeMinus = timeRow.querySelector('.nudge-minus');
                if (nudgeMinus) {
                    nudgeMinus.addEventListener('click', (e) => {
                        e.stopPropagation();
                        retargetEventTime(event.id, Math.max(0, (event.timeMs / 1000) - 1));
                    });
                }
                const nudgePlus = timeRow.querySelector('.nudge-plus');
                if (nudgePlus) {
                    nudgePlus.addEventListener('click', (e) => {
                        e.stopPropagation();
                        retargetEventTime(event.id, (event.timeMs / 1000) + 1);
                    });
                }
                const syncBtn = timeRow.querySelector('.sync-playhead');
                if (syncBtn) {
                    syncBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const vid = document.getElementById('video-player');
                        retargetEventTime(event.id, vid ? vid.currentTime : (event.timeMs / 1000));
                    });
                }
            }

            // Add event listener to jump to this time in video
            eventElement.addEventListener('click', (e) => {
                // Don't trigger when clicking action buttons or editor
                if (!e.target.closest('.timeline-event-action') && !e.target.closest('.timeline-event-editor')) {
                    const timeMs = event.timeMs;
                    jumpToVideoTime(timeMs);
                    highlightTimelineEvent(eventElement.dataset.eventId);
                }
            });

            noteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                activeEditingEventId = (activeEditingEventId === event.id ? null : event.id);
                renderTimelineEvents();
            });

            favoriteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavorite(eventElement.dataset.eventId);
            });

            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteEvent(eventElement.dataset.eventId);
            });

            timelineContainer.appendChild(eventElement);
        });


        console.log(`Timeline rendered with ${eventsToRender.length} events${favoritesOnly ? ' (favorites only)' : ''}`);
    } catch (error) {
        console.error("Error rendering timeline:", error);
        // Display an error message to the user in the timeline container
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

// Show the add-event button only when both a video and a game are loaded, and not in tagging mode
function updateFabVisibility() {
    const fab = document.getElementById('add-event-fab');
    const video = document.getElementById('video-player');
    if (!fab) return;

    const videoLoaded = video && (video.currentSrc || video.src || video.querySelector('source')) && video.readyState > 0;
    // In tagging mode, custom tags are placed directly in the quick-tag panel with the coding buttons
    fab.classList.toggle('hidden', !(videoLoaded && currentGameId && !isTaggingMode));
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

domReady(() => {
    console.log('DOM fully loaded and parsed');

    const video = document.getElementById('video-player');
    if (video) {
        video.addEventListener('loadeddata', updateFabVisibility);
        video.addEventListener('emptied', updateFabVisibility);
    }

    initFilterUI();
    loadGameFromQuery();
    renderQuickTagButtons();
    initKeyboardShortcuts();

    // Speed buttons
    document.querySelectorAll('[data-speed]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const spd = parseFloat(btn.getAttribute('data-speed'));
            setPlaybackRate(spd);
        });
    });

    // 5s and 10s seek buttons
    const rewind5s = document.getElementById('rewind-5s');
    const forward5s = document.getElementById('forward-5s');
    if (rew5s => rew5s) {}
    if (rewind5s) rewind5s.addEventListener('click', () => { seekRelative(-5); });
    if (forward5s) forward5s.addEventListener('click', () => { seekRelative(5); });

    // Custom Tag button in Quick Tag panel
    const customTagBtn = document.getElementById('add-custom-tag-btn');
    const modal = document.getElementById('add-event-modal');
    const timestampInput = document.getElementById('event-timestamp');
    if (customTagBtn && modal) {
        customTagBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (video && !video.paused) video.pause();
            if (timestampInput && video) {
                timestampInput.value = formatTime(video.currentTime);
            }
            modal.classList.remove('hidden');
        });
    }

    // Edit Quick Tags toggle button
    const editTagsBtn = document.getElementById('edit-quick-tags-btn');
    const editTagsLabel = document.getElementById('edit-quick-tags-label');
    const editBar = document.getElementById('quick-tags-edit-bar');
    if (editTagsBtn) {
        editTagsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            isEditingQuickTags = !isEditingQuickTags;
            if (editTagsLabel) {
                editTagsLabel.textContent = isEditingQuickTags ? 'Done' : 'Edit Tags';
            }
            if (editBar) {
                editBar.classList.toggle('hidden', !isEditingQuickTags);
                if (isEditingQuickTags) {
                    renderQuickTagColorSelector();
                    const input = document.getElementById('new-tag-label-input');
                    if (input) input.focus();
                }
            }
            renderQuickTagButtons();
        });
    }

    // Add new quick tag button & Enter key
    const saveNewTagBtn = document.getElementById('save-new-tag-btn');
    const newTagInput = document.getElementById('new-tag-label-input');
    if (saveNewTagBtn && newTagInput) {
        const handleAddTag = () => {
            const label = newTagInput.value.trim();
            if (label) {
                addQuickTag(label, selectedNewTagColor);
                newTagInput.value = '';
                newTagInput.focus();
            }
        };
        saveNewTagBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleAddTag();
        });
        newTagInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTag();
            }
        });
    }

    // Reset quick tags button
    const resetTagsBtn = document.getElementById('reset-quick-tags-btn');
    if (resetTagsBtn) {
        resetTagsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            resetQuickTags();
        });
    }

    // Undo button in ticker
    const undoQuickTagBtn = document.getElementById('quick-tag-undo-btn');
    if (undoQuickTagBtn) {
        undoQuickTagBtn.addEventListener('click', (e) => {
            e.preventDefault();
            undoLastQuickTag();
        });
    }

    // Toggle Events Panel side-by-side in ticker without losing quick tag buttons
    const reviewModeBtn = document.getElementById('quick-tag-review-btn');
    if (reviewModeBtn) {
        reviewModeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            setTimelineCollapsed(!isTimelineCollapsed);
        });
    }

    // Collapse Timeline panel button in panel header
    const collapseTimelineBtn = document.getElementById('collapse-timeline-btn');
    if (collapseTimelineBtn) {
        collapseTimelineBtn.addEventListener('click', (e) => {
            e.preventDefault();
            setTimelineCollapsed(true);
        });
    }

    // Inline Match Title Editor
    const gameTitleEl = document.getElementById('review-game-title');
    const editTitleBtn = document.getElementById('edit-title-btn');
    const titleForm = document.getElementById('inline-title-form');
    const titleInput = document.getElementById('inline-title-input');
    const cancelTitleBtn = document.getElementById('cancel-title-btn');

    function openTitleEditor() {
        if (!titleForm || !titleInput) return;
        const current = getCurrentGame();
        titleInput.value = (current && current.teams) ? current.teams : (gameTitleEl ? gameTitleEl.textContent : '');
        if (gameTitleEl) gameTitleEl.classList.add('hidden');
        if (editTitleBtn) editTitleBtn.classList.add('hidden');
        titleForm.classList.remove('hidden');
        titleInput.focus();
        titleInput.select();
    }

    function closeTitleEditor() {
        if (!titleForm) return;
        titleForm.classList.add('hidden');
        if (gameTitleEl) gameTitleEl.classList.remove('hidden');
        if (editTitleBtn) editTitleBtn.classList.remove('hidden');
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

    // Save & Exit button in header
    const saveAndExitBtn = document.getElementById('save-and-exit-btn');
    if (saveAndExitBtn) {
        saveAndExitBtn.addEventListener('click', (e) => {
            e.preventDefault();
            saveAndExit();
        });
    }

    // Direct Start & Upload on Empty State
    const startNewBtn = document.getElementById('start-new-video-game-btn');
    if (startNewBtn) {
        startNewBtn.addEventListener('click', (e) => {
            e.preventDefault();
            createNewVideoGame();
        });
    }

    const uploadDirectInput = document.getElementById('video-upload-direct');
    if (uploadDirectInput) {
        uploadDirectInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!currentGameId) {
                const baseName = file.name.replace(/\.[^/.]+$/, '');
                createNewVideoGame(baseName);
            } else {
                autoRenameFromVideo(file.name);
            }
            commitDraftGame();
            if (videoPlayer) {
                const videoUrl = URL.createObjectURL(file);
                while (videoPlayer.firstChild) videoPlayer.removeChild(videoPlayer.firstChild);
                const source = document.createElement('source');
                source.src = videoUrl;
                source.type = file.type;
                videoPlayer.appendChild(source);
                videoPlayer.load();
                videoPlayer.play().catch(err => console.warn("Couldn't auto-play video:", err));
            }
        });
    }

    // --- Video Upload Setup ---
    const videoUploadInput = document.getElementById('video-upload');
    if (videoUploadInput) {
        videoUploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Check if file is a video
            if (!file.type.startsWith('video/')) {
                showNotification('Please select a valid video file', 'error');
                return;
            }

            if (!currentGameId) {
                const baseName = file.name.replace(/\.[^/.]+$/, '');
                createNewVideoGame(baseName);
            } else {
                autoRenameFromVideo(file.name);
            }
            commitDraftGame();

            // Create object URL for the file
            const videoUrl = URL.createObjectURL(file);

            // Set as video source
            if (videoPlayer) {
                // Remove any existing sources
                while (videoPlayer.firstChild) {
                    videoPlayer.removeChild(videoPlayer.firstChild);
                }

                // Create and add new source
                const source = document.createElement('source');
                source.src = videoUrl;
                source.type = file.type;
                videoPlayer.appendChild(source);

                // Reload video with new source
                videoPlayer.load();

                // Start playing
                videoPlayer.play().catch(err => {
                    console.warn("Couldn't auto-play video:", err);
                });
            }
        });
    }    // --- Video Player Setup ---
    const videoPlayer = document.getElementById('video-player');
    if (videoPlayer) {
        console.log('Video player element found.');

        // Setup video navigation controls (10 second skip)
        const rewind10sButton = document.getElementById('rewind-10s');
        const forward10sButton = document.getElementById('forward-10s');

        if (rewind10sButton) {
            rewind10sButton.addEventListener('click', () => {
                if (videoPlayer.readyState > 0) {
                    // Move back 10 seconds, ensuring we don't go below 0
                    videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 10);
                }
            });
        }

        if (forward10sButton) {
            forward10sButton.addEventListener('click', () => {
                if (videoPlayer.readyState > 0) {
                    // Move forward 10 seconds, ensuring we don't exceed duration
                    videoPlayer.currentTime = Math.min(videoPlayer.duration, videoPlayer.currentTime + 10);
                }
            });
        }

        // Handle errors
        videoPlayer.addEventListener('error', (e) => {
            console.error('Video Player Error:', videoPlayer.error);
            // Display a user-friendly error message
            const videoContainer = document.getElementById('video-container');
            if (videoContainer) {
                const errorMessage = document.createElement('div');
                errorMessage.className = 'bg-red-100 text-red-800 p-4 rounded';
                errorMessage.innerHTML = `
                    <p class="font-bold">Video Error</p>
                    <p>Could not load video. Please check if video file exists and is supported by your browser.</p>
                `;
                videoContainer.appendChild(errorMessage);
            }
        });        // Listen for timeline event clicks to seek the video
        document.addEventListener('timeline-event-clicked', (e) => {
            const { event, seekTime } = e.detail;
            console.log(`Seeking video to ${seekTime} seconds for event: ${event}`);

            try {
                // Check if video is loaded
                if (videoPlayer.readyState > 0) {
                    // Seek the video to the desired timestamp
                    videoPlayer.currentTime = seekTime;

                    // Start playing if it's not already playing
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
    } else {
        console.warn('Video player element not found.');
    }
});

// Load the game named by the ?game=<id> query parameter, set by the Saved Games list
function loadGameFromQuery() {
    checkAndApplyMockSeed();
    const params = new URLSearchParams(window.location.search);
    const gameId = params.get('game');
    const isNewVideo = params.get('new') === 'video';
    const initialMode = params.get('mode');

    if (isNewVideo) {
        createNewVideoGame();
        setTaggingMode(true);
        return;
    }

    if (gameId === SAMPLE_GAME_ID) {
        ensureSampleGameExists();
    }
    if (!gameId || !loadGame(gameId)) {
        showNoGameSelectedState();
    }

    if (initialMode === 'tag') {
        setTaggingMode(true);
    }
}

// Jump to a specific time in the video
function jumpToVideoTime(timeMs) {
    const videoPlayer = document.getElementById('video-player');
    if (videoPlayer) {
        const timeSeconds = timeMs / 1000;
        videoPlayer.currentTime = timeSeconds;
        videoPlayer.play().catch(e => console.error("Error playing video:", e));
    }
}

export {
    CORE_QUICK_TAGS,
    DEFAULT_QUICK_TAGS,
    QUICK_TAG_COLORS,
    loadQuickTags,
    saveQuickTags,
    addQuickTag,
    removeQuickTag,
    resetQuickTags,
    undoLastQuickTag,
    setTaggingMode,
    setTimelineCollapsed,
    updateQuickTagTicker,
    quickTagEvent,
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
    showQuickTagFeedback
};

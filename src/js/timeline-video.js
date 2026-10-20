// Helper to generate a unique event id
function generateEventId() {
    return 'evt-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
}
function getCurrentGame() {
    const games = getSavedGames();
    if (!Array.isArray(games) || !currentGameId) return null;
    return games.find(g => g.id === currentGameId) || null;
}
// --- Timeline Video: Add Event FAB, Modal, and Persistent Event Logic ---

// Utility: Format milliseconds or seconds as mm:ss
function formatTime(input) {
    // Accept ms or seconds
    let seconds = typeof input === 'number' ? input : 0;
    if (seconds > 10000) seconds = Math.floor(seconds / 1000); // treat as ms if large
    if (isNaN(seconds)) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Utility: Parse mm:ss to seconds
function parseTime(str) {
    const [m, s] = str.split(':').map(Number);
    return m * 60 + s;
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
            const game = getCurrentGame();
            if (!game) {
                alert('No game selected. Please select a game to add events.');
                return;
            }

            // Add event to game.events (create if missing)
            if (!Array.isArray(game.events)) game.events = [];
            game.events.push({
                event: type,
                note,
                timestamp: ts,
                timeMs: parseTime(ts) * 1000,
                id: generateEventId()
            });
            // Always preserve teams and all metadata
            const metadata = (game && game.metadata) ? { ...game.metadata } : {};

            saveGame(game.id, game.events, metadata);

            const savedGames = getSavedGames();
            if (game.teams) {
                const { game: existing, index } = findGameById(savedGames, game.id);
                if (existing) {
                    // update teams and persist
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
import { renderTimeline } from './timeline.js';
import { storageService } from '../services/storageService.js';
import { notificationService } from '../services/notificationService.js';
import { generateGameId } from '../services/gameStorageManager.js';

const LOCAL_STORAGE_KEY_GAMES = 'fieldHockeyGames_v1';

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

// Track presentation mode state
let presentationModeActive = false;
let currentPlaylistIndex = 0;
let favoriteEvents = [];
let currentGameId = null;

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
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                break;
            }
        }
    }

    // Show overlay with tag and description if in presentation mode
    updatePresentationOverlay(event);

    // Show event details notification
    const eventType = formatEventTypeName(event.event);
    const eventTime = formatTime(event.timeMs);
    showNotification(`${eventType} at ${eventTime}`);
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
        currentEvent.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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

    // Ensure all events are in standard format (event, timeMs)
    const standardEvents = events.map(evt => ({
        event: evt.event,
        timeMs: evt.timeMs,
        id: evt.id,
        isFavorite: evt.isFavorite || false,
        ...(evt.lead !== undefined && { lead: evt.lead }),
        ...(evt.lag !== undefined && { lag: evt.lag })
    }));

    // Preserve existing entry fields (timestamp, teams, metadata) when possible
    const { game: existing, index } = findGameById(savedGames, gameId);
    const existingTeams = (existing && (existing.teams || (existing.metadata && existing.metadata.teams))) || null;
    const existingTimestamp = (existing && (existing.timestamp || (existing.metadata && existing.metadata.timestamp))) || null;

    const teamsName = metadata.teams ?? existingTeams ?? null;
    const timestamp = existingTimestamp ?? new Date().toISOString();

    // Merge metadata, preferring incoming metadata but keeping existing metadata where absent
    const mergedMetadata = {
        ...(existing.metadata || {}),
        ...metadata,
        lastUpdated: new Date().toISOString()
    };

    // Create or update game in the saved games object, keeping top-level timestamp for compatibility
    const mergedGame = {
        id: gameId,
        events: standardEvents,
        teams: teamsName,
        timestamp,
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

            const displayName = game.teams || gameId;
            const gameTitle = document.getElementById('review-game-title');
            if (gameTitle) {
                gameTitle.textContent = displayName;
                gameTitle.title = displayName;
                gameTitle.classList.remove('hidden');
            }
            updateFabVisibility();

            // Display success message using teams name if available
            showNotification(`Game "${displayName}" loaded successfully`);

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



let timelineEvents = [];
// Event types selected in the filter dropdown; empty means all types
let activeTypeFilters = new Set();
let favoritesOnly = false;

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

            seekButton.append(timeEl, nameEl);

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

            eventElement.append(seekButton, favoriteBtn, deleteBtn);

            // Add event listener to jump to this time in video
            eventElement.addEventListener('click', (e) => {
                // Don't trigger when clicking favorite or delete button
                if (!e.target.closest('.favorite-toggle') && !e.target.closest('.delete-event-btn')) {
                    const timeMs = event.timeMs;
                    jumpToVideoTime(timeMs);
                    highlightTimelineEvent(eventElement.dataset.eventId);
                }
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

// Show the add-event button only when both a video and a game are loaded
function updateFabVisibility() {
    const fab = document.getElementById('add-event-fab');
    const video = document.getElementById('video-player');
    if (!fab) return;

    const videoLoaded = video && (video.currentSrc || video.querySelector('source')) && video.readyState > 0;
    fab.classList.toggle('hidden', !(videoLoaded && currentGameId));
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

    // Show confirmation
    if (event.isFavorite) {
        showNotification('Added to favorites');
    } else {
        showNotification('Removed from favorites', 'info');
    }
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
                showNotification(`Video "${file.name}" loaded successfully`);

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
                    showNotification('Rewound 10 seconds', 'info');
                }
            });
        }

        if (forward10sButton) {
            forward10sButton.addEventListener('click', () => {
                if (videoPlayer.readyState > 0) {
                    // Move forward 10 seconds, ensuring we don't exceed duration
                    videoPlayer.currentTime = Math.min(videoPlayer.duration, videoPlayer.currentTime + 10);
                    showNotification('Advanced 10 seconds', 'info');
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
                    }            // Show a notification
                    showNotification(`Seeking to event: ${event}`);
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
    const gameId = new URLSearchParams(window.location.search).get('game');
    if (!gameId || !loadGame(gameId)) {
        showNoGameSelectedState();
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

export { getVisibleEvents, setTypeFilters, setFavoritesOnly, updateEventFilters, loadGame, deleteEvent, toggleFavorite };

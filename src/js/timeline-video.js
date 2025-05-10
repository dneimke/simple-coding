import { renderTimeline } from './timeline.js';
import { storageService } from '../services/storageService.js';
import { notificationService } from '../services/notificationService.js';

const LOCAL_STORAGE_KEY_GAMES = 'fieldHockeyGames_v1';

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
    const videoContainer = document.getElementById('video-container');

    if (presentationModeActive) {
        // First, filter out only favorite events
        favoriteEvents = timelineEvents.filter(event => event.isFavorite);

        // If no favorites, show notification and exit presentation mode
        if (favoriteEvents.length === 0) {
            showNotification('Add some favorites first to start a presentation', 'warning');
            presentationModeActive = false;
            return;
        }

        // Enter presentation mode
        presentationModeBtn.classList.replace('bg-purple-600', 'bg-purple-800');
        playlistControls.classList.replace('hidden', 'flex');

        // Make video larger
        timelineContainer.classList.add('md:hidden');
        videoContainer.classList.replace('md:w-2/3', 'md:w-full');
        videoContainer.classList.replace('lg:w-3/4', 'lg:w-full');

        // Reset playlist position and navigate to first favorite
        currentPlaylistIndex = 0;
        updatePlaylistCounter();
        if (favoriteEvents.length > 0) {
            jumpToEventTime(favoriteEvents[0]);
        }
    } else {
        // Exit presentation mode
        presentationModeBtn.classList.replace('bg-purple-800', 'bg-purple-600');
        playlistControls.classList.replace('flex', 'hidden');

        // Restore original layout
        timelineContainer.classList.remove('md:hidden');
        videoContainer.classList.replace('md:w-full', 'md:w-2/3');
        videoContainer.classList.replace('lg:w-full', 'lg:w-3/4');
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

    // Highlight the event in the timeline
    highlightTimelineEvent(event.id);

    // Show event details notification
    const eventType = formatEventTypeName(event.event);
    const eventTime = formatTime(event.timeMs);
    showNotification(`${eventType} at ${eventTime}`);
}

// Highlight the current event in the timeline
function highlightTimelineEvent(eventId) {
    // Remove highlight from all events
    const events = document.querySelectorAll('.timeline-event');
    events.forEach(el => {
        el.classList.remove('bg-blue-50', 'ring-2', 'ring-blue-500');
    });

    // Add highlight to current event
    const currentEvent = document.querySelector(`.timeline-event[data-event-id="${eventId}"]`);
    if (currentEvent) {
        currentEvent.classList.add('bg-blue-50', 'ring-2', 'ring-blue-500');

        // Scroll to make event visible if needed
        currentEvent.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Format milliseconds time to MM:SS format
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Show all events (disable favorites filter)
function showAllEvents() {
    const showAllBtn = document.getElementById('show-all-events');
    const showFavoritesBtn = document.getElementById('show-favorites');

    // Update UI state
    showAllBtn.classList.replace('bg-gray-200', 'bg-blue-500');
    showAllBtn.classList.replace('text-gray-700', 'text-white');
    showFavoritesBtn.classList.replace('bg-blue-500', 'bg-gray-200');
    showFavoritesBtn.classList.replace('text-white', 'text-gray-700');

    // Hide favorites empty state if visible
    const favoritesEmptyState = document.getElementById('favorites-empty-state');
    if (favoritesEmptyState) {
        favoritesEmptyState.classList.add('hidden');
    }

    // Show timeline events
    renderTimelineEvents();
}

// Show only favorited events
function showFavoritesOnly() {
    const showAllBtn = document.getElementById('show-all-events');
    const showFavoritesBtn = document.getElementById('show-favorites');
    const filterContainer = document.getElementById('timeline-filters');

    // Update UI state
    showFavoritesBtn.classList.replace('bg-gray-200', 'bg-blue-500');
    showFavoritesBtn.classList.replace('text-gray-700', 'text-white');
    showAllBtn.classList.replace('bg-blue-500', 'bg-gray-200');
    showAllBtn.classList.replace('text-white', 'text-gray-700');

    // Make sure filter container is visible
    if (filterContainer) filterContainer.classList.remove('hidden');

    // Show only favorites
    renderTimelineEvents(true);
}

// Use the notification service for notifications
function showNotification(message, type = 'success') {
    notificationService.notify(message, type);
}

// Game management functions
function getSavedGames() {
    const storedGames = storageService.getItem(LOCAL_STORAGE_KEY_GAMES);
    if (storedGames) {
        return storedGames; // Already parsed by storageService
    } else {
        console.error("No saved games found");
        return {};
    }
}

function saveGame(gameId, events, metadata = {}) {
    const savedGames = getSavedGames();

    // Ensure all events are in standard format (event, timeMs)
    const standardEvents = events.map(evt => {
        // Keep only the standard properties
        return {
            event: evt.event,
            timeMs: evt.timeMs,
            id: evt.id,
            isFavorite: evt.isFavorite || false // Ensure favorite status is preserved
        };
    });

    // Extract teams name from metadata if available
    const teamsName = metadata.teams || null;

    // Create or update game in the saved games object
    savedGames[gameId] = {
        id: gameId,
        events: standardEvents,
        teams: teamsName,
        metadata: {
            ...metadata,
            lastUpdated: new Date().toISOString()
        }
    };// Save to localStorage using storage service
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
    if (savedGames[gameId]) {
        try {
            // Get events from the saved game
            const events = savedGames[gameId].events;
            const game = savedGames[gameId];

            // Ensure each event has an id and isFavorite property
            events.forEach((evt, index) => {
                if (!evt.id) {
                    evt.id = `event-${index}`;
                }
                if (evt.isFavorite === undefined) {
                    evt.isFavorite = false;
                }
            });

            // Store current game ID
            currentGameId = gameId;

            // Update current events and render timeline
            timelineEvents = events;
            renderTimelineEvents();

            // Update game selector to show current selection
            const gameSelector = document.getElementById('game-selector');
            if (gameSelector) {
                gameSelector.value = gameId;
            }

            // Display success message using teams name if available
            const displayName = game.teams || gameId;
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

// Render timeline with current events (sorted with earliest events at the top)
function renderTimelineEvents(favoritesOnly = false) {
    const timelineContainerId = 'timeline-events';
    const timelineContainer = document.getElementById(timelineContainerId);
    const favoritesEmptyState = document.getElementById('favorites-empty-state');
    const timelineEmptyState = document.getElementById('timeline-empty-state');

    if (!timelineContainer) return;

    try {
        // Filter events if showing favorites only
        const eventsToRender = favoritesOnly ?
            timelineEvents.filter(event => event.isFavorite) :
            timelineEvents;

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
        }        // There are events, but need to check if favorites mode has events
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
            // Create event element
            const eventElement = document.createElement('div');
            eventElement.classList.add(
                'timeline-event',
                'flex',
                'items-center',
                'justify-between',
                'p-3',
                'border-l-4',
                `border-${getEventColor(event.event)}-500`,
                'bg-white',
                'hover:bg-gray-50',
                'rounded',
                'shadow-sm',
                'mb-3',
                'cursor-pointer'
            );
            eventElement.dataset.eventId = event.id || `event-${index}`;

            // Format time from milliseconds to MM:SS
            const timeFormatted = formatTime(event.timeMs);

            // Determine if this event is a favorite
            const isFavorite = !!event.isFavorite;

            // Create event content
            eventElement.innerHTML = `
                <div class="flex-grow">
                    <span class="text-xs text-gray-500">${timeFormatted}</span>
                    <p class="font-medium">${formatEventTypeName(event.event)}</p>
                </div>
                <button class="favorite-toggle p-1 focus:outline-none ${isFavorite ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'}"
                        data-event-id="${eventElement.dataset.eventId}"
                        aria-label="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" ${isFavorite ? 'fill="currentColor"' : 'fill="none"'} viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                </button>
            `;

            // Add event listener to jump to this time in video
            eventElement.addEventListener('click', (e) => {
                // Don't trigger when clicking favorite button
                if (!e.target.closest('.favorite-toggle')) {
                    const timeMs = event.timeMs;
                    jumpToVideoTime(timeMs);
                    highlightTimelineEvent(eventElement.dataset.eventId);
                }
            });

            // Add event listener for favorite toggle
            const favoriteBtn = eventElement.querySelector('.favorite-toggle');
            favoriteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavorite(eventElement.dataset.eventId);
            });

            timelineContainer.appendChild(eventElement);
        });

        console.log(`Timeline rendered with ${eventsToRender.length} events${favoritesOnly ? ' (favorites only)' : ''}`);

        // Update filter buttons based on available event types
        if (timelineEvents.length > 0) {
            updateEventFilters();
        } else {
            // Hide filter container if no events
            const filterContainer = document.getElementById('timeline-filters');
            if (filterContainer) {
                filterContainer.classList.add('hidden');
            }
        }
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
function updateEventFilters() {
    if (timelineEvents.length === 0) return;

    // Get unique event types
    const eventTypes = getUniqueEventTypes(timelineEvents);

    const filterContainer = document.getElementById('timeline-filters');
    if (!filterContainer) return;

    // Show the filter container
    filterContainer.classList.remove('hidden');

    // Get references to our filter elements
    const dropdownButton = document.getElementById('filter-dropdown-button');
    const dropdownPanel = document.getElementById('filter-dropdown-panel');
    const optionsContainer = document.getElementById('filter-options-container');
    const selectedFiltersText = document.getElementById('selected-filters-text');
    const selectedFiltersTags = document.getElementById('selected-filters-tags');
    const applyButton = document.getElementById('apply-filters');
    const allCheckbox = document.getElementById('filter-option-all');

    // Clear any existing options (except the "All" option which is static)
    optionsContainer.innerHTML = '';

    // Create a checkbox for each event type
    eventTypes.forEach(eventType => {
        const optionWrapper = document.createElement('div');
        optionWrapper.className = 'flex items-center px-4 py-2 hover:bg-gray-100 cursor-pointer';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `filter-option-${eventType}`;
        checkbox.className = 'filter-checkbox h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded';
        checkbox.setAttribute('data-filter', eventType);

        const label = document.createElement('label');
        label.htmlFor = `filter-option-${eventType}`;
        label.className = 'ml-3 block text-sm font-medium text-gray-700 cursor-pointer w-full';
        label.textContent = formatEventTypeName(eventType);

        optionWrapper.appendChild(checkbox);
        optionWrapper.appendChild(label);

        // Make the entire div clickable
        optionWrapper.addEventListener('click', (e) => {
            // Prevent label's native behavior
            if (e.target !== checkbox) {
                e.preventDefault();
                checkbox.checked = !checkbox.checked;

                // If individual filter is checked, uncheck "All"
                if (checkbox.checked && allCheckbox.checked) {
                    allCheckbox.checked = false;
                }

                // If no filters are selected, check "All"
                const anyChecked = Array.from(optionsContainer.querySelectorAll('.filter-checkbox'))
                    .some(cb => cb.checked);
                if (!anyChecked && !allCheckbox.checked) {
                    allCheckbox.checked = true;
                }
            }
        });

        optionsContainer.appendChild(optionWrapper);
    });

    // Toggle dropdown visibility
    dropdownButton.addEventListener('click', () => {
        const expanded = dropdownButton.getAttribute('aria-expanded') === 'true';
        dropdownButton.setAttribute('aria-expanded', !expanded);
        dropdownPanel.classList.toggle('hidden');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!dropdownButton.contains(e.target) && !dropdownPanel.contains(e.target)) {
            dropdownButton.setAttribute('aria-expanded', 'false');
            dropdownPanel.classList.add('hidden');
        }
    });

    // Handle "All" checkbox behavior
    allCheckbox.addEventListener('change', () => {
        if (allCheckbox.checked) {
            // If "All" is checked, uncheck individual filters
            const individualCheckboxes = optionsContainer.querySelectorAll('.filter-checkbox');
            individualCheckboxes.forEach(cb => {
                cb.checked = false;
            });
        }
    });

    // Apply filters button
    applyButton.addEventListener('click', () => {
        // Get selected filters
        let selectedFilters = [];

        if (allCheckbox.checked) {
            selectedFilters = ['all'];
        } else {
            const checkedBoxes = document.querySelectorAll('#filter-options-container .filter-checkbox:checked');
            selectedFilters = Array.from(checkedBoxes).map(cb => cb.getAttribute('data-filter'));

            // If nothing is selected, default to "all"
            if (selectedFilters.length === 0) {
                selectedFilters = ['all'];
                allCheckbox.checked = true;
            }
        }

        // Update the display text and tags
        updateSelectedFiltersDisplay(selectedFilters);

        // Apply the filter
        applyTimelineFilter(selectedFilters);

        // Close dropdown
        dropdownButton.setAttribute('aria-expanded', 'false');
        dropdownPanel.classList.add('hidden');
    });

    // Initialize with "All" selected
    updateSelectedFiltersDisplay(['all']);
}

// Update the selected filters display text and tags
function updateSelectedFiltersDisplay(selectedFilters) {
    const selectedFiltersText = document.getElementById('selected-filters-text');
    const selectedFiltersTags = document.getElementById('selected-filters-tags');

    if (selectedFilters.includes('all') || selectedFilters.length === 0) {
        selectedFiltersText.textContent = 'All events';
        selectedFiltersTags.innerHTML = '';
        return;
    }

    // Update dropdown button text
    selectedFiltersText.textContent = `${selectedFilters.length} filter${selectedFilters.length > 1 ? 's' : ''} selected`;

    // Update tags display
    selectedFiltersTags.innerHTML = '';

    selectedFilters.forEach(filter => {
        const tag = document.createElement('div');
        tag.className = 'bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded flex items-center';

        const tagText = document.createElement('span');
        tagText.textContent = formatEventTypeName(filter);

        const removeButton = document.createElement('button');
        removeButton.className = 'ml-1.5 text-blue-600 hover:text-blue-800';
        removeButton.innerHTML = '&times;';
        removeButton.setAttribute('aria-label', `Remove ${formatEventTypeName(filter)} filter`);

        // Remove filter when clicking the X
        removeButton.addEventListener('click', () => {
            const checkbox = document.querySelector(`.filter-checkbox[data-filter="${filter}"]`);
            if (checkbox) {
                checkbox.checked = false;
            }

            // Re-apply filters
            const newSelection = selectedFilters.filter(f => f !== filter);
            if (newSelection.length === 0) {
                const allCheckbox = document.getElementById('filter-option-all');
                if (allCheckbox) {
                    allCheckbox.checked = true;
                }
                updateSelectedFiltersDisplay(['all']);
                applyTimelineFilter(['all']);
            } else {
                updateSelectedFiltersDisplay(newSelection);
                applyTimelineFilter(newSelection);
            }
        });

        tag.appendChild(tagText);
        tag.appendChild(removeButton);
        selectedFiltersTags.appendChild(tag);
    });
}

// Apply timeline filtering
function applyTimelineFilter(filterTypes) {
    const timelineContainerId = 'timeline-events';
    const container = document.getElementById(timelineContainerId);

    if (!container) return;

    // Check if we're in favorites mode
    const showFavoritesBtn = document.getElementById('show-favorites');
    const isFavoritesMode = showFavoritesBtn?.classList.contains('bg-blue-500');

    // If "all" is selected, show all events (respecting favorites mode)
    if (filterTypes.includes('all')) {
        renderTimelineEvents(isFavoritesMode);
        return;
    }

    // Otherwise, filter events by type
    const allEvents = [...timelineEvents]; // Create a copy to avoid modifying the original
    const filteredEvents = allEvents.filter(event =>
        filterTypes.includes(event.event) &&
        (!isFavoritesMode || event.isFavorite)
    );

    // Store filtered events temporarily and render
    const originalEvents = [...timelineEvents];
    timelineEvents = filteredEvents;
    renderTimelineEvents(false);
    timelineEvents = originalEvents; // Restore original events
}

// Toggle empty state message
function toggleEmptyState(isEmpty) {
    const emptyStateElement = document.getElementById('timeline-empty-state');
    const timelineContainerElement = document.getElementById('timeline-events');

    if (emptyStateElement && timelineContainerElement) {
        if (isEmpty) {
            emptyStateElement.classList.remove('hidden');
            timelineContainerElement.classList.add('hidden');
        } else {
            emptyStateElement.classList.add('hidden');
            timelineContainerElement.classList.remove('hidden');
        }
    }
}

/**
 * Toggle visibility of the no-games state message
 * @param {boolean} show Whether to show the no-games state message
 */
function toggleNoGamesState(show) {
    const noGamesStateElement = document.getElementById('no-games-state');
    const emptyStateElement = document.getElementById('timeline-empty-state');
    const timelineContainerElement = document.getElementById('timeline-events');

    if (noGamesStateElement) {
        if (show) {
            // Show no-games message, hide other states
            noGamesStateElement.classList.remove('hidden');

            // Hide the timeline-empty-state when showing the no-games state
            if (emptyStateElement) {
                emptyStateElement.classList.add('hidden');
            }

            // Hide the timeline events container
            if (timelineContainerElement) {
                timelineContainerElement.classList.add('hidden');
            }
        } else {
            noGamesStateElement.classList.add('hidden');
        }
    }
}

// Toggle favorite status for an event
function toggleFavorite(eventId) {
    // Find the event in current events
    const event = timelineEvents.find(e => e.id === eventId);
    if (!event) return;

    // Toggle favorite status
    event.isFavorite = !event.isFavorite;

    // Save changes to localStorage
    if (currentGameId) {
        saveGame(currentGameId, timelineEvents);
    }

    // Re-render UI (maintaining current filter state)
    const showFavoritesBtn = document.getElementById('show-favorites');
    const isFavoritesMode = showFavoritesBtn.classList.contains('bg-blue-500');

    renderTimelineEvents(isFavoritesMode);

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

    toggleEmptyState(true);
    populateGameSelector();
    setupGameControls();    // --- Video Upload Setup ---
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
        console.log('Video player element found.');// Handle errors
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

// Populate game selector dropdown
function populateGameSelector() {
    const gameSelector = document.getElementById('game-selector');
    if (!gameSelector) return;

    // Clear existing options except the default one
    while (gameSelector.options.length > 1) {
        gameSelector.remove(1);
    }

    const savedGames = getSavedGames();
    const noGamesNotification = document.getElementById('no-games-notification');
    const hasGames = Object.keys(savedGames).length > 0;

    // Show/hide the no games notification
    if (noGamesNotification) {
        if (!hasGames) {
            noGamesNotification.classList.remove('hidden');
        } else {
            noGamesNotification.classList.add('hidden');
        }
    }

    // Toggle game selector state
    if (!hasGames) {
        gameSelector.disabled = true;
        gameSelector.classList.add('bg-gray-100', 'text-gray-500', 'cursor-not-allowed');

        // Show the no-games state
        toggleNoGamesState(true);
    } else {
        gameSelector.disabled = false;
        gameSelector.classList.remove('bg-gray-100', 'text-gray-500', 'cursor-not-allowed');

        // Hide the no-games state
        toggleNoGamesState(false);

        // Add each saved game as an option
        Object.keys(savedGames).forEach(gameId => {
            const game = savedGames[gameId];
            const option = document.createElement('option');
            option.value = gameId;

            // Use teams attribute if available, otherwise use the gameId
            if (game.teams) {
                option.textContent = game.teams;
            } else {
                option.textContent = gameId;
            }

            gameSelector.appendChild(option);
        });
    }
}

function setupGameControls() {
    // Game selector change handler
    const gameSelector = document.getElementById('game-selector');
    if (gameSelector) {
        gameSelector.addEventListener('change', (e) => {
            const gameId = e.target.value;
            if (gameId && gameId !== 'default') {
                loadGame(gameId);
            } else {
                // Reset to empty state if "Choose a game" is selected
                timelineEvents = [];
                renderTimelineEvents();
            }
        });
    }
}

// Get appropriate color for event type
function getEventColor(eventType) {
    // Map of event types to colors
    const colorMap = {
        goal: 'green',
        foul: 'red',
        penalty: 'amber',
        substitution: 'blue',
        injury: 'red',
        card: 'amber',
        timeout: 'purple',
        possession_change: 'indigo',
        shot_on_goal: 'blue',
        corner: 'teal',
        free_hit: 'sky'
    };

    // Return mapped color or default blue
    return colorMap[eventType?.toLowerCase()] || 'blue';
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

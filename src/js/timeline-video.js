import { renderTimeline } from './timeline.js';

const LOCAL_STORAGE_KEY_GAMES = 'fieldHockeyGames_v1';

// Game management functions
function getSavedGames() {
    const storedGames = localStorage.getItem(LOCAL_STORAGE_KEY_GAMES);
    if (storedGames) {
        try {
            return JSON.parse(storedGames);
        } catch (e) {
            console.error("Error parsing saved games data:", e);
            return {};
        }
    }
    return {}; // Return empty object if no saved games
}

function saveGame(gameId, events, metadata = {}) {
    const savedGames = getSavedGames();

    // Ensure all events are in standard format (event, timeMs)
    const standardEvents = events.map(evt => {
        // Keep only the standard properties
        return {
            event: evt.event,
            timeMs: evt.timeMs
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
    };

    // Save to localStorage
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY_GAMES, JSON.stringify(savedGames));
        return true;
    } catch (e) {
        console.error("Error saving game:", e);
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

function parseXmlEvents(xmlString) {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml");

        // Check for parsing errors
        const parseError = xmlDoc.getElementsByTagName('parsererror');
        if (parseError.length > 0) {
            throw new Error("XML parsing error");
        }

        // Get game metadata
        const gameElement = xmlDoc.getElementsByTagName('game')[0];
        let gameMetadata = {};

        if (gameElement) {
            gameMetadata = {
                date: gameElement.getAttribute('date') || '',
                teams: gameElement.getAttribute('teams') || '',
                location: gameElement.getAttribute('location') || ''
            };
        }

        // Get all event elements - looking for events inside the 'events' container
        let eventElements = [];
        const eventsContainer = xmlDoc.getElementsByTagName('events')[0];

        if (eventsContainer) {
            eventElements = eventsContainer.getElementsByTagName('event');
        } else {
            // Fallback: look for events directly
            eventElements = xmlDoc.getElementsByTagName('event');
        }

        const events = []; for (let i = 0; i < eventElements.length; i++) {
            const element = eventElements[i];

            // Get timeMs directly if available
            let timeMs;
            const timeMsAttr = element.getAttribute('timeMs');

            if (timeMsAttr) {
                timeMs = parseInt(timeMsAttr, 10);
            } else {
                // Try to calculate from timestamp if available
                const timestamp = element.getAttribute('timestamp');
                if (timestamp) {
                    // Use timestamp as a reference point
                    const eventTime = new Date(timestamp);
                    timeMs = eventTime.getTime();
                } else {
                    // As fallback, get zero time
                    timeMs = 0;
                }
            }

            // Get the event name
            const eventName = element.getAttribute('event') ||
                element.getAttribute('title') ||
                'Unknown Event';

            events.push({
                event: eventName,
                timeMs: timeMs
            });
        }

        // Sort events by timeMs (earliest first)
        events.sort((a, b) => a.timeMs - b.timeMs);

        return events;
    } catch (e) {
        console.error("Error parsing XML:", e);
        throw e;
    }
}

function getStoredEvents() {
    // This function now just returns empty array - we'll load games explicitly
    return [];
}

let timelineEvents = [];

// Render timeline with current events
function renderTimelineEvents() {
    const timelineContainerId = 'timeline-events';
    try {
        renderTimeline(timelineEvents, timelineContainerId);
        console.log('Timeline rendered with', timelineEvents.length, 'events');

        // Show or hide the empty state message
        toggleEmptyState(timelineEvents.length === 0);
    } catch (error) {
        console.error("Error rendering timeline:", error);
        // Display an error message to the user in the timeline container
        const container = document.getElementById(timelineContainerId);
        if (container) {
            container.innerHTML = '<p class="text-red-600">Could not load timeline events.</p>';
        }
    }
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

// --- DOM Ready ---
// Vanilla JS equivalent of DOMContentLoaded
function domReady(callback) {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", callback);
    } else {
        callback();
    }
}

// --- Initialization ---
domReady(() => {
    console.log('DOM fully loaded and parsed');

    // Migrate stored games to standard format
    migrateStoredGames();

    // Initialize UI with empty state
    toggleEmptyState(true);

    // Set up game selector
    populateGameSelector();

    // Set up event handlers for game loading controls
    setupGameControls();

    // --- Video Time Setup ---
    const currentVideoTimeElement = document.getElementById('current-video-time');
    let currentVideoTime = 0;

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
    }

    // --- Video Player Setup ---
    const videoPlayer = document.getElementById('video-player');
    if (videoPlayer) {
        console.log('Video player element found.');

        // Update current time display
        videoPlayer.addEventListener('timeupdate', () => {
            currentVideoTime = videoPlayer.currentTime;
            // Format time as MM:SS
            const minutes = Math.floor(currentVideoTime / 60);
            const seconds = Math.floor(currentVideoTime % 60);
            const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            if (currentVideoTimeElement) {
                currentVideoTimeElement.textContent = formattedTime;
            }
        });

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

    // Helper function to show a temporary notification
    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        const baseClasses = 'fixed top-4 right-4 py-2 px-4 rounded-md shadow-lg z-50 transition-opacity duration-300';

        if (type === 'error') {
            notification.className = `${baseClasses} bg-red-600 text-white`;
        } else if (type === 'warning') {
            notification.className = `${baseClasses} bg-yellow-500 text-white`;
        } else {
            notification.className = `${baseClasses} bg-green-600 text-white`;
        }

        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
});

/**
 * Migrates saved games to use the standard GameEvent format
 */
function migrateStoredGames() {
    const savedGames = getSavedGames();
    let migrated = false;

    // Check each game for old format events
    Object.keys(savedGames).forEach(gameId => {
        const game = savedGames[gameId];

        if (game.events && Array.isArray(game.events)) {
            // Convert each event to the standard format
            game.events = game.events.map(oldEvent => {
                // If already in standard format, keep as is
                if (typeof oldEvent.event === 'string' && typeof oldEvent.timeMs === 'number') {
                    return {
                        event: oldEvent.event,
                        timeMs: oldEvent.timeMs
                    };
                }

                // Otherwise, create standardized event
                return {
                    // Get event from title or default
                    event: oldEvent.event || oldEvent.title || 'Unknown Event',
                    // Get timeMs or calculate from timestamp or default to 0
                    timeMs: oldEvent.timeMs || (oldEvent.timestamp ? new Date(oldEvent.timestamp).getTime() : 0)
                };
            });

            migrated = true;
        }
    });

    // If any games were migrated, save changes back to storage
    if (migrated) {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY_GAMES, JSON.stringify(savedGames));
            console.log("Successfully migrated saved games to standard event format");
        } catch (e) {
            console.error("Error migrating saved games:", e);
        }
    }
}

// Populate game selector dropdown
function populateGameSelector() {
    const gameSelector = document.getElementById('game-selector');
    if (!gameSelector) return;

    // Clear existing options except the default one
    while (gameSelector.options.length > 1) {
        gameSelector.remove(1);
    }

    // Get saved games and add them to the selector
    const savedGames = getSavedGames();

    if (Object.keys(savedGames).length === 0) {
        // If no saved games, disable the selector
        gameSelector.disabled = true;
    } else {
        // Enable the selector and add options
        gameSelector.disabled = false;

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

// Set up event handlers for game loading controls
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

    // XML file import handler
    const xmlFileInput = document.getElementById('xml-upload');
    if (xmlFileInput) {
        xmlFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Check if file is XML
            if (file.type !== 'text/xml' && !file.name.toLowerCase().endsWith('.xml')) {
                showNotification('Please select a valid XML file', 'error');
                return;
            }            // Read the file content
            const reader = new FileReader();
            reader.onload = function (event) {
                try {
                    // Parse XML file content and get XML document
                    const xmlString = event.target.result;
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(xmlString, "text/xml");

                    // Extract teams information if available
                    let teamsName = null;
                    const gameElement = xmlDoc.getElementsByTagName('game')[0];
                    if (gameElement && gameElement.hasAttribute('teams')) {
                        teamsName = gameElement.getAttribute('teams');
                    }

                    // Parse events
                    const events = parseXmlEvents(xmlString);

                    // Update timeline with parsed events
                    timelineEvents = events;
                    renderTimelineEvents();

                    // Auto-save the imported game
                    const gameId = file.name.replace(/\.xml$/i, '');
                    saveGame(gameId, events, {
                        source: 'xml-import',
                        fileName: file.name,
                        importDate: new Date().toISOString(),
                        teams: teamsName || `Imported: ${gameId}` // Use teams from XML or create a default
                    });

                    // Update game selector
                    populateGameSelector();

                    // Show success message
                    showNotification(`Game data imported from ${file.name}`);
                } catch (error) {
                    console.error("Error importing XML file:", error);
                    showNotification("Error importing XML file. Check console for details.", "error");
                }
            };

            reader.onerror = function () {
                showNotification("Error reading file", "error");
            };

            reader.readAsText(file);
        });
    }    // Sample data load button handler
    const loadSampleButton = document.getElementById('load-sample-data');
    if (loadSampleButton) {
        loadSampleButton.addEventListener('click', () => {            // Load sample data using standardized GameEvent format
            const sampleEvents = [
                { event: 'GOAL_FOR', timeMs: 1230000 },    // 20:30
                { event: 'FOUL', timeMs: 1035000 },        // 17:15
                { event: 'SUBSTITUTION', timeMs: 830000 }, // 13:50
                { event: 'KICKOFF', timeMs: 0 }            // 00:00
            ];

            // Update timeline
            timelineEvents = sampleEvents;
            renderTimelineEvents();

            // Save as sample game with teams information
            const sampleGame = {
                source: 'sample-data',
                teams: 'Sample Game: Team A vs Team B'
            };
            saveGame('Sample Game', sampleEvents, sampleGame);

            // Update game selector
            populateGameSelector();

            // Select the sample game in the dropdown
            const gameSelector = document.getElementById('game-selector');
            if (gameSelector) {
                gameSelector.value = 'Sample Game';
            }

            showNotification("Sample game data loaded");
        });
    }
}

# Event Model Standardization Plan

## Current Issue

The application currently handles events in inconsistent formats across different components:

- Timeline display uses `{timestamp, title, description}` format
- XML parser extracts `{timestamp, title, description}` format
- Other components may expect different formats
- No consistent way to map between absolute timestamps and relative game time

## Standardized Event Model

We will adopt a consistent event model across all application components:

```javascript
/**
 * @typedef {Object} GameEvent
 * @property {string} event - Event type/code (e.g., "GOAL_FOR", "PRESS")
 * @property {number} timeMs - Time in milliseconds from game start
 */
```

## Implementation Plan

### 1. Create Time Formatting Utility

Create a simple utility function to help with time display:

```javascript
// src/utils/event-utils.js

/**
 * @typedef {Object} GameEvent
 * @property {string} event - Event type/code (e.g., "GOAL_FOR", "PRESS")
 * @property {number} timeMs - Time in milliseconds from game start
 */

/**
 * Creates a formatted time string from milliseconds
 * @param {number} timeMs - Time in milliseconds
 * @returns {string} Formatted time string (MM:SS)
 */
export function formatTimeFromMs(timeMs) {
  const totalSeconds = Math.floor(timeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Creates a sample GameEvent
 * @param {string} eventName - Name of the event
 * @param {number} minutes - Minutes into the game
 * @param {number} seconds - Seconds into the game
 * @returns {GameEvent} A sample event
 */
export function createSampleEvent(eventName, minutes, seconds = 0) {
  return {
    event: eventName,
    timeMs: ((minutes * 60) + seconds) * 1000
  };
}
```

### 2. Update XML Event Parser

```javascript
// In src/js/timeline-video.js
function parseXmlEvents(xmlString) {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml");

        // Check for parsing errors
        const parseError = xmlDoc.getElementsByTagName('parsererror');
        if (parseError.length > 0) {
            throw new Error("XML parsing error");
        }

        // Get all event elements
        let eventElements = [];
        const eventsContainer = xmlDoc.getElementsByTagName('events')[0];

        if (eventsContainer) {
            eventElements = Array.from(eventsContainer.getElementsByTagName('event'));
        } else {
            eventElements = Array.from(xmlDoc.getElementsByTagName('event'));
        }

        const events = [];

        // Parse directly into standard format
        for (let i = 0; i < eventElements.length; i++) {
            const element = eventElements[i];

            // Get timeMs directly if available
            let timeMs;
            const timeMsAttr = element.getAttribute('timeMs');

            if (timeMsAttr) {
                timeMs = parseInt(timeMsAttr, 10);
            } else {
                // As fallback, get zero time or use a default
                timeMs = 0;
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
        return events.sort((a, b) => a.timeMs - b.timeMs);
    } catch (e) {
        console.error("Error parsing XML:", e);
        throw e;
    }
}
```

### 3. Update the Sample Events

```javascript
// In src/js/timeline-video.js
// Sample data load button handler
const loadSampleButton = document.getElementById('load-sample-data');
if (loadSampleButton) {
    loadSampleButton.addEventListener('click', () => {
        // Load sample data using standardized GameEvent format
        const sampleEvents = [
            { event: 'GOAL_FOR', timeMs: 1230000 },    // 20:30
            { event: 'FOUL', timeMs: 1035000 },        // 17:15
            { event: 'SUBSTITUTION', timeMs: 830000 }, // 13:50
            { event: 'KICKOFF', timeMs: 0 }            // 00:00
        ];

        // Update timeline
        timelineEvents = sampleEvents;
        renderTimelineEvents();

        // Save as sample game
        saveGame('Sample Game', sampleEvents, { source: 'sample-data' });

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
```

### 4. Update Timeline Rendering

Modify the `timeline.js` file to work with the standardized event format:

```javascript
// In src/js/timeline.js
import { formatTimeFromMs } from '../utils/event-utils.js';

export function renderTimeline(events, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Timeline container with ID '${containerId}' not found.`);
        return;
    }

    // Clear existing content
    container.innerHTML = '';

    // If no events, show a message
    if (!events || events.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">No events to display.</p>';
        return;
    }

    // Sort events by timeMs (most recent first for display)
    const sortedEvents = [...events].sort((a, b) => b.timeMs - a.timeMs);

    // Create a timeline container
    const timeline = document.createElement('div');
    timeline.className = 'space-y-4 py-2';

    // Add each event to the timeline
    sortedEvents.forEach(event => {
        // Format the time nicely (MM:SS)
        const timeFormatted = formatTimeFromMs(event.timeMs);

        // Create event element
        const eventElement = document.createElement('div');
        eventElement.className = 'border-l-4 border-blue-500 pl-3 py-2 bg-white rounded shadow-sm hover:bg-blue-50 transition-colors cursor-pointer';
        eventElement.setAttribute('data-time-ms', event.timeMs);

        // Add event content
        eventElement.innerHTML = `
            <p class="font-medium text-sm text-blue-800">
                ${timeFormatted} - ${event.event}
            </p>
        `;

        // Add click handler to seek video
        eventElement.addEventListener('click', () => {
            // Calculate seconds for video seeking
            const seekTime = event.timeMs / 1000;

            // Dispatch event for video component to handle
            const customEvent = new CustomEvent('timeline-event-clicked', {
                detail: {
                    event: event.event,
                    seekTime: seekTime
                }
            });
            document.dispatchEvent(customEvent);
        });

        // Add event to timeline
        timeline.appendChild(eventElement);
    });

    // Add timeline to container
    container.appendChild(timeline);
}
```

### 5. Add Data Migration Function

```javascript
// In src/js/timeline-video.js
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
                    // Default to 0 if no timeMs
                    timeMs: oldEvent.timeMs || 0
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
```

### 6. Update Save Game Function

```javascript
// In src/js/timeline-video.js
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

    // Create or update game in the saved games object
    savedGames[gameId] = {
        id: gameId,
        events: standardEvents,
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
```

### 7. Update Video Seeking Handler

```javascript
// In src/js/timeline-video.js
// Listen for timeline event clicks to seek the video
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

            // Show a notification
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
```

### 8. Update DOM Ready Handler

```javascript
// In src/js/timeline-video.js
domReady(() => {
    console.log('DOM fully loaded and parsed');

    // Migrate stored games to standard format
    migrateStoredGames();

    // Initialize UI with empty state
    toggleEmptyState(true);

    // Rest of the existing initialization code...
});
```

## Benefits of Standardization

1. **Simplified Data Model**: The event model now contains only two essential properties (`event` and `timeMs`).

2. **Improved Performance**: Smaller objects reduce memory usage and improve serialization/deserialization speed.

3. **Better Maintainability**: Using one event format throughout the application makes code easier to understand and maintain.

4. **Testing**: A consistent model makes it easier to write effective tests.

5. **Improved User Experience**: Events will be displayed consistently across the application.

6. **Direct Approach**: By directly using the standard model throughout the codebase, we avoid complex conversion logic.

## Implementation Strategy

1. Create a minimal utility for time formatting
2. Update XML parsing to directly create standard format events
3. Update the sample event data to use the standard format
4. Modify timeline rendering to work with standard events
5. Run a simple migration for existing saved games
6. Update the save function to enforce the standard format
7. Test each component thoroughly

This approach prioritizes simplicity by having components directly use the standardized format rather than relying on conversion utilities. This will improve code quality, maintainability, and performance while making future feature development more straightforward.

import { storageService } from '../services/storageService.js';
import { notificationService } from '../services/notificationService.js';

export const logger = {
    log: (message) => console.log(message),
    error: (message) => console.error(message),
    warn: (message) => console.warn(message),
};

export const showElement = (element) => {
    element.style.display = 'inline-block';
}

export const hideElement = (element) => {
    element.style.display = 'none';
}

// Reusable Components

const createButton = ({ text, className, onClick, id = null }) => {
    let button = document.getElementById(id);
    if (!button) {
        button = document.createElement('button');
    }
    button.className = className;
    button.textContent = text;
    if (onClick) {
        button.addEventListener('click', onClick);
    }
    return button;
};

export const createGameCard = ({ game, index, onLoad, onDelete, onRename }) => {
    const gameCard = document.createElement('div');
    gameCard.className = 'saved-game-card flex items-center p-4 mb-4 bg-gray-100 rounded-lg shadow-md hover:shadow-lg transition-shadow';

    const icon = document.createElement('div');
    icon.className = 'saved-game-icon flex-shrink-0 w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center mr-4';
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c.828 0 1.5-.672 1.5-1.5S12.828 5 12 5s-1.5.672-1.5 1.5S11.172 8 12 8zm0 0v8m0 0H9m3 0h3" />
    </svg>`;

    const gameDetails = document.createElement('div');
    gameDetails.className = 'saved-game-details flex-grow';

    const gameTitle = document.createElement('h3');
    gameTitle.className = 'text-lg font-bold text-gray-800';
    gameTitle.textContent = game.teams ? game.teams : `Game ${index + 1}`;

    const gameTimestamp = document.createElement('p');
    gameTimestamp.className = 'text-sm text-gray-600';
    gameTimestamp.textContent = `Saved on: ${new Date(game.timestamp).toLocaleString()}`;

    const eventCount = document.createElement('p');
    eventCount.className = 'text-sm text-gray-600';
    eventCount.textContent = `Events: ${game.events.length}`;

    gameDetails.append(gameTitle, gameTimestamp, eventCount);

    const loadButton = createButton({
        text: 'Load',
        className: 'event-button btn-blue px-4 py-2 text-sm',
        onClick: onLoad
    });

    const renameButton = createButton({
        text: 'Rename',
        className: 'event-button btn-yellow px-4 py-2 text-sm ml-2',
        onClick: onRename
    });

    const deleteButton = createButton({
        text: 'Delete',
        className: 'event-button btn-red px-4 py-2 text-sm ml-2',
        onClick: onDelete
    });

    gameCard.append(icon, gameDetails, loadButton, renameButton, deleteButton);

    return gameCard;
};

export const copyXmlToClipboard = (xmlContent) => {
    if (!xmlContent) {
        logger.warn('No XML content to copy.');
        return;
    }
    navigator.clipboard.writeText(xmlContent)
        .then(() => {
            logger.log('XML content copied to clipboard.');
            notificationService.notify('XML content copied to clipboard.', 'success');
        })
        .catch((err) => {
            logger.error('Failed to copy XML content to clipboard:', err);
            notificationService.notify('Failed to copy XML content to clipboard.', 'error');
        });
};

export const computeGameStatistics = (gameEvents) => {
    return gameEvents.reduce((stats, event) => {
        if (event && event.event) { // Ensure event and event.event are defined
            stats[event.event] = (stats[event.event] || 0) + 1;
        }
        return stats;
    }, {});
};

export const generatePlainXml = (events) => {
    return events.map((logEntry, index) => {
        const eventTimeSeconds = Math.floor(logEntry.timeMs / 1000);
        const startSeconds = Math.max(0, eventTimeSeconds - 5);
        const endSeconds = eventTimeSeconds + 5;
        const eventCode = escapeXml(logEntry.event);
        return `<instance><ID>${index + 1}</ID><start>${startSeconds}</start><end>${endSeconds}</end><code>${eventCode}</code></instance>`;
    }).join('\n');
};

export function createLogEntry({ event, time }) {
    const logItem = document.createElement('div');
    logItem.className = 'event-log-item';
    logItem.innerHTML = `<span class="font-medium text-gray-700">${escapeXml(event)}</span> <span class="text-gray-500">${formatTime(time)}</span>`;
    return logItem;
}

export function escapeXml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}

export function formatTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function updateNavbarVisibility(isVisible) {
    const requiresGameButtons = document.querySelectorAll('[data-requires-game]');
    requiresGameButtons.forEach(button => {
        button.classList.toggle('hidden', !isVisible);
    });
}

export function addVisualFeedbackToButtons(buttons) {
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            button.classList.add('clicked');
            setTimeout(() => button.classList.remove('clicked'), 200);
        });
    });
}

export function showMessage(element, message, isError = false) {
    // Use the notification service's showMessage method
    notificationService.showMessage(element, message, isError);
}

// Storage functions are now handled by the storageService module
// These functions are kept for backward compatibility
function getFromLocalStorage(key) {
    return storageService.getItem(key);
}

function setToLocalStorage(key, value) {
    return storageService.setItem(key, value);
}

export function loadConfig(configKey, defaultConfig) {
    try {
        const savedConfig = storageService.getItem(configKey);
        if (savedConfig && Array.isArray(savedConfig.rowDefs)) {
            logger.log("Loaded config from localStorage");
            return savedConfig;
        } else {
            logger.warn("Invalid config structure in localStorage, using default.");
            return defaultConfig;
        }
    } catch (error) {
        logger.error("Error loading or parsing config from localStorage:", error);
        return defaultConfig;
    }
}

export function saveConfig(configObject, configKey) {
    try {
        if (!configObject || typeof configObject !== 'object' || !Array.isArray(configObject.rowDefs)) {
            throw new Error("Invalid configuration object structure.");
        }

        const result = storageService.setItem(configKey, configObject);

        if (result === true) {
            logger.log("Configuration saved to localStorage.");
            return true;
        } else {
            // Handle error from storage service
            logger.error("Error saving config to localStorage:", result.message);
            notificationService.alert(`Error: ${result.message}`);
            return false;
        }
    } catch (error) {
        logger.error("Error saving config to localStorage:", error);
        notificationService.alert(`Error: ${error.message}`);
        return false;
    }
}

export function saveGameToLocalStorage(gameData, storageKey) {
    try {
        const savedGames = storageService.getItem(storageKey) || [];
        savedGames.push(gameData);

        // Retain only the last 5 games
        while (savedGames.length > 5) {
            savedGames.shift();
        }

        const result = storageService.setItem(storageKey, savedGames);

        if (result === true) {
            logger.log('Game saved successfully.');
            return true;
        } else {
            logger.error('Error saving game to localStorage:', result.message);
            notificationService.notify('Failed to save game data: ' + result.message, 'error');
            return false;
        }
    } catch (error) {
        logger.error('Error saving game to localStorage:', error);
        notificationService.notify('Failed to save game data', 'error');
        return false;
    }
}

export function loadSavedGames(storageKey) {
    try {
        const savedGames = storageService.getItem(storageKey);
        return savedGames || [];
    } catch (error) {
        logger.error('Error retrieving saved games from localStorage:', error);
        notificationService.notify('Failed to load saved games', 'error');
        return [];
    }
}

export function deleteSavedGame(index, storageKey) {
    try {
        const savedGames = storageService.getItem(storageKey) || [];
        if (index >= 0 && index < savedGames.length) {
            savedGames.splice(index, 1);
            const result = storageService.setItem(storageKey, savedGames);

            if (result === true) {
                logger.log('Game deleted successfully.');
                return true;
            } else {
                logger.error('Error deleting game:', result.message);
                notificationService.notify('Failed to delete game: ' + result.message, 'error');
                return false;
            }
        } else {
            logger.warn('Invalid game index for deletion.');
            return false;
        }
    } catch (error) {
        logger.error('Error deleting game from localStorage:', error);
        notificationService.notify('Failed to delete game', 'error');
        return false;
    }
}

export function updateSavedGame(index, updatedData, storageKey) {
    try {
        const savedGames = storageService.getItem(storageKey) || [];
        if (index >= 0 && index < savedGames.length) {
            // Update only the specified properties while preserving the rest
            savedGames[index] = { ...savedGames[index], ...updatedData };

            const result = storageService.setItem(storageKey, savedGames);

            if (result === true) {
                logger.log('Game updated successfully.');
                return true;
            } else {
                logger.error('Error updating game:', result.message);
                notificationService.notify('Failed to update game: ' + result.message, 'error');
                return false;
            }
        } else {
            logger.warn('Invalid game index for update.');
            return false;
        }
    } catch (error) {
        logger.error('Error updating game in localStorage:', error);
        notificationService.notify('Failed to update game', 'error');
        return false;
    }
}

export const parseXmlToEvents = (xmlContent) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');

    // Try to extract teams info from the game element if available
    let teamsAttribute = null;
    const gameElement = xmlDoc.querySelector('game');
    if (gameElement && gameElement.hasAttribute('teams')) {
        teamsAttribute = gameElement.getAttribute('teams');
    }

    const instanceNodes = Array.from(xmlDoc.getElementsByTagName('instance'));

    const events = instanceNodes.map(node => {
        const code = node.getElementsByTagName('code')[0]?.textContent;
        const start = node.getElementsByTagName('start')[0]?.textContent;
        const end = node.getElementsByTagName('end')[0]?.textContent;

        if (code && start && end) {
            const startMs = parseInt(start, 10) * 1000;
            const endMs = parseInt(end, 10) * 1000;
            const eventTimeInMilliseconds = (startMs + endMs) / 2;
            return {
                event: code,
                timeMs: eventTimeInMilliseconds
            };
        }
        return null;
    }).filter(Boolean);

    // Attach the teams attribute to the events array for later use
    if (teamsAttribute) {
        events.teamsAttribute = teamsAttribute;
    }

    return events;
};

export const validateXmlStructure = (xmlContent) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');

    if (xmlDoc.querySelector('parsererror')) {
        throw new Error('Invalid XML format.');
    }

    const instanceNodes = Array.from(xmlDoc.getElementsByTagName('instance'));
    if (instanceNodes.length === 0) {
        throw new Error('No instances found in the XML file.');
    }

    instanceNodes.forEach(node => {
        const id = node.getElementsByTagName('ID')[0]?.textContent;
        const start = node.getElementsByTagName('start')[0]?.textContent;
        const end = node.getElementsByTagName('end')[0]?.textContent;
        const code = node.getElementsByTagName('code')[0]?.textContent;

        if (!id || !start || !end || !code) {
            throw new Error('Invalid instance data in XML.');
        }
    });

    return xmlDoc;
};

// Function to display a preview of parsed events in a modal, with an optional callback
export const showPreview = (previewContainer, events, storageKey, callback = null) => {
    const teamsAttribute = events.teamsAttribute || null;

    setupImportButtons(events, storageKey, teamsAttribute, callback);

    previewContainer.innerHTML = events.map(event => `
        <div class="event-preview p-4 border-b">
            <p class="font-bold">Event: ${event.event}</p>
            <p>Time (ms): ${event.timeMs}</p>
        </div>
    `).join('');

    // Show teams information if available
    if (teamsAttribute) {
        previewContainer.innerHTML = `
            <div class="p-4 mb-4 bg-blue-50 border-blue-200 border rounded">
                <p class="font-bold">Teams: ${teamsAttribute}</p>
            </div>
        ` + previewContainer.innerHTML;
    }
};

// Function to set up the Confirm button's event listener, with an optional callback
export const setupImportButtons = (parsedEvents, storageKey, teamsAttribute = null, callback = null) => {
    const confirmButton = document.getElementById('confirmImportButton');
    const cancelButton = document.getElementById('cancelImportButton'); confirmButton.onclick = () => {
        // Prompt the user to name the game, pre-filling with teams from XML if available
        const teamsName = notificationService.prompt('Enter teams for this game (e.g., "Team A vs Team B"):', teamsAttribute || '');

        // Calculate max time as a reasonable estimate of game duration
        const maxTimeMs = parsedEvents.reduce((max, event) => Math.max(max, event.timeMs || 0), 0);

        saveGameToLocalStorage({
            events: parsedEvents,
            elapsedTime: maxTimeMs,
            timestamp: new Date().toISOString(),
            teams: teamsName ? teamsName.trim() : null
        }, storageKey); document.getElementById('previewModal').classList.add('hidden');
        if (callback) callback({ importedFileCount: 1 });
        notificationService.notify('Game imported successfully!', 'success');
    };

    cancelButton.onclick = () => {
        document.getElementById('previewModal').classList.add('hidden');
        if (callback) callback({ importedFileCount: 0 });
        notificationService.notify('Import canceled.', 'warning');
    };
};

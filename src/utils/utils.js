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

export const createButton = ({ text, className, onClick, id = null }) => {
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

export const createGameCard = ({ game, index, onLoad, onDelete }) => {
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
    gameTitle.textContent = `Game ${index + 1}`;

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

    const deleteButton = createButton({
        text: 'Delete',
        className: 'event-button btn-red px-4 py-2 text-sm ml-2',
        onClick: onDelete
    });

    gameCard.append(icon, gameDetails, loadButton, deleteButton);

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
            alert('XML content copied to clipboard.');
        })
        .catch((err) => {
            logger.error('Failed to copy XML content to clipboard:', err);
            alert('Failed to copy XML content to clipboard.');
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
    element.textContent = message;
    element.className = 'config-message';
    if (isError) {
        element.classList.add('config-error');
    } else {
        element.classList.add('config-success');
    }
    element.classList.remove('hidden');
    setTimeout(() => {
        element.classList.add('hidden');
    }, 5000);
}

function getFromLocalStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        logger.error(`Error getting data from localStorage for key: ${key}`, error);
        return null;
    }
}

function setToLocalStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        logger.error(`Error setting data to localStorage for key: ${key}`, error);
    }
}

export function loadConfig(configKey, defaultConfig) {
    try {
        const savedConfig = getFromLocalStorage(configKey);
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

        setToLocalStorage(configKey, configObject);
        logger.log("Configuration saved to localStorage.");
        return true;
    } catch (error) {
        logger.error("Error saving config to localStorage:", error);
        if (error.name === 'QuotaExceededError') {
            alert('Error: Could not save configuration. Browser storage limit exceeded.');
        } else {
            alert(`Error: ${error.message}`);
        }
        return false;
    }
}

export function saveGameToLocalStorage(gameData, storageKey) {

    try {
        const savedGames = getFromLocalStorage(storageKey) || [];
        savedGames.push(gameData);

        // Retain only the last 5 games
        while (savedGames.length > 5) {
            savedGames.shift();
        }

        setToLocalStorage(storageKey, savedGames);
        logger.log('Game saved successfully.');
    } catch (error) {
        logger.error('Error saving game to localStorage:', error);
    }
}

export function loadSavedGames(storageKey) {
    try {
        const savedGames = getFromLocalStorage(storageKey);
        return savedGames || [];
    } catch (error) {
        logger.error('Error retrieving saved games from localStorage:', error);
        return [];
    }
}

export function deleteSavedGame(index, storageKey) {
    try {
        const savedGames = getFromLocalStorage(storageKey) || [];
        if (index >= 0 && index < savedGames.length) {
            savedGames.splice(index, 1);
            setToLocalStorage(storageKey, savedGames);
            logger.log('Game deleted successfully.');
        } else {
            logger.warn('Invalid game index for deletion.');
        }
    } catch (error) {
        logger.error('Error deleting game from localStorage:', error);
    }
}

export const parseXmlToEvents = (xmlContent) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');
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

    setupImportButtons(events, storageKey, callback);
    previewContainer.innerHTML = events.map(event => `
        <div class="event-preview p-4 border-b">
            <p class="font-bold">Event: ${event.event}</p>
            <p>Time (ms): ${event.timeMs}</p>
        </div>
    `).join('');

};

// Function to set up the Confirm button's event listener, with an optional callback
export const setupImportButtons = (parsedEvents, storageKey, callback = null) => {
    const confirmButton = document.getElementById('confirmImportButton');
    const cancelButton = document.getElementById('cancelImportButton');
    cancelButton.onclick = () => {
        document.getElementById('previewModal').classList.add('hidden');
        if (callback) callback({ importedFileCount: 0 });
        alert('Import canceled.');
    };
    confirmButton.onclick = () => {
        saveGameToLocalStorage({
            events: parsedEvents,
            elapsedTime: 0,
            timestamp: new Date().toISOString()
        }, storageKey);
        alert('XML imported successfully!');
        document.getElementById('previewModal').classList.add('hidden');
        if (callback) callback({ importedFileCount: 1 });
    };
};

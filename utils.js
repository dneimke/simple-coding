// Reusable Components

export function createButton({ text, className, onClick, id = null, }) {
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
}

export function createGameCard({ game, index, onLoad, onDelete }) {
    const gameCard = document.createElement('div');
    gameCard.className = 'saved-game-card flex items-center p-4 mb-4 bg-gray-100 rounded-lg shadow-md hover:shadow-lg transition-shadow';

    const icon = document.createElement('div');
    icon.className = 'saved-game-icon flex-shrink-0 w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center mr-4';
    icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c.828 0 1.5-.672 1.5-1.5S12.828 5 12 5s-1.5.672-1.5 1.5S11.172 8 12 8zm0 0v8m0 0H9m3 0h3" /></svg>';

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

    gameDetails.appendChild(gameTitle);
    gameDetails.appendChild(gameTimestamp);
    gameDetails.appendChild(eventCount);

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

    gameCard.appendChild(icon);
    gameCard.appendChild(gameDetails);
    gameCard.appendChild(loadButton);
    gameCard.appendChild(deleteButton);

    return gameCard;
}

export function copyXmlToClipboard(xmlContent) {
    if (!xmlContent) {
        console.warn("No XML content to copy.");
        return;
    }
    navigator.clipboard.writeText(xmlContent).then(() => {
        console.log("XML content copied to clipboard.");
        alert("XML content copied to clipboard.");
    }).catch(err => {
        console.error("Failed to copy XML content to clipboard:", err);
        alert("Failed to copy XML content to clipboard.");
    });
}

export function computeGameStatistics(currentGame) {
    const stats = currentGame.loggedEvents.reduce((stats, event) => {
        stats[event.event] = (stats[event.event] || 0) + 1;
        return stats;
    }, {});

    return stats;
}

export function renderStatistics(statsContainerId, currentGame) {
    const statsContainer = document.getElementById(statsContainerId);
    statsContainer.innerHTML = '';

    let gameStatistics = computeGameStatistics(currentGame);

    if (Object.keys(gameStatistics).length === 0) {
        statsContainer.innerHTML = '<p class="text-gray-500 text-center">No statistics available.</p>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'min-w-full bg-white border border-gray-200';

    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th class="px-4 py-2 border-b">Event</th>
            <th class="px-4 py-2 border-b">Count</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    Object.entries(gameStatistics).forEach(([event, count]) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-4 py-2 border-b">${event}</td>
            <td class="px-4 py-2 border-b">${count}</td>
        `;
        tbody.appendChild(row);
    });
    table.appendChild(tbody);

    statsContainer.appendChild(table);
}

export function generatePlainXml(events) {
    let xmlString = '';
    events.forEach((logEntry, index) => {
        const eventTimeSeconds = Math.floor(logEntry.timeMs / 1000);
        const startSeconds = Math.max(0, eventTimeSeconds - 5);
        const endSeconds = eventTimeSeconds + 5;
        const eventCode = escapeXml(logEntry.event);
        xmlString += `<instance><ID>${index + 1}</ID><start>${startSeconds}</start><end>${endSeconds}</end><code>${eventCode}</code></instance>\n`;
    });
    return xmlString.trim();
}

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

export function loadConfig(configKey) {
    try {
        const savedConfig = localStorage.getItem(configKey);
        if (savedConfig) {
            const parsed = JSON.parse(savedConfig);
            if (parsed && Array.isArray(parsed.leftColumn) && Array.isArray(parsed.rightColumn)) {
                console.log("Loaded config from localStorage");
                return parsed;
            } else {
                console.warn("Invalid config structure in localStorage, using default.");
                return DEFAULT_CONFIG;
            }
        } else {
            console.log("No config found in localStorage, using default.");
            return DEFAULT_CONFIG;
        }
    } catch (error) {
        console.error("Error loading or parsing config from localStorage:", error);
        return DEFAULT_CONFIG;
    }
}

export function saveConfig(configObject, configKey) {
    try {
        if (!configObject || typeof configObject !== 'object' || !Array.isArray(configObject.leftColumn) || !Array.isArray(configObject.rightColumn)) {
            throw new Error("Invalid configuration object structure.");
        }
        localStorage.setItem(configKey, JSON.stringify(configObject));
        console.log("Configuration saved to localStorage.");
        return true;
    } catch (error) {
        console.error("Error saving config to localStorage:", error);
        if (error.name === 'QuotaExceededError') {
            alert('Error: Could not save configuration. Browser storage limit exceeded.');
        } else {
            alert(`Error: ${error.message}`);
        }
        return false;
    }
}

export function updateNavbarVisibility(currentGameState) {
    const requiresGameButtons = document.querySelectorAll('[data-requires-game]');
    requiresGameButtons.forEach(button => {
        button.classList.toggle('hidden', !currentGameState.hasCurrentGame);
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

export function getFromLocalStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error(`Error getting data from localStorage for key: ${key}`, error);
        return null;
    }
}

export function setToLocalStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error(`Error setting data to localStorage for key: ${key}`, error);
    }
}
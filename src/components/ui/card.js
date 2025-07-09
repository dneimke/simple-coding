/**
 * Card UI components
 * @module components/ui/card
 */
import { createButton } from './button.js';
import { generateGameXml, getInvalidEvents } from '../../utils/xmlUtils.js';

/**
 * Creates a basic card container with Tailwind styling
 *
 * @param {Object} options - Card configuration
 * @param {string|HTMLElement} [options.header] - Card header content
 * @param {string|HTMLElement} [options.body] - Card body content
 * @param {string|HTMLElement} [options.footer] - Card footer content
 * @param {string} [options.className] - Additional CSS classes
 * @returns {HTMLDivElement} The created card element
 */
export const createCard = ({
    header = null,
    body = null,
    footer = null,
    className = ''
}) => {
    const card = document.createElement('div');
    card.className = `bg-white rounded-lg shadow-md overflow-hidden ${className}`;

    // Add header if provided
    if (header) {
        const headerElement = document.createElement('div');
        headerElement.className = 'px-4 py-3 border-b border-gray-200 bg-gray-50';

        if (typeof header === 'string') {
            headerElement.innerHTML = header;
        } else {
            headerElement.appendChild(header);
        }

        card.appendChild(headerElement);
    }

    // Add body if provided
    if (body) {
        const bodyElement = document.createElement('div');
        bodyElement.className = 'p-4';

        if (typeof body === 'string') {
            bodyElement.innerHTML = body;
        } else {
            bodyElement.appendChild(body);
        }

        card.appendChild(bodyElement);
    }

    // Add footer if provided
    if (footer) {
        const footerElement = document.createElement('div');
        footerElement.className = 'px-4 py-3 border-t border-gray-200 bg-gray-50';

        if (typeof footer === 'string') {
            footerElement.innerHTML = footer;
        } else {
            footerElement.appendChild(footer);
        }

        card.appendChild(footerElement);
    }

    return card;
};

/**
 * Creates a card for displaying saved game information
 * * @param {Object} options - Game card configuration
 * @param {Object} options.game - Game data object containing events, timestamp, etc.
 * @param {number} options.index - Index of the game in the list
 * @param {Function} options.onDelete - Delete game handler
 * @param {Function} options.onRename - Rename game handler
 * @returns {HTMLDivElement} The created game card element
 */
export const createGameCard = ({
    game,
    index,
    onDelete,
    onRename
}) => {
    const gameCard = document.createElement('div');
    gameCard.className = 'saved-game-card flex items-center p-4 mb-4 bg-gray-100 rounded-lg shadow-md hover:shadow-lg transition-shadow';

    // Create icon section
    const icon = document.createElement('div');
    icon.className = 'saved-game-icon flex-shrink-0 w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center mr-4';
    icon.innerHTML = `<i class="fas fa-hockey-puck text-xl"></i>`;

    // Create game details section
    const gameDetails = document.createElement('div');
    gameDetails.className = 'saved-game-details flex-grow';


    // Game title row (with warning if invalid events)
    const gameTitleRow = document.createElement('div');
    gameTitleRow.className = 'flex items-center';

    const gameTitle = document.createElement('h3');
    gameTitle.className = 'text-lg font-bold text-gray-800';
    gameTitle.textContent = game.teams ? game.teams : `Game ${index + 1}`;
    gameTitleRow.appendChild(gameTitle);

    // Check for invalid events
    const invalidEvents = getInvalidEvents(game);
    if (invalidEvents.length > 0) {
        // Warning icon
        const warningIcon = document.createElement('span');
        warningIcon.className = 'ml-2 text-amber-600';
        warningIcon.title = 'This game has invalid events';
        warningIcon.setAttribute('aria-label', 'Warning');
        warningIcon.setAttribute('role', 'img');
        warningIcon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
        gameTitleRow.appendChild(warningIcon);

        // View Issues button
        const viewIssuesBtn = document.createElement('button');
        viewIssuesBtn.className = 'ml-2 text-xs text-blue-600 underline focus:outline-none';
        viewIssuesBtn.textContent = 'View Issues';
        viewIssuesBtn.type = 'button';
        viewIssuesBtn.onclick = (e) => {
            e.stopPropagation();
            showInvalidEventsModal(game, invalidEvents);
        };
        gameTitleRow.appendChild(viewIssuesBtn);
    }

    // Timestamp
    const gameTimestamp = document.createElement('p');
    gameTimestamp.className = 'text-sm text-gray-600';
    gameTimestamp.textContent = `Saved on: ${new Date(game.timestamp).toLocaleString()}`;

    // Event count
    const eventCount = document.createElement('p');
    eventCount.className = 'text-sm text-gray-600';
    eventCount.textContent = `Events: ${game.events.length}`;

    gameDetails.append(gameTitleRow, gameTimestamp, eventCount);
    const exportButton = createButton({
        text: 'Export XML',
        type: 'secondary',
        className: 'px-4 py-2 text-sm ml-2',
        onClick: (e) => {            // Prevent event bubbling
            e.stopPropagation();

            // Generate XML content using the utility function
            const xmlContent = generateGameXml(game, index + 1);

            // Create and trigger download
            const blob = new Blob([xmlContent], { type: 'application/xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const fileName = (game.teams || `game-${index + 1}`).toLowerCase().replace(/\s+/g, '-');

            a.href = url;
            a.download = `${fileName}.xml`;
            document.body.appendChild(a);
            a.click();

            // Clean up
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 0);
        }
    });

    const renameButton = createButton({
        text: 'Rename',
        type: 'warning',
        className: 'px-4 py-2 text-sm ml-2',
        onClick: onRename
    });

    const deleteButton = createButton({
        text: 'Delete',
        type: 'danger',
        className: 'px-4 py-2 text-sm ml-2',
        onClick: onDelete
    });    // Add all elements to card

    gameCard.append(icon, gameDetails, exportButton, renameButton, deleteButton);

    // Modal for invalid events (one per page, reused)
    if (!document.getElementById('invalid-events-modal')) {
        const modal = document.createElement('div');
        modal.id = 'invalid-events-modal';
        modal.className = 'fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 hidden z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-lg p-6 max-w-lg w-full">
                <h2 class="text-xl font-bold mb-4">Invalid Events</h2>
                <div id="invalid-events-list" class="max-h-60 overflow-y-auto mb-4"></div>
                <div class="flex justify-end">
                    <button id="closeInvalidEventsModal" class="event-button btn-blue px-4 py-2">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('closeInvalidEventsModal').onclick = () => {
            modal.classList.add('hidden');
        };
    }

    // Helper to show the modal with details
    function showInvalidEventsModal(game, invalidEvents) {
        const modal = document.getElementById('invalid-events-modal');
        const list = document.getElementById('invalid-events-list');
        if (!modal || !list) return;
        list.innerHTML = invalidEvents.map(({ event, idx }) => {
            const eventName = event && typeof event.event === 'string' ? event.event : '<span class="text-red-600">(missing name)</span>';
            const time = (event && typeof event.timeMs === 'number' && isFinite(event.timeMs)) ? event.timeMs : '<span class="text-red-600">(invalid time)</span>';
            return `<div class="mb-2 p-2 bg-red-50 rounded"><strong>Event #${idx + 1}:</strong> Name: ${eventName}, Time: ${time}</div>`;
        }).join('');
        modal.classList.remove('hidden');
    }

    return gameCard;
};

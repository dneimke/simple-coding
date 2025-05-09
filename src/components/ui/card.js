/**
 * Card UI components
 * @module components/ui/card
 */
import { createButton } from './button.js';
import { generateGameXml } from '../../utils/xmlUtils.js';

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
 *
 * @param {Object} options - Game card configuration
 * @param {Object} options.game - Game data object containing events, timestamp, etc.
 * @param {number} options.index - Index of the game in the list
 * @param {Function} options.onLoad - Load game handler
 * @param {Function} options.onDelete - Delete game handler
 * @param {Function} options.onRename - Rename game handler
 * @returns {HTMLDivElement} The created game card element
 */
export const createGameCard = ({
    game,
    index,
    onLoad,
    onDelete,
    onRename
}) => {
    const gameCard = document.createElement('div');
    gameCard.className = 'saved-game-card flex items-center p-4 mb-4 bg-gray-100 rounded-lg shadow-md hover:shadow-lg transition-shadow';

    // Create icon section
    const icon = document.createElement('div');
    icon.className = 'saved-game-icon flex-shrink-0 w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center mr-4';
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c.828 0 1.5-.672 1.5-1.5S12.828 5 12 5s-1.5.672-1.5 1.5S11.172 8 12 8zm0 0v8m0 0H9m3 0h3" />
  </svg>`;

    // Create game details section
    const gameDetails = document.createElement('div');
    gameDetails.className = 'saved-game-details flex-grow';

    // Game title
    const gameTitle = document.createElement('h3');
    gameTitle.className = 'text-lg font-bold text-gray-800';
    gameTitle.textContent = game.teams ? game.teams : `Game ${index + 1}`;

    // Timestamp
    const gameTimestamp = document.createElement('p');
    gameTimestamp.className = 'text-sm text-gray-600';
    gameTimestamp.textContent = `Saved on: ${new Date(game.timestamp).toLocaleString()}`;

    // Event count
    const eventCount = document.createElement('p');
    eventCount.className = 'text-sm text-gray-600';
    eventCount.textContent = `Events: ${game.events.length}`;

    gameDetails.append(gameTitle, gameTimestamp, eventCount);    // Create action buttons
    const loadButton = createButton({
        text: 'Load',
        type: 'primary',
        className: 'px-4 py-2 text-sm',
        onClick: onLoad
    });

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
    });

    // Add all elements to card
    gameCard.append(icon, gameDetails, loadButton, exportButton, renameButton, deleteButton);

    return gameCard;
};

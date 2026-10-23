/**
 * Card UI components
 * @module components/ui/card
 */
import { createButton, createIconButton } from './button.js';
import { generateGameXml, getInvalidEvents } from '../../utils/xmlUtils.js';

let openGameMenu = null;

const closeGameMenu = () => {
    if (!openGameMenu) return;
    const { menu, toggle } = openGameMenu;
    menu.classList.add('hidden');
    toggle.setAttribute('aria-expanded', 'false');
    openGameMenu = null;
    document.removeEventListener('click', onDocumentClick, true);
    document.removeEventListener('keydown', onDocumentKeydown);
};

function onDocumentClick(e) {
    if (openGameMenu && !openGameMenu.wrapper.contains(e.target)) {
        closeGameMenu();
    }
}

function onDocumentKeydown(e) {
    if (e.key !== 'Escape' || !openGameMenu) return;
    const { toggle } = openGameMenu;
    closeGameMenu();
    toggle.focus();
}

const openMenu = (wrapper, toggle, menu) => {
    closeGameMenu();
    menu.classList.remove('hidden');
    toggle.setAttribute('aria-expanded', 'true');
    openGameMenu = { wrapper, toggle, menu };
    // Capture phase, because card buttons stop propagation of their clicks
    document.addEventListener('click', onDocumentClick, true);
    document.addEventListener('keydown', onDocumentKeydown);
    menu.querySelector('[role="menuitem"]')?.focus({ preventScroll: true });
    menu.scrollIntoView?.({ block: 'nearest' });
};

/**
 * Builds the overflow menu for a saved game's secondary actions
 * @param {string} title - Game name, used in the toggle's accessible label
 * @param {Array<{text: string, onClick: Function, danger?: boolean}>} items - Menu items in display order
 * @returns {HTMLDivElement} Wrapper holding the toggle and the menu
 */
const createGameMenu = (title, items) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'saved-game-more';

    const menu = document.createElement('div');
    menu.className = 'saved-game-menu hidden';
    menu.setAttribute('role', 'menu');

    const toggle = createIconButton({
        icon: '<i class="fas fa-ellipsis-vertical" aria-hidden="true"></i>',
        ariaLabel: `More actions for ${title}`,
        type: 'ghost'
    });
    toggle.type = 'button';
    toggle.setAttribute('aria-haspopup', 'menu');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.onclick = (e) => {
        e.stopPropagation();
        if (openGameMenu && openGameMenu.menu === menu) {
            closeGameMenu();
        } else {
            openMenu(wrapper, toggle, menu);
        }
    };

    const menuItems = items.map(({ text, onClick, danger }) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = danger ? 'saved-game-menu-item saved-game-menu-item-danger' : 'saved-game-menu-item';
        item.setAttribute('role', 'menuitem');
        item.textContent = text;
        item.onclick = (e) => {
            e.stopPropagation();
            closeGameMenu();
            onClick(e);
        };
        return item;
    });

    menu.onkeydown = (e) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        const current = menuItems.indexOf(document.activeElement);
        const next = current === -1
            ? (step > 0 ? 0 : menuItems.length - 1)
            : (current + step + menuItems.length) % menuItems.length;
        menuItems[next].focus();
    };

    menu.append(...menuItems);
    wrapper.append(toggle, menu);
    return wrapper;
};

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
    card.className = `surface overflow-hidden ${className}`;

    // Add header if provided
    if (header) {
        const headerElement = document.createElement('div');
        headerElement.className = 'card-header';

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
        bodyElement.className = 'card-body';

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
        footerElement.className = 'card-footer';

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
 * @param {Function} [options.onSelect] - Opens the game in Match Review, from the Review button, icon, or details
 * @param {Function} [options.onContinueCoding] - Opens the game directly in video coding mode from the More menu
 * @param {Function} [options.onViewLog] - Called when View log is chosen from the More menu
 * @returns {HTMLDivElement} The created game card element
 */
export const createGameCard = ({
    game,
    index,
    onDelete,
    onRename,
    onSelect,
    onContinueCoding,
    onViewLog
}) => {
    const gameCard = document.createElement('div');
    gameCard.className = 'saved-game-card';

    // Create icon section
    const icon = document.createElement('div');
    icon.className = 'saved-game-icon';
    icon.innerHTML = `<i class="fas fa-hockey-puck" aria-hidden="true"></i>`;

    // Create game details section
    const gameDetails = document.createElement('div');
    gameDetails.className = 'saved-game-details';


    // Game title row (with warning if invalid events)
    const gameTitleRow = document.createElement('div');
    gameTitleRow.className = 'flex flex-wrap items-center gap-x-2';

    const title = game.teams ? game.teams : `Game ${index + 1}`;
    const gameTitle = document.createElement('h3');
    gameTitle.textContent = title;
    gameTitleRow.appendChild(gameTitle);

    // Check for invalid events
    const invalidEvents = getInvalidEvents(game);
    if (invalidEvents.length > 0) {
        // Warning icon
        const warningIcon = document.createElement('span');
        warningIcon.className = 'saved-game-warning';
        warningIcon.title = 'This game has invalid events';
        warningIcon.setAttribute('aria-label', 'Warning');
        warningIcon.setAttribute('role', 'img');
        warningIcon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
        gameTitleRow.appendChild(warningIcon);

        // View Issues button
        const viewIssuesBtn = document.createElement('button');
        viewIssuesBtn.className = 'link-button saved-game-issues';
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
    gameTimestamp.textContent = `Saved on: ${new Date(game.timestamp).toLocaleString()}`;

    // Event count
    const eventCount = document.createElement('p');
    eventCount.textContent = `Events: ${game.events.length}`;

    gameDetails.append(gameTitleRow, gameTimestamp, eventCount);

    if (onSelect) {
        gameDetails.classList.add('cursor-pointer');
        gameDetails.setAttribute('role', 'button');
        gameDetails.setAttribute('tabindex', '0');
        gameDetails.setAttribute('aria-label', `Review ${title}`);
        gameDetails.title = 'Open in Match Review';
        gameDetails.addEventListener('click', onSelect);
        gameDetails.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(e);
            }
        });

        icon.classList.add('cursor-pointer');
        icon.addEventListener('click', onSelect);
    }

    const exportGame = () => {
        // Check for invalid events before exporting
        const invalidEvents = getInvalidEvents(game);
        if (invalidEvents.length > 0) {
            // Show a confirmation dialog
            const proceed = window.confirm(
                `Warning: This game has ${invalidEvents.length} invalid event(s).\n` +
                `Invalid events may be missing required fields or have invalid data.\n` +
                `Do you want to proceed with the export?`
            );
            if (!proceed) {
                // Explicitly abort export and do not trigger download or toast
                return;
            }
        }

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
    };

    const reviewButton = onSelect ? createButton({
        text: 'Review',
        type: 'secondary',
        icon: '<i class="fas fa-film" aria-hidden="true"></i>',
        className: 'saved-game-review',
        onClick: (e) => {
            e.stopPropagation();
            onSelect(e);
        }
    }) : null;

    const menu = createGameMenu(title, [
        onContinueCoding && { text: 'Continue coding', onClick: onContinueCoding },
        onViewLog && { text: 'View log', onClick: onViewLog },
        { text: 'Export XML', onClick: exportGame },
        { text: 'Rename', onClick: onRename },
        { text: 'Delete', onClick: onDelete, danger: true }
    ].filter(Boolean));

    const actions = document.createElement('div');
    actions.className = 'saved-game-actions';
    actions.append(...[reviewButton, menu].filter(Boolean));

    gameCard.append(icon, gameDetails, actions);

    // Modal for invalid events (one per page, reused)
    if (!document.getElementById('invalid-events-modal')) {
        const modal = document.createElement('div');
        modal.id = 'invalid-events-modal';
        modal.className = 'modal hidden';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.innerHTML = `
            <div class="modal-panel">
                <h2 class="modal-title mb-4">Invalid Events</h2>
                <div id="invalid-events-list" class="max-h-60 overflow-y-auto"></div>
                <div class="modal-actions">
                    <button id="closeInvalidEventsModal" type="button" class="btn btn-primary">Close</button>
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
            const eventName = event && typeof event.event === 'string' ? event.event : '<strong>(missing name)</strong>';
            const time = (event && typeof event.timeMs === 'number' && isFinite(event.timeMs)) ? event.timeMs : '<strong>(invalid time)</strong>';
            return `<div class="banner banner-error mb-2"><span><strong>Event #${idx + 1}:</strong> Name: ${eventName}, Time: ${time}</span></div>`;
        }).join('');
        modal.classList.remove('hidden');
    }

    return gameCard;
};

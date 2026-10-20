/**
 * Shows the capture bar for the current game.
 * Before a game: board selector and Start.
 * During a game: Log beside the last code, plus Pause and Finish. The board is hidden.
 * @param {{ hasGame: boolean, isRunning: boolean, lastEventText: string }} state
 */
export function syncCaptureChrome({ hasGame, isRunning, lastEventText }) {
    const board = document.getElementById('captureBoard');
    const context = document.getElementById('captureContext');
    const last = document.getElementById('lastEventBar');
    const lastLabel = document.getElementById('lastEventLabel');
    const boardSelect = document.getElementById('boardSelect');
    const start = document.getElementById('newGameButton');
    const log = document.getElementById('captureLogButton');
    const pause = document.getElementById('pauseResumeButton');
    const finish = document.getElementById('finishGameMenu');

    const showLast = Boolean(hasGame && lastEventText);
    board.classList.toggle('hidden', hasGame);
    last.classList.toggle('hidden', !showLast);
    context.classList.remove('hidden');
    lastLabel.textContent = showLast ? lastEventText : '';

    boardSelect.disabled = hasGame;
    boardSelect.title = hasGame ? 'Complete or discard the game to change board' : 'Choose the button board';

    start.classList.toggle('hidden', hasGame);
    log.classList.toggle('hidden', !hasGame);
    pause.classList.toggle('hidden', !hasGame);
    pause.textContent = hasGame && !isRunning ? 'Resume' : 'Pause';
    finish.classList.toggle('hidden', !hasGame);

    if (!hasGame) closeFinishMenu();
}

let openFinishMenu = null;

function closeFinishMenu() {
    if (!openFinishMenu) return;
    const { menu, toggle, onDocClick, onKeydown } = openFinishMenu;
    menu.classList.add('hidden');
    toggle.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', onDocClick, true);
    document.removeEventListener('keydown', onKeydown);
    openFinishMenu = null;
}

/**
 * Wires the Finish menu. Complete and Discard stay in the menu so the bar keeps one quiet control for ending a game.
 */
export function bindFinishMenu() {
    if (openFinishMenu) closeFinishMenu();

    const wrapper = document.getElementById('finishGameMenu');
    const toggle = document.getElementById('finishGameButton');
    const menu = document.getElementById('finishGameList');
    const items = [...menu.querySelectorAll('[role="menuitem"]')];

    const open = () => {
        closeFinishMenu();
        menu.classList.remove('hidden');
        toggle.setAttribute('aria-expanded', 'true');

        const onDocClick = (event) => {
            if (!wrapper.contains(event.target)) closeFinishMenu();
        };
        const onKeydown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeFinishMenu();
                toggle.focus();
                return;
            }
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
            if (!wrapper.contains(document.activeElement) && document.activeElement !== toggle) return;
            event.preventDefault();
            const step = event.key === 'ArrowDown' ? 1 : -1;
            const current = items.indexOf(document.activeElement);
            const next = current === -1
                ? (step > 0 ? 0 : items.length - 1)
                : (current + step + items.length) % items.length;
            items[next].focus();
        };

        openFinishMenu = { menu, toggle, onDocClick, onKeydown };
        document.addEventListener('click', onDocClick, true);
        document.addEventListener('keydown', onKeydown);
        items[0]?.focus();
    };

    toggle.addEventListener('click', (event) => {
        event.stopPropagation();
        if (menu.classList.contains('hidden')) open();
        else closeFinishMenu();
    });

    menu.addEventListener('click', (event) => {
        if (event.target.closest('[role="menuitem"]')) closeFinishMenu();
    });
}

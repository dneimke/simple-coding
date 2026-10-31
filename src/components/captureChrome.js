/**
 * Shows the capture bar for the current game.
 * Before a game: board selector and Set Up Match.
 * Armed game (elapsedTime === 0, !isRunning): Start Clock (btn-green) and Finish menu.
 * During a running game: Log beside the last code, plus Pause (btn-yellow) and Finish.
 * During a paused game (elapsedTime > 0, !isRunning): Log, Resume (btn-green), and Finish.
 * @param {{ hasGame: boolean, isRunning: boolean, lastEventText: string, elapsedTime?: number }} state
 */
export function syncCaptureChrome({ hasGame, isRunning, lastEventText, elapsedTime = 0 }) {
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
    if (board) board.classList.toggle('hidden', hasGame);
    if (last) last.classList.toggle('hidden', !showLast);
    if (context) context.classList.remove('hidden');
    if (lastLabel) lastLabel.textContent = showLast ? lastEventText : '';

    if (boardSelect) {
        boardSelect.disabled = hasGame;
        boardSelect.title = hasGame ? 'Complete or discard the game to change board' : 'Choose the button board';
    }

    if (start) {
        start.classList.toggle('hidden', hasGame);
        start.textContent = 'Set Up Match';
        start.classList.remove('btn-green');
        start.classList.add('btn-blue');
    }
    if (log) log.classList.toggle('hidden', !hasGame);
    if (pause) {
        pause.classList.toggle('hidden', !hasGame);
        if (hasGame && !isRunning) {
            pause.textContent = (elapsedTime === 0) ? 'Start Clock' : 'Resume';
            pause.classList.remove('btn-yellow');
            pause.classList.add('btn-green');
        } else {
            pause.textContent = 'Pause';
            pause.classList.remove('btn-green');
            pause.classList.add('btn-yellow');
        }
    }
    if (finish) finish.classList.toggle('hidden', !hasGame);

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
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                const next = (items.indexOf(document.activeElement) + 1) % items.length;
                items[next].focus();
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                const currentIndex = items.indexOf(document.activeElement);
                const prev = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
                items[prev].focus();
            }
        };

        document.addEventListener('click', onDocClick, true);
        document.addEventListener('keydown', onKeydown);
        openFinishMenu = { menu, toggle, onDocClick, onKeydown };
        items[0]?.focus();
    };

    toggle.addEventListener('click', () => {
        if (menu.classList.contains('hidden')) {
            open();
        } else {
            closeFinishMenu();
        }
    });

    items.forEach(item => item.addEventListener('click', () => closeFinishMenu()));
}

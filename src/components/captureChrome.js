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
    board.classList.toggle('hidden', hasGame);
    last.classList.toggle('hidden', !showLast);
    context.classList.remove('hidden');
    lastLabel.textContent = showLast ? lastEventText : '';

    boardSelect.disabled = hasGame;
    boardSelect.title = hasGame ? 'Complete or discard the game to change board' : 'Choose the button board';

    start.classList.toggle('hidden', hasGame);
    log.classList.toggle('hidden', !hasGame);
    finish.classList.toggle('hidden', !hasGame);

    syncPauseButton(pause, hasGame, isRunning, elapsedTime);

    if (!hasGame) closeFinishMenu();
}

function syncPauseButton(button, hasGame, isRunning, elapsedTime) {
    button.classList.toggle('hidden', !hasGame);
    if (!hasGame) return;

    const isArmed = !isRunning && elapsedTime === 0;
    const isPaused = !isRunning && elapsedTime > 0;
    button.textContent = isArmed ? 'Start Clock' : (isPaused ? 'Resume' : 'Pause');
    button.classList.toggle('btn-green', !isRunning);
    button.classList.toggle('btn-yellow', isRunning);
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

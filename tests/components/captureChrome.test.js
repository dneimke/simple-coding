import { bindFinishMenu, syncCaptureChrome } from '../../src/components/captureChrome.js';

const markup = () => {
    document.body.innerHTML = `
        <div id="captureContext">
            <div id="captureBoard"></div>
            <div id="lastEventBar" class="hidden">
                <span id="lastEventLabel"></span>
                <button id="undoEventButton" type="button">Undo</button>
            </div>
        </div>
        <select id="boardSelect"></select>
        <button id="newGameButton" type="button" class="event-button btn-blue">Set Up Match</button>
        <a id="captureLogButton" class="btn btn-secondary hidden" href="#log">Log</a>
        <button id="pauseResumeButton" type="button" class="event-button btn-yellow hidden">Pause</button>
        <div id="finishGameMenu" class="hidden">
            <button id="finishGameButton" type="button" aria-expanded="false" aria-controls="finishGameList">Finish</button>
            <div id="finishGameList" class="hidden" role="menu">
                <button id="completeGameButton" type="button" role="menuitem">Complete</button>
                <button id="discardGameButton" type="button" role="menuitem">Discard</button>
            </div>
        </div>`;
};

const hidden = (id) => document.getElementById(id).classList.contains('hidden');

describe('syncCaptureChrome', () => {
    beforeEach(markup);

    test('before a game, the bar shows the board and Set Up Match', () => {
        syncCaptureChrome({ hasGame: false, isRunning: false, lastEventText: '', elapsedTime: 0 });

        expect(hidden('captureBoard')).toBe(false);
        expect(hidden('captureContext')).toBe(false);
        expect(hidden('newGameButton')).toBe(false);
        expect(document.getElementById('newGameButton').textContent).toBe('Set Up Match');
        expect(document.getElementById('newGameButton').classList.contains('btn-blue')).toBe(true);
        expect(hidden('pauseResumeButton')).toBe(true);
        expect(hidden('captureLogButton')).toBe(true);
        expect(hidden('finishGameMenu')).toBe(true);
        expect(hidden('lastEventBar')).toBe(true);
        expect(document.getElementById('boardSelect').disabled).toBe(false);
    });

    test('when a game is armed at 00:00, the bar shows Start Clock in green and Finish menu', () => {
        syncCaptureChrome({ hasGame: true, isRunning: false, lastEventText: '', elapsedTime: 0 });

        expect(hidden('captureBoard')).toBe(true);
        expect(hidden('newGameButton')).toBe(true);
        expect(hidden('pauseResumeButton')).toBe(false);
        expect(document.getElementById('pauseResumeButton').textContent).toBe('Start Clock');
        expect(document.getElementById('pauseResumeButton').classList.contains('btn-green')).toBe(true);
        expect(document.getElementById('pauseResumeButton').classList.contains('btn-yellow')).toBe(false);
        expect(hidden('captureLogButton')).toBe(false);
        expect(hidden('finishGameMenu')).toBe(false);
        expect(hidden('lastEventBar')).toBe(true);
        expect(document.getElementById('boardSelect').disabled).toBe(true);
    });

    test('during a game, the board is hidden and the bar shows Pause, Finish, and the last code', () => {
        syncCaptureChrome({ hasGame: true, isRunning: true, lastEventText: 'FIRE GOAL · 00:57', elapsedTime: 57000 });

        expect(hidden('captureBoard')).toBe(true);
        expect(hidden('newGameButton')).toBe(true);
        expect(hidden('pauseResumeButton')).toBe(false);
        expect(document.getElementById('pauseResumeButton').textContent).toBe('Pause');
        expect(document.getElementById('pauseResumeButton').classList.contains('btn-yellow')).toBe(true);
        expect(document.getElementById('pauseResumeButton').classList.contains('btn-green')).toBe(false);
        expect(hidden('captureLogButton')).toBe(false);
        expect(hidden('finishGameMenu')).toBe(false);
        expect(hidden('lastEventBar')).toBe(false);
        expect(document.getElementById('lastEventLabel').textContent).toBe('FIRE GOAL · 00:57');
        expect(document.getElementById('boardSelect').disabled).toBe(true);
    });

    test('when paused mid-game with banked time, the bar shows Resume in green', () => {
        syncCaptureChrome({ hasGame: true, isRunning: false, lastEventText: 'FIRE GOAL · 00:57', elapsedTime: 57000 });

        expect(hidden('captureContext')).toBe(false);
        expect(hidden('lastEventBar')).toBe(false);
        expect(hidden('captureLogButton')).toBe(false);
        expect(document.getElementById('pauseResumeButton').textContent).toBe('Resume');
        expect(document.getElementById('pauseResumeButton').classList.contains('btn-green')).toBe(true);
        expect(document.getElementById('pauseResumeButton').classList.contains('btn-yellow')).toBe(false);
    });

    test('ending the game closes Finish and brings the board and Set Up Match back', () => {
        bindFinishMenu(document);
        syncCaptureChrome({ hasGame: true, isRunning: true, lastEventText: 'FIRE BS2 · 00:10', elapsedTime: 10000 });
        document.getElementById('finishGameButton').click();
        expect(hidden('finishGameList')).toBe(false);

        syncCaptureChrome({ hasGame: false, isRunning: false, lastEventText: '', elapsedTime: 0 });

        expect(hidden('finishGameList')).toBe(true);
        expect(document.getElementById('finishGameButton').getAttribute('aria-expanded')).toBe('false');
        expect(hidden('captureLogButton')).toBe(true);
        expect(hidden('captureBoard')).toBe(false);
        expect(document.getElementById('newGameButton').textContent).toBe('Set Up Match');
    });
});

describe('bindFinishMenu', () => {
    beforeEach(() => {
        markup();
        bindFinishMenu(document);
    });

    test('Finish reveals Complete and Discard, and a second press hides them', () => {
        const toggle = document.getElementById('finishGameButton');
        toggle.click();
        expect(hidden('finishGameList')).toBe(false);
        expect(toggle.getAttribute('aria-expanded')).toBe('true');

        toggle.click();
        expect(hidden('finishGameList')).toBe(true);
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
    });

    test('Escape and a click outside hide the menu', () => {
        document.getElementById('finishGameButton').click();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(hidden('finishGameList')).toBe(true);

        document.getElementById('finishGameButton').click();
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(hidden('finishGameList')).toBe(true);
    });

    test('choosing Complete or Discard closes the menu', () => {
        const toggle = document.getElementById('finishGameButton');
        toggle.click();
        document.getElementById('completeGameButton').click();
        expect(hidden('finishGameList')).toBe(true);

        toggle.click();
        document.getElementById('discardGameButton').click();
        expect(hidden('finishGameList')).toBe(true);
    });
});

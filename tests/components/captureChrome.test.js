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
        <button id="newGameButton" type="button">Start</button>
        <a id="captureLogButton" class="btn btn-secondary hidden" href="#log">Log</a>
        <button id="pauseResumeButton" type="button" class="hidden">Pause</button>
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

    test('before a game, the bar shows the board and Start', () => {
        syncCaptureChrome({ hasGame: false, isRunning: false, lastEventText: '' });

        expect(hidden('captureBoard')).toBe(false);
        expect(hidden('captureContext')).toBe(false);
        expect(hidden('newGameButton')).toBe(false);
        expect(hidden('pauseResumeButton')).toBe(true);
        expect(hidden('captureLogButton')).toBe(true);
        expect(hidden('finishGameMenu')).toBe(true);
        expect(hidden('lastEventBar')).toBe(true);
        expect(document.getElementById('boardSelect').disabled).toBe(false);
    });

    test('during a game, the board is hidden and the bar shows Pause, Finish, and the last code', () => {
        syncCaptureChrome({ hasGame: true, isRunning: true, lastEventText: 'FIRE GOAL · 00:57' });

        expect(hidden('captureBoard')).toBe(true);
        expect(hidden('newGameButton')).toBe(true);
        expect(hidden('pauseResumeButton')).toBe(false);
        expect(document.getElementById('pauseResumeButton').textContent).toBe('Pause');
        expect(hidden('captureLogButton')).toBe(false);
        expect(hidden('finishGameMenu')).toBe(false);
        expect(hidden('lastEventBar')).toBe(false);
        expect(document.getElementById('lastEventLabel').textContent).toBe('FIRE GOAL · 00:57');
        expect(document.getElementById('boardSelect').disabled).toBe(true);
    });

    test('a game with no codes yet keeps the last-event slot out of the bar', () => {
        syncCaptureChrome({ hasGame: true, isRunning: false, lastEventText: '' });

        expect(hidden('captureContext')).toBe(false);
        expect(hidden('lastEventBar')).toBe(true);
        expect(hidden('captureLogButton')).toBe(false);
        expect(document.getElementById('pauseResumeButton').textContent).toBe('Resume');
    });

    test('ending the game closes Finish and brings the board back', () => {
        bindFinishMenu(document);
        syncCaptureChrome({ hasGame: true, isRunning: true, lastEventText: 'FIRE BS2 · 00:10' });
        document.getElementById('finishGameButton').click();
        expect(hidden('finishGameList')).toBe(false);

        syncCaptureChrome({ hasGame: false, isRunning: false, lastEventText: '' });

        expect(hidden('finishGameList')).toBe(true);
        expect(document.getElementById('finishGameButton').getAttribute('aria-expanded')).toBe('false');
        expect(hidden('captureLogButton')).toBe(true);
        expect(hidden('captureBoard')).toBe(false);
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

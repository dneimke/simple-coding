/**
 * @jest-environment jsdom
 */
import { showPreview, showAppendPreview, appendEventsToGame } from '../../src/utils/importUtils.js';
import { gameStorageManager } from '../../src/services/gameStorageManager.js';
import { storageService } from '../../src/services/storageService.js';
import { notificationService } from '../../src/services/notificationService.js';

jest.mock('../../src/services/gameStorageManager.js', () => ({
    gameStorageManager: {
        saveGame: jest.fn(),
        ensureGameIds: jest.fn(),
        STORAGE_KEY: 'fieldHockeyGames_v1'
    }
}));

jest.mock('../../src/services/storageService.js', () => ({
    storageService: {
        setItem: jest.fn(() => true)
    }
}));

jest.mock('../../src/services/notificationService.js', () => ({
    notificationService: {
        notify: jest.fn(),
        prompt: jest.fn()
    }
}));

jest.mock('../../src/utils/storageWarningUtils.js', () => ({
    checkStorageQuota: jest.fn()
}));

describe('importUtils', () => {
    let previewContainer;
    let modal;
    let previewTitle;
    let confirmBtn;
    let cancelBtn;

    beforeEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = `
            <div id="previewModal" class="hidden">
                <h2 id="previewTitle">Preview Imported Events</h2>
                <div id="previewContainer"></div>
                <button id="confirmImportButton">Confirm</button>
                <button id="cancelImportButton">Cancel</button>
            </div>
        `;
        previewContainer = document.getElementById('previewContainer');
        modal = document.getElementById('previewModal');
        previewTitle = document.getElementById('previewTitle');
        confirmBtn = document.getElementById('confirmImportButton');
        cancelBtn = document.getElementById('cancelImportButton');
    });

    describe('showPreview', () => {
        test('renders preview items and team attribute header', () => {
            const events = [
                { event: 'CE', timeMs: 12000 },
                { event: 'SHOT', timeMs: 25000 }
            ];
            events.teamsAttribute = 'FIRE vs TIGERS';

            showPreview(previewContainer, events, 'key');

            expect(previewContainer.innerHTML).toContain('Teams: FIRE vs TIGERS');
            expect(previewContainer.innerHTML).toContain('CE');
            expect(previewContainer.innerHTML).toContain('00:12');
            expect(previewContainer.innerHTML).toContain('SHOT');
            expect(previewContainer.innerHTML).toContain('00:25');
        });

        test('confirm button saves game and invokes callback with count 1', () => {
            const events = [{ event: 'CE', timeMs: 10000 }];
            const callback = jest.fn();
            gameStorageManager.saveGame.mockReturnValue(true);
            notificationService.prompt.mockReturnValue('Custom Teams');

            showPreview(previewContainer, events, 'key', callback);
            confirmBtn.click();

            expect(gameStorageManager.saveGame).toHaveBeenCalledWith(expect.objectContaining({
                teams: 'Custom Teams',
                events,
                elapsedTime: 10000
            }));
            expect(callback).toHaveBeenCalledWith({ importedFileCount: 1 });
            expect(modal.classList.contains('hidden')).toBe(true);
        });

        test('cancel button closes modal and invokes callback with count 0', () => {
            const events = [{ event: 'CE', timeMs: 10000 }];
            const callback = jest.fn();

            showPreview(previewContainer, events, 'key', callback);
            cancelBtn.click();

            expect(modal.classList.contains('hidden')).toBe(true);
            expect(callback).toHaveBeenCalledWith({ importedFileCount: 0 });
        });
    });

    describe('appendEventsToGame', () => {
        test('successfully appends events to an existing game by id', () => {
            const games = [
                {
                    id: 'game-1',
                    teams: 'Team A vs Team B',
                    elapsedTime: 20000,
                    events: [{ event: 'CE', timeMs: 10000 }]
                }
            ];
            gameStorageManager.ensureGameIds.mockReturnValue(games);

            const newEvents = [{ event: 'SHOT', timeMs: 30000 }];
            const result = appendEventsToGame('game-1', newEvents);

            expect(result.success).toBe(true);
            expect(result.addedCount).toBe(1);
            expect(result.duplicateCount).toBe(0);
            expect(result.game.events).toHaveLength(2);
            expect(result.game.elapsedTime).toBe(30000);
            expect(storageService.setItem).toHaveBeenCalledWith(
                gameStorageManager.STORAGE_KEY,
                expect.arrayContaining([expect.objectContaining({ id: 'game-1' })])
            );
        });

        test('deduplicates matching events and returns accurate counts', () => {
            const games = [
                {
                    id: 'game-1',
                    elapsedTime: 20000,
                    events: [{ event: 'SHOT', timeMs: 15000 }]
                }
            ];
            gameStorageManager.ensureGameIds.mockReturnValue(games);

            const newEvents = [
                { event: 'SHOT', timeMs: 15200 },
                { event: 'GOAL', timeMs: 16000 }
            ];

            const result = appendEventsToGame('game-1', newEvents);
            expect(result.success).toBe(true);
            expect(result.addedCount).toBe(1);
            expect(result.duplicateCount).toBe(1);
            expect(result.game.events).toHaveLength(2);
        });

        test('returns failure when game is not found', () => {
            gameStorageManager.ensureGameIds.mockReturnValue([]);
            const result = appendEventsToGame('non-existent', [{ event: 'SHOT', timeMs: 1000 }]);
            expect(result.success).toBe(false);
            expect(result.message).toBe('Game not found');
        });
    });

    describe('showAppendPreview', () => {
        const targetGame = {
            id: 'game-123',
            teams: 'FIRE vs TIGERS',
            elapsedTime: 30000,
            events: [
                { event: 'CE', timeMs: 10000 },
                { event: 'SHOT', timeMs: 20000 }
            ]
        };

        test('renders target match header, added badge and skipped duplicate badge', () => {
            const incomingEvents = [
                { event: 'SHOT', timeMs: 20100 }, // within 500ms duplicate
                { event: 'GOAL', timeMs: 25000 }  // new event
            ];

            showAppendPreview(previewContainer, targetGame, incomingEvents);

            expect(previewTitle.textContent).toBe('Append to: FIRE vs TIGERS');
            expect(confirmBtn.textContent).toBe('Append to Match');
            expect(confirmBtn.className).toContain('btn-primary');
            expect(previewContainer.innerHTML).toContain('FIRE vs TIGERS');
            expect(previewContainer.innerHTML).toContain('+1 new event');
            expect(previewContainer.innerHTML).toContain('1 duplicate skipped');
            expect(previewContainer.innerHTML).toContain('Total will be 3 events');
        });

        test('confirm button appends events and notifies on success', () => {
            gameStorageManager.ensureGameIds.mockReturnValue([targetGame]);
            const incomingEvents = [{ event: 'GOAL', timeMs: 25000 }];
            const callback = jest.fn();

            showAppendPreview(previewContainer, targetGame, incomingEvents, callback);
            confirmBtn.click();

            expect(callback).toHaveBeenCalledWith({ appended: true, addedCount: 1, duplicateCount: 0 });
            expect(modal.classList.contains('hidden')).toBe(true);
            expect(notificationService.notify).toHaveBeenCalledWith(
                expect.stringContaining('Added 1 event to FIRE vs TIGERS'),
                'success'
            );
        });

        test('cancel button resets modal chrome and notifies warning', () => {
            const incomingEvents = [{ event: 'GOAL', timeMs: 25000 }];
            const callback = jest.fn();

            showAppendPreview(previewContainer, targetGame, incomingEvents, callback);
            cancelBtn.click();

            expect(modal.classList.contains('hidden')).toBe(true);
            expect(previewTitle.textContent).toBe('Preview Imported Events');
            expect(confirmBtn.textContent).toBe('Confirm');
            expect(callback).toHaveBeenCalledWith({ appended: false, addedCount: 0, duplicateCount: 0 });
            expect(notificationService.notify).toHaveBeenCalledWith('Append canceled.', 'warning');
        });
    });
});

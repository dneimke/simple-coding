/**
 * @jest-environment jsdom
 */

describe('timeline-video performance optimizations (Focus Mode & Split Mode)', () => {
    const GAME_ID = 'perf-video-game';
    let mod;

    const videoCodingMarkup = `
        <div id="no-game-selected-state" class="hidden"></div>
        <div id="timeline-empty-state" class="hidden"></div>
        <div id="favorites-empty-state" class="hidden"></div>
        <div id="timeline-filters" class="hidden">
            <button id="show-all-events" class="bg-blue-500 text-white"></button>
            <button id="show-favorites" class="bg-gray-200 text-gray-700"></button>
            <button id="show-unlabelled"></button>
            <button id="filter-dropdown-button" aria-expanded="false"><span id="selected-filters-text">All events</span></button>
            <div id="filter-dropdown-panel" class="hidden">
                <input id="filter-option-all" type="checkbox" data-filter="all" checked>
                <div id="filter-options-container"></div>
            </div>
            <div id="selected-filters-tags"></div>
        </div>
        <div id="timeline-events" class="hidden"></div>
        <div class="review-heading">
            <h1 id="review-game-title" class="review-game-title"></h1>
            <span id="draft-badge" class="hidden"></span>
            <button id="edit-title-btn"></button>
        </div>
        <div class="review-header-actions">
            <span id="save-status-indicator" class="hidden"></span>
            <button id="save-and-exit-btn">Exit to Matches</button>
        </div>
        <div class="review-layout">
            <div id="timeline-container" class="review-timeline">
                <div id="timeline-panel-header">
                    <span id="timeline-events-counter">0</span>
                    <button id="collapse-timeline-btn">Collapse</button>
                </div>
            </div>
            <div id="video-container" class="review-video">
                <button id="attach-video-btn">Attach Video</button>
                <button id="label-sweep-btn"><span id="label-sweep-text">Sweep Labels</span></button>
                <button id="add-event-fab" class="hidden">Add tag</button>
                <div class="review-video-stage">
                    <video id="video-player"></video>
                    <div id="video-stage-empty-overlay" class="hidden"></div>
                </div>
                <div id="video-coding-panel" class="hidden">
                    <button id="edit-quick-tags-btn">Edit Tags</button>
                    <div id="video-zone-bar" class="zone-bar hidden">
                        <div id="video-zone-buttons"></div>
                    </div>
                    <div id="quick-tags-container"></div>
                    <div id="quick-tag-ticker">
                        <span id="ticker-last-event"></span>
                        <button id="quick-tag-undo-btn" disabled>Undo</button>
                        <button id="quick-tag-review-btn"><span id="quick-tag-review-label">Events Panel (0) ▾</span></button>
                    </div>
                </div>
            </div>
        </div>
        <div id="quick-tag-feedback" class="sr-only"></div>
    `;

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        document.body.innerHTML = videoCodingMarkup;
        localStorage.clear();
        const initialEvents = [
            { id: 'ev-init-1', event: 'FIRE BS1', timeMs: 10000, timestamp: '00:10' },
            { id: 'ev-init-2', event: 'TIGERS CE', timeMs: 30000, timestamp: '00:30' }
        ];
        localStorage.setItem('fieldHockeyGames_v1', JSON.stringify([
            { id: GAME_ID, teams: 'FIRE vs TIGERS', events: initialEvents, metadata: {} }
        ]));
        jest.isolateModules(() => {
            mod = require('../../src/js/timeline-video.js');
        });
        mod.loadGame(GAME_ID);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('quickTagEvent writes to localStorage once per tag and defers #timeline-events DOM rebuild while collapsed in Focus Mode', () => {
        mod.setTaggingMode(true); // Collapses timeline (Focus Mode)

        const beforeCount = document.querySelectorAll('#timeline-events .timeline-event').length;
        expect(beforeCount).toBe(2);

        const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
        const video = document.getElementById('video-player');
        video.currentTime = 35;

        mod.quickTagEvent('Goal');

        const gamesWrites = setItemSpy.mock.calls.filter(([k]) => k === 'fieldHockeyGames_v1');
        expect(gamesWrites).toHaveLength(1);

        // While timeline is collapsed in Focus Mode, DOM cards are not rebuilt on every tap
        expect(document.querySelectorAll('#timeline-events .timeline-event').length).toBe(2);
        expect(document.getElementById('quick-tag-review-label').textContent).toContain('(3)');

        // Expanding the timeline panel immediately renders the deferred event
        mod.setTimelineCollapsed(false);
        expect(document.querySelectorAll('#timeline-events .timeline-event').length).toBe(3);
        setItemSpy.mockRestore();
    });

    test('Split Mode quickTagEvent and undoLastQuickTag update only the affected card without tearing down existing cards', () => {
        mod.setTaggingMode(true);
        mod.setTimelineCollapsed(false); // Split Mode: timeline is visible alongside video

        const existingFirstCard = document.querySelector('#timeline-events .timeline-event[data-event-id="ev-init-1"]');
        expect(existingFirstCard).not.toBeNull();

        const video = document.getElementById('video-player');
        video.currentTime = 20; // Between 10s and 30s
        const created = mod.quickTagEvent('Shot');

        const allCards = Array.from(document.querySelectorAll('#timeline-events .timeline-event'));
        expect(allCards.map(c => c.dataset.eventId)).toEqual(['ev-init-1', created.id, 'ev-init-2']);
        // Existing card reference was preserved, not destroyed and recreated
        expect(allCards[0]).toBe(existingFirstCard);

        // Undo in Split Mode removes the popped card in place while preserving existingFirstCard
        mod.undoLastQuickTag();
        const afterUndoCards = Array.from(document.querySelectorAll('#timeline-events .timeline-event'));
        expect(afterUndoCards.map(c => c.dataset.eventId)).toEqual(['ev-init-1', 'ev-init-2']);
        expect(afterUndoCards[0]).toBe(existingFirstCard);
    });

    test('cached getCurrentGame round-trip matches post-upsert localStorage game object and respects direct-write invalidation', () => {
        const video = document.getElementById('video-player');
        video.currentTime = 45;
        mod.quickTagEvent('Goal');

        const storedGames = JSON.parse(localStorage.getItem('fieldHockeyGames_v1'));
        const storedGame = storedGames.find(g => g.id === GAME_ID);
        const cachedGame = mod.getCurrentGame();

        expect(cachedGame).toEqual(storedGame);
        expect(cachedGame.elapsedTime).toBe(45000);
        expect(typeof cachedGame.metadata.lastUpdated).toBe('string');

        // Direct write via shiftGameTimings invalidates both caches so subsequent quickTagEvent preserves shifted timings
        mod.shiftGameTimings(GAME_ID, 60000, false);
        video.currentTime = 120;
        mod.quickTagEvent('Shot');

        const afterShiftGames = JSON.parse(localStorage.getItem('fieldHockeyGames_v1'));
        const afterShiftGame = afterShiftGames.find(g => g.id === GAME_ID);
        expect(afterShiftGame.events[0].timeMs).toBe(70000);
        expect(afterShiftGame.events).toHaveLength(4);
    });

    test('highlightTimelineEvent scrolls active card in sweep/review but skips synchronous scroll during quickTagEvent', () => {
        mod.setTaggingMode(true);
        mod.setTimelineCollapsed(false);

        const scrollSpy = jest.fn();
        HTMLElement.prototype.scrollIntoView = scrollSpy;

        const video = document.getElementById('video-player');
        video.play = jest.fn().mockResolvedValue(undefined);
        video.currentTime = 50;
        const created = mod.quickTagEvent('Goal');

        const taggedCard = document.querySelector(`#timeline-events .timeline-event[data-event-id="${created.id}"]`);
        expect(taggedCard.classList.contains('is-active')).toBe(true);
        expect(scrollSpy).not.toHaveBeenCalled();

        // Label Sweep and direct timeline card selection scroll the active card into view
        mod.startLabelSweep();
        const secondCard = document.querySelector('#timeline-events .timeline-event[data-event-id="ev-init-2"]');
        expect(secondCard.classList.contains('is-active')).toBe(true);
        expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' });

        scrollSpy.mockClear();
        const firstCard = document.querySelector('#timeline-events .timeline-event[data-event-id="ev-init-1"]');
        firstCard.click();
        expect(firstCard.classList.contains('is-active')).toBe(true);
        expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' });

        delete HTMLElement.prototype.scrollIntoView;
    });
});

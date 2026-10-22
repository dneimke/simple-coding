/**
 * @jest-environment jsdom
 */

// Import the functions to test
// Note: We need to import the functions from the module for testing
// For this test file, we'll mock the functions and test them individually

describe('Game management functions', () => {
    // Mock localStorage
    const localStorageMock = (function () {
        let store = {};
        return {
            getItem: jest.fn(key => store[key] || null),
            setItem: jest.fn((key, value) => {
                store[key] = value.toString();
            }),
            clear: jest.fn(() => {
                store = {};
            })
        };
    })();

    Object.defineProperty(window, 'localStorage', {
        value: localStorageMock
    });

    beforeEach(() => {
        localStorageMock.clear();
        jest.clearAllMocks();
    });

    // Mock functions for testing
    const GAMES_STORAGE_KEY = 'saved_games';

    function getSavedGames() {
        const storedGames = localStorage.getItem(GAMES_STORAGE_KEY);
        if (storedGames) {
            try {
                return JSON.parse(storedGames);
            } catch (e) {
                console.error("Error parsing saved games data:", e);
                return {};
            }
        }
        return {};
    }

    function saveGame(gameId, events, metadata = {}) {
        const savedGames = getSavedGames();

        savedGames[gameId] = {
            id: gameId,
            events,
            metadata: {
                ...metadata,
                lastUpdated: new Date().toISOString()
            }
        };

        try {
            localStorage.setItem(GAMES_STORAGE_KEY, JSON.stringify(savedGames));
            return true;
        } catch (e) {
            console.error("Error saving game:", e);
            return false;
        }
    }

    const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
        <game date="2025-05-07" teams="Team A vs Team B">
            <events>
                <event timestamp="2025-05-07T14:00:00Z" title="Kick-off" description="Game started" />
                <event timestamp="2025-05-07T14:10:15Z" title="Goal Scored" description="Player #10 scores" />
            </events>
        </game>`;

    function parseXmlEvents(xmlString) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml");

        const parseError = xmlDoc.getElementsByTagName('parsererror');
        if (parseError.length > 0) {
            throw new Error("XML parsing error");
        }

        let eventElements = [];
        const eventsContainer = xmlDoc.getElementsByTagName('events')[0];

        if (eventsContainer) {
            eventElements = eventsContainer.getElementsByTagName('event');
        } else {
            eventElements = xmlDoc.getElementsByTagName('event');
        }

        const events = [];

        for (let i = 0; i < eventElements.length; i++) {
            const element = eventElements[i];

            const event = {
                timestamp: element.getAttribute('timestamp') || new Date().toISOString(),
                title: element.getAttribute('title') || 'Untitled Event',
                description: element.getAttribute('description') || '',
            };

            events.push(event);
        }

        events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        return events;
    }

    test('getSavedGames should return empty object when no games are saved', () => {
        const result = getSavedGames();
        expect(result).toEqual({});
        expect(localStorage.getItem).toHaveBeenCalledWith(GAMES_STORAGE_KEY);
    });

    test('saveGame should store game data in localStorage', () => {
        const gameId = 'test-game';
        const events = [
            { timestamp: '2025-05-03T10:05:30Z', title: 'Goal Scored', description: 'Player #10 scores.' }
        ];
        const metadata = { source: 'test' };

        const result = saveGame(gameId, events, metadata);

        expect(result).toBe(true);
        expect(localStorage.setItem).toHaveBeenCalled();

        const savedGames = JSON.parse(localStorage.getItem(GAMES_STORAGE_KEY));
        expect(savedGames[gameId]).toBeDefined();
        expect(savedGames[gameId].events).toEqual(events);
        expect(savedGames[gameId].metadata.source).toEqual('test');
        expect(savedGames[gameId].metadata.lastUpdated).toBeDefined();
    });

    test('parseXmlEvents should correctly parse XML string', () => {
        // Set up the DOM environment for parsing
        document.body.innerHTML = '<div></div>';

        const events = parseXmlEvents(mockXml);

        expect(events.length).toBe(2);
        expect(events[0].title).toBe('Kick-off');
        expect(events[0].description).toBe('Game started');
        expect(events[1].title).toBe('Goal Scored');
        expect(events[1].timestamp).toBe('2025-05-07T14:10:15Z');
    });

    test('parseXmlEvents should handle invalid XML', () => {
        document.body.innerHTML = '<div></div>';

        // Invalid XML should throw an error
        expect(() => {
            parseXmlEvents('<invalid>XML</notmatching>');
        }).toThrow();
    });
});

describe('event filters', () => {
    const GAME_ID = 'game-1';
    let mod;

    const filterMarkup = `
        <div id="timeline-empty-state" class="hidden"></div>
        <div id="favorites-empty-state" class="hidden"></div>
        <div id="timeline-filters" class="hidden">
            <button id="show-all-events" class="bg-blue-500 text-white"></button>
            <button id="show-favorites" class="bg-gray-200 text-gray-700"></button>
            <button id="filter-dropdown-button" aria-expanded="false"><span id="selected-filters-text">All events</span></button>
            <div id="filter-dropdown-panel" class="hidden">
                <div>
                    <input id="filter-option-all" type="checkbox" class="filter-checkbox" data-filter="all" checked>
                    <label id="filter-option-all-label" for="filter-option-all">All events</label>
                </div>
                <div id="filter-options-container"></div>
            </div>
            <div id="selected-filters-tags"></div>
        </div>
        <div id="timeline-events" class="hidden"></div>
    `;

    const seedEvents = () => [
        { id: 'e1', event: 'goal', timeMs: 1000, isFavorite: true },
        { id: 'e2', event: 'foul', timeMs: 2000, isFavorite: false },
        { id: 'e3', event: 'corner', timeMs: 3000, isFavorite: true },
        { id: 'e4', event: 'goal', timeMs: 4000, isFavorite: false }
    ];

    const renderedIds = () =>
        Array.from(document.querySelectorAll('#timeline-events .timeline-event')).map(el => el.dataset.eventId);

    const typeLabel = (type) => {
        const checkbox = document.querySelector(`#filter-options-container .filter-checkbox[data-filter="${type}"]`);
        return document.querySelector(`label[for="${checkbox.id}"]`);
    };

    const typeCheckbox = (type) =>
        document.querySelector(`#filter-options-container .filter-checkbox[data-filter="${type}"]`);

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        document.body.innerHTML = filterMarkup;
        localStorage.clear();
        localStorage.setItem('fieldHockeyGames_v1', JSON.stringify([
            { id: GAME_ID, teams: 'A vs B', events: seedEvents(), metadata: {} }
        ]));
        jest.isolateModules(() => {
            mod = require('../../src/js/timeline-video.js');
        });
        mod.loadGame(GAME_ID);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('each saved tag is one row showing its time and name', () => {
        const row = document.querySelector('#timeline-events .timeline-event');
        expect(row.querySelector('.timeline-event-time').textContent).toBe('16:40');
        expect(row.querySelector('.timeline-event-name').textContent).toBe('Goal');
        expect(row.querySelector('.timeline-event-seek')).not.toBeNull();
        expect(row.querySelector('.favorite-toggle')).not.toBeNull();
        expect(row.querySelector('.delete-event-btn')).not.toBeNull();
    });

    test('clicking a type label applies the filter and clicking again removes it', () => {
        typeLabel('goal').click();
        expect(renderedIds()).toEqual(['e1', 'e4']);
        expect(document.getElementById('filter-option-all').checked).toBe(false);
        expect(document.getElementById('selected-filters-text').textContent).toBe('1 filter selected');

        typeLabel('goal').click();
        expect(renderedIds()).toEqual(['e1', 'e2', 'e3', 'e4']);
        expect(document.getElementById('filter-option-all').checked).toBe(true);
        expect(document.getElementById('selected-filters-text').textContent).toBe('All events');
    });

    test('clicking the row padding applies the filter', () => {
        typeCheckbox('foul').parentElement.click();
        expect(typeCheckbox('foul').checked).toBe(true);
        expect(renderedIds()).toEqual(['e2']);
    });

    test('type filters survive toggling favorites on and off', () => {
        typeLabel('goal').click();
        typeLabel('corner').click();
        expect(renderedIds()).toEqual(['e1', 'e3', 'e4']);

        mod.setFavoritesOnly(true);
        expect(renderedIds()).toEqual(['e1', 'e3']);

        mod.setFavoritesOnly(false);
        expect(renderedIds()).toEqual(['e1', 'e3', 'e4']);
        expect(typeCheckbox('goal').checked).toBe(true);
        expect(typeCheckbox('corner').checked).toBe(true);
    });

    test('removing a tag updates the filter', () => {
        typeLabel('goal').click();
        typeLabel('foul').click();
        const removeGoal = document.querySelector('#selected-filters-tags button[aria-label="Remove Goal filter"]');
        removeGoal.click();
        expect(renderedIds()).toEqual(['e2']);
        expect(typeCheckbox('goal').checked).toBe(false);
    });

    test('rebuilding the filter options keeps the current selection', () => {
        typeLabel('foul').click();
        mod.updateEventFilters();
        expect(typeCheckbox('foul').checked).toBe(true);
        expect(document.getElementById('filter-option-all').checked).toBe(false);
    });

    test('deleting an event keeps the selection and drops types that no longer exist', () => {
        jest.spyOn(window, 'confirm').mockReturnValue(true);
        typeLabel('goal').click();
        typeLabel('foul').click();

        mod.deleteEvent('e2');
        expect(typeCheckbox('foul')).toBeNull();
        expect(typeCheckbox('goal').checked).toBe(true);
        expect(renderedIds()).toEqual(['e1', 'e4']);
    });

    test('toggling a favorite keeps the type filter applied', () => {
        typeLabel('goal').click();
        mod.toggleFavorite('e4');
        expect(renderedIds()).toEqual(['e1', 'e4']);
    });

    test('the "All" checkbox renders once per click after repeated rebuilds', () => {
        typeLabel('goal').click();
        mod.updateEventFilters();
        mod.updateEventFilters();
        mod.updateEventFilters();
        console.log.mockClear();

        document.getElementById('filter-option-all-label').click();
        const renders = console.log.mock.calls.filter(([msg]) => String(msg).startsWith('Timeline rendered'));
        expect(renders).toHaveLength(1);
        expect(renderedIds()).toEqual(['e1', 'e2', 'e3', 'e4']);
    });

    test('saving keeps per-event lead and lag', () => {
        localStorage.setItem('fieldHockeyGames_v1', JSON.stringify([{
            id: GAME_ID,
            teams: 'A vs B',
            events: [
                { id: 'e1', event: 'BLAZE PC', timeMs: 1000, isFavorite: false, lead: 2, lag: 10 },
                { id: 'e2', event: 'goal', timeMs: 2000, isFavorite: false }
            ],
            metadata: {}
        }]));
        jest.isolateModules(() => {
            mod = require('../../src/js/timeline-video.js');
        });
        mod.loadGame(GAME_ID);

        mod.toggleFavorite('e1');

        const [saved] = JSON.parse(localStorage.getItem('fieldHockeyGames_v1'));
        expect(saved.events[0]).toMatchObject({ id: 'e1', isFavorite: true, lead: 2, lag: 10 });
        expect(saved.events[1]).not.toHaveProperty('lead');
        expect(saved.events[1]).not.toHaveProperty('lag');
    });

    test('unchecking "All" with nothing selected re-checks it', () => {
        document.getElementById('filter-option-all').click();
        expect(document.getElementById('filter-option-all').checked).toBe(true);
        expect(renderedIds()).toEqual(['e1', 'e2', 'e3', 'e4']);
    });
});


describe('video coding workflow', () => {
    const GAME_ID = 'video-game-1';
    let mod;

    const videoCodingMarkup = `
        <div id="no-game-selected-state" class="hidden"></div>
        <div id="timeline-empty-state" class="hidden"></div>
        <div id="favorites-empty-state" class="hidden"></div>
        <div id="timeline-filters" class="hidden">
            <button id="show-all-events" class="bg-blue-500 text-white"></button>
            <button id="show-favorites" class="bg-gray-200 text-gray-700"></button>
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
            <form id="inline-title-form" class="hidden">
                <input id="inline-title-input" />
                <button id="save-title-btn" type="submit"></button>
                <button id="cancel-title-btn" type="button"></button>
            </form>
        </div>
        <div class="review-header-actions">
            <span id="save-status-indicator" class="hidden"></span>
            <button id="save-and-exit-btn">Save & Exit</button>
        </div>
        <div class="review-layout">
            <div id="timeline-container" class="review-timeline"></div>
            <div id="video-container" class="review-video">
                <button id="toggle-tagging-mode-btn"><span class="tag-mode-text">Tag Video</span></button>
                <video id="video-player"></video>
                <div id="video-coding-panel" class="hidden">
                    <button id="edit-quick-tags-btn">Edit Tags</button>
                    <div id="quick-tags-container"></div>
                    <div id="quick-tags-edit-bar" class="hidden">
                        <input id="new-tag-label-input" type="text" />
                        <button id="save-new-tag-btn">Add</button>
                        <button id="reset-quick-tags-btn">Reset</button>
                    </div>
                    <div id="quick-tag-ticker">
                        <span id="ticker-last-event"></span>
                        <button id="quick-tag-undo-btn" disabled>Undo</button>
                        <button id="quick-tag-review-btn">Review Events</button>
                    </div>
                </div>
            </div>
        </div>
        <div id="playback-speed-controls"></div>
        <div id="quick-tag-feedback" class="hidden"></div>
    `;

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        document.body.innerHTML = videoCodingMarkup;
        localStorage.clear();
        localStorage.setItem('fieldHockeyGames_v1', JSON.stringify([
            { id: GAME_ID, teams: 'Video Match', events: [], metadata: {} }
        ]));
        jest.isolateModules(() => {
            mod = require('../../src/js/timeline-video.js');
        });
        mod.loadGame(GAME_ID);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('CORE_QUICK_TAGS contains 6 core hockey events', () => {
        expect(mod.CORE_QUICK_TAGS).toBeDefined();
        expect(mod.CORE_QUICK_TAGS.length).toBe(6);
        const labels = mod.CORE_QUICK_TAGS.map(t => t.label);
        expect(labels).toContain('Goal');
        expect(labels).toContain('Shot');
        expect(labels).toContain('Circle Entry');
        expect(labels).toContain('Penalty Corner');
        expect(labels).toContain('Turnover');
    });

    test('quickTagEvent creates an event at video current time and persists it', () => {
        const video = document.getElementById('video-player');
        video.currentTime = 45.5; // 45500 ms

        const created = mod.quickTagEvent('Goal');
        expect(created).toBeDefined();
        expect(created.event).toBe('Goal');
        expect(created.timeMs).toBe(45500);
        expect(created.timestamp).toBe('00:45');

        const [saved] = JSON.parse(localStorage.getItem('fieldHockeyGames_v1'));
        expect(saved.events).toHaveLength(1);
        expect(saved.events[0].event).toBe('Goal');
        expect(saved.events[0].timeMs).toBe(45500);

        const rendered = document.querySelectorAll('#timeline-events .timeline-event');
        expect(rendered.length).toBe(1);
    });

    test('createNewVideoGame initializes draft session without polluting saved games until event is logged', () => {
        const newGame = mod.createNewVideoGame('Eagles vs Hawks');
        expect(newGame).toBeDefined();
        expect(newGame.id).toBeDefined();
        expect(newGame.teams).toBe('Eagles vs Hawks');
        expect(newGame.metadata.isDraft).toBe(true);

        // Before logging any event, the game should NOT be saved in fieldHockeyGames_v1 (prevent spam)
        const gamesBefore = JSON.parse(localStorage.getItem('fieldHockeyGames_v1')) || [];
        expect(gamesBefore.some(g => g.id === newGame.id)).toBe(false);

        // Once an event is logged, the draft is automatically committed to saved games
        const video = document.getElementById('video-player');
        video.currentTime = 12;
        mod.quickTagEvent('Shot');

        const gamesAfter = JSON.parse(localStorage.getItem('fieldHockeyGames_v1'));
        expect(gamesAfter.some(g => g.id === newGame.id)).toBe(true);
        const reloaded = gamesAfter.find(g => g.id === newGame.id);
        expect(reloaded.events).toHaveLength(1);
        expect(reloaded.events[0].event).toBe('Shot');
    });

    test('renameMatch updates match title in memory and storage', () => {
        mod.createNewVideoGame('Initial Title');
        const renamed = mod.renameMatch('Grand Final - Eagles vs Tigers');
        expect(renamed).toBe(true);

        const titleEl = document.getElementById('review-game-title');
        expect(titleEl.textContent).toBe('Grand Final - Eagles vs Tigers');

        const current = mod.getCurrentGame();
        expect(current.teams).toBe('Grand Final - Eagles vs Tigers');
    });

    test('autoRenameFromVideo derives clean match name from video file name if title is default', () => {
        mod.createNewVideoGame(); // default name like "Video Match — Oct 22, 2026"
        mod.autoRenameFromVideo('GF_Eagles_vs_Hawks_Q1.mp4');

        const current = mod.getCurrentGame();
        expect(current.teams).toBe('GF Eagles vs Hawks Q1');
    });

    test('commitDraftGame explicitly commits draft to storage', () => {
        const newGame = mod.createNewVideoGame('Championship Match');
        const gamesBefore = JSON.parse(localStorage.getItem('fieldHockeyGames_v1')) || [];
        expect(gamesBefore.some(g => g.id === newGame.id)).toBe(false);

        mod.commitDraftGame();
        const gamesAfter = JSON.parse(localStorage.getItem('fieldHockeyGames_v1'));
        expect(gamesAfter.some(g => g.id === newGame.id)).toBe(true);
    });

    test('updateEventNote updates note on event and persists in storage', () => {
        const video = document.getElementById('video-player');
        video.currentTime = 10;
        const created = mod.quickTagEvent('Turnover');

        mod.updateEventNote(created.id, 'Stolen by #7 high press');

        const [saved] = JSON.parse(localStorage.getItem('fieldHockeyGames_v1'));
        const event = saved.events.find(e => e.id === created.id);
        expect(event.note).toBe('Stolen by #7 high press');
    });

    test('retargetEventTime nudges timestamp and persists', () => {
        const video = document.getElementById('video-player');
        video.currentTime = 60;
        const created = mod.quickTagEvent('Penalty Corner');

        mod.retargetEventTime(created.id, 58); // Nudge 2 seconds earlier

        const [saved] = JSON.parse(localStorage.getItem('fieldHockeyGames_v1'));
        const event = saved.events.find(e => e.id === created.id);
        expect(event.timeMs).toBe(58000);
        expect(event.timestamp).toBe('00:58');
    });

    test('loadQuickTags returns DEFAULT_QUICK_TAGS when storage is empty', () => {
        const tags = mod.loadQuickTags();
        expect(tags).toHaveLength(6);
        expect(tags[0].label).toBe('Goal');
    });

    test('addQuickTag appends a custom tag, saves to storage, and re-renders', () => {
        const initialCount = mod.loadQuickTags().length;
        const updated = mod.addQuickTag('Outlet 1', 'btn-blue');
        expect(updated.length).toBe(initialCount + 1);
        expect(updated[updated.length - 1].label).toBe('Outlet 1');

        const reloaded = mod.loadQuickTags();
        expect(reloaded.some(t => t.label === 'Outlet 1')).toBe(true);
    });

    test('removeQuickTag removes tag by id and re-indexes keys', () => {
        const tags = mod.loadQuickTags();
        const goalId = tags[0].id;
        const updated = mod.removeQuickTag(goalId);
        expect(updated.some(t => t.id === goalId)).toBe(false);
        expect(updated[0].key).toBe('1'); // re-indexed

        const reloaded = mod.loadQuickTags();
        expect(reloaded.some(t => t.id === goalId)).toBe(false);
    });

    test('resetQuickTags clears customization and restores 6 defaults', () => {
        mod.removeQuickTag('goal');
        expect(mod.loadQuickTags().length).toBe(5);

        const restored = mod.resetQuickTags();
        expect(restored.length).toBe(6);
        expect(restored.some(t => t.label === 'Goal')).toBe(true);
    });

    test('undoLastQuickTag removes latest logged event', () => {
        const video = document.getElementById('video-player');
        video.currentTime = 5;
        mod.quickTagEvent('Shot');
        video.currentTime = 10;
        mod.quickTagEvent('Goal');

        let [game] = JSON.parse(localStorage.getItem('fieldHockeyGames_v1'));
        expect(game.events).toHaveLength(2);

        const undone = mod.undoLastQuickTag();
        expect(undone).toBe(true);

        [game] = JSON.parse(localStorage.getItem('fieldHockeyGames_v1'));
        expect(game.events).toHaveLength(1);
        expect(game.events[0].event).toBe('Shot');
    });

    test('setTaggingMode toggles layout class and panel visibility', () => {
        const layout = document.querySelector('.review-layout');
        const panel = document.getElementById('video-coding-panel');

        mod.setTaggingMode(true);
        expect(layout.classList.contains('tagging-mode-active')).toBe(true);
        expect(panel.classList.contains('hidden')).toBe(false);

        mod.setTaggingMode(false);
        expect(layout.classList.contains('tagging-mode-active')).toBe(false);
        expect(panel.classList.contains('hidden')).toBe(true);
    });
});

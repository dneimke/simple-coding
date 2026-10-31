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
            <form id="inline-title-form" class="hidden">
                <input id="inline-title-input" />
                <button id="save-title-btn" type="submit"></button>
                <button id="cancel-title-btn" type="button"></button>
            </form>
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
                <div id="sweep-controls" class="hidden">
                    <button id="prev-sweep-event"></button>
                    <span id="sweep-counter">0/0</span>
                    <div id="sweep-chips"></div>
                    <button id="skip-sweep-event"></button>
                    <button id="exit-sweep-btn"></button>
                </div>
                <button id="add-event-fab" class="hidden">Add tag</button>
                <div class="review-video-stage">
                    <video id="video-player"></video>
                    <div id="video-stage-empty-overlay" class="hidden"></div>
                    <div id="video-error-overlay" class="hidden">
                        <span id="video-error-message"></span>
                        <button id="retry-video-url-btn"></button>
                        <button id="change-video-url-btn"></button>
                    </div>
                </div>
                <div id="video-coding-panel" class="hidden">
                    <button id="edit-quick-tags-btn">Edit Tags</button>
                    <div id="video-zone-bar" class="zone-bar hidden">
                        <div id="video-zone-buttons"></div>
                    </div>
                    <div id="quick-tags-container"></div>
                    <div id="quick-tags-edit-bar" class="hidden">
                        <input id="new-tag-label-input" type="text" />
                        <input id="tag-add-zone-checkbox" type="checkbox" />
                        <button id="save-new-tag-btn">Add</button>
                        <button id="reset-quick-tags-btn">Reset</button>
                    </div>
                    <div id="quick-tag-ticker">
                        <span id="ticker-last-event"></span>
                        <button id="quick-tag-undo-btn" disabled>Undo</button>
                        <button id="quick-tag-review-btn"><span id="quick-tag-review-label">Events Panel (0) ▾</span></button>
                    </div>
                </div>
            </div>
        </div>
        <div id="attach-video-modal" class="modal hidden">
            <button id="tab-attach-url" class="is-active">Web Video URL</button>
            <button id="tab-attach-file">Local File</button>
            <div id="panel-attach-url">
                <input id="video-url-input" />
                <div id="video-url-warning" class="hidden">
                    <span id="video-url-warning-text"></span>
                </div>
                <button id="cancel-attach-url-btn">Cancel</button>
                <button id="submit-attach-url-btn">Attach Video</button>
            </div>
            <div id="panel-attach-file" class="hidden">
                <input type="file" id="video-modal-file-input" />
                <button id="cancel-attach-file-btn">Cancel</button>
            </div>
            <div id="current-video-banner" class="hidden">
                <span id="current-video-source-text"></span>
                <button id="detach-video-btn">Remove</button>
            </div>
            <button id="close-attach-video-modal">Close</button>
        </div>
        <div id="playback-speed-controls"></div>
        <div id="quick-tag-feedback" class="sr-only"></div>
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

    test('moveQuickTag reorders tags left and right and updates shortcut keys', () => {
        mod.resetQuickTags();
        const initial = mod.loadQuickTags();
        expect(initial[0].id).toBe('goal');
        expect(initial[1].id).toBe('shot');

        // Move 'shot' left to index 0
        const movedLeft = mod.moveQuickTag('shot', 'left');
        expect(movedLeft[0].id).toBe('shot');
        expect(movedLeft[0].key).toBe('1');
        expect(movedLeft[1].id).toBe('goal');
        expect(movedLeft[1].key).toBe('2');

        // Verify boundary: cannot move index 0 left
        const cantMove = mod.moveQuickTag('shot', 'left');
        expect(cantMove[0].id).toBe('shot');

        // Move 'shot' right back to index 1
        const movedRight = mod.moveQuickTag('shot', 'right');
        expect(movedRight[0].id).toBe('goal');
        expect(movedRight[1].id).toBe('shot');
    });

    test('updateQuickTag modifies tag label, team binding, and color in-place', () => {
        mod.resetQuickTags();
        const updated = mod.updateQuickTag('goal', {
            label: 'Field Goal',
            team: 'team1',
            colorClass: 'btn-green'
        });
        const goalTag = updated.find(t => t.id === 'goal');
        expect(goalTag.label).toBe('Field Goal');
        expect(goalTag.team).toBe('team1');
        expect(updated[0].id).toBe('goal'); // Order preserved
        expect(updated[0].key).toBe('1');   // Key preserved
    });

    test('resolveTagDisplay formats team prefix and color dynamically', () => {
        const teams = [
            { code: 'THUNDER', color: 'green' },
            { code: 'PRIDE', color: 'red' }
        ];

        // Team 1 bound tag
        const tag1 = { id: 't1', label: 'BS1', team: 'team1', colorClass: 'btn-blue' };
        const resolved1 = mod.resolveTagDisplay(tag1, teams);
        expect(resolved1.displayLabel).toBe('THUNDER BS1');
        expect(resolved1.colorClass).toBe('team-color-green');
        expect(resolved1.isTeam1).toBe(true);

        // Team 2 bound tag
        const tag2 = { id: 't2', label: 'GOAL', team: 'team2', colorClass: 'btn-orange' };
        const resolved2 = mod.resolveTagDisplay(tag2, teams);
        expect(resolved2.displayLabel).toBe('PRIDE GOAL');
        expect(resolved2.colorClass).toBe('team-color-red');
        expect(resolved2.isTeam1).toBe(false);

        // Neutral / unbound tag
        const tagNeutral = { id: 't3', label: 'SPECIAL', team: 'none', colorClass: 'btn-blue' };
        const resolvedNeutral = mod.resolveTagDisplay(tagNeutral, teams);
        expect(resolvedNeutral.displayLabel).toBe('SPECIAL');
        expect(resolvedNeutral.colorClass).toBe('btn-blue');
    });

    test('zone-aware tags keep the flag and log the same zone number for both teams', () => {
        mod.setMatchTeams([
            { code: 'PRIDE', color: 'red' },
            { code: 'BLAZE', color: 'orange' }
        ]);
        mod.saveQuickTags([
            { id: 'pride-bs', label: 'BS', team: 'team1', colorClass: 'btn-red', zoned: true },
            { id: 'blaze-bs', label: 'BS', team: 'team2', colorClass: 'btn-orange', zoned: true },
            { id: 'pride-cd', label: 'CD', team: 'team1', colorClass: 'btn-red', zoned: false }
        ]);
        const stored = mod.loadQuickTags();
        expect(stored.find(tag => tag.id === 'pride-bs').zoned).toBe(true);
        expect(stored.find(tag => tag.id === 'pride-cd').zoned).toBe(false);

        mod.setTaggingMode(true);
        expect(document.getElementById('video-zone-bar').classList.contains('hidden')).toBe(false);
        expect(mod.selectVideoZone('2')).toBe(true);

        const labels = [...document.querySelectorAll('.tag-label')].map(el => el.textContent);
        expect(labels).toEqual(['BS2', 'BS2', 'CD']);

        const video = document.getElementById('video-player');
        video.currentTime = 12;
        const pride = mod.quickTagEvent(mod.loadQuickTags()[0]);
        const blaze = mod.quickTagEvent(mod.loadQuickTags()[1]);
        const circle = mod.quickTagEvent(mod.loadQuickTags()[2]);
        expect(pride.event).toBe('PRIDE BS2');
        expect(blaze.event).toBe('BLAZE BS2');
        expect(circle.event).toBe('PRIDE CD');

        expect(mod.selectVideoZone('3')).toBe(true);
        const [saved] = JSON.parse(localStorage.getItem('fieldHockeyGames_v1'));
        expect(saved.events.map(event => event.event)).toEqual(['PRIDE BS2', 'BLAZE BS2', 'PRIDE CD']);
        expect(saved.metadata.activeZone).toBe('3');
        expect(document.querySelector('[data-tag-id="pride-bs"] .tag-label').textContent).toBe('BS3');
        expect(document.querySelector('[data-tag-id="blaze-bs"] .tag-label').textContent).toBe('BS3');
        expect(document.querySelector('[data-tag-id="pride-cd"] .tag-label').textContent).toBe('CD');
    });

    test('the zone bar stays hidden when no tag adds the zone number', () => {
        mod.resetQuickTags();
        mod.setTaggingMode(true);
        expect(document.getElementById('video-zone-bar').classList.contains('hidden')).toBe(true);
        expect(document.querySelector('.zone-button')).toBeNull();
    });

    test('number keys tag the matching button and leave the zone alone', () => {
        mod.setMatchTeams([
            { code: 'PRIDE', color: 'red' },
            { code: 'BLAZE', color: 'orange' }
        ]);
        mod.saveQuickTags([
            { id: 'pride-bs', label: 'BS', team: 'team1', colorClass: 'btn-red', zoned: true },
            { id: 'blaze-bs', label: 'BS', team: 'team2', colorClass: 'btn-orange', zoned: true }
        ]);
        mod.selectVideoZone('2');
        document.getElementById('video-player').currentTime = 8;
        mod.handleVideoCodingKey(new KeyboardEvent('keydown', { key: '2' }));

        const [saved] = JSON.parse(localStorage.getItem('fieldHockeyGames_v1'));
        expect(saved.events.map(event => event.event)).toEqual(['BLAZE BS2']);
        expect(saved.metadata.activeZone).toBe('2');
        expect(document.querySelector('.zone-button.is-active').dataset.zone).toBe('2');
    });

    test('an unknown zone is ignored and a plain BS1 tag is not rewritten', () => {
        mod.setMatchTeams([
            { code: 'PRIDE', color: 'red' },
            { code: 'BLAZE', color: 'orange' }
        ]);
        mod.saveQuickTags([
            { id: 'pride-bs', label: 'BS', team: 'team1', colorClass: 'btn-red', zoned: true }
        ]);
        mod.selectVideoZone('2');
        expect(mod.selectVideoZone('9')).toBe(false);
        expect(document.querySelector('.zone-button.is-active').dataset.zone).toBe('2');

        const created = mod.quickTagEvent({ id: 'old', label: 'BS1', team: 'team1', colorClass: 'btn-red', zoned: false });
        expect(created.event).toBe('PRIDE BS1');
    });

    test('opening a saved match restores its zone without changing events already logged', () => {
        const games = JSON.parse(localStorage.getItem('fieldHockeyGames_v1'));
        games[0].metadata.activeZone = '4';
        games[0].events = [{ id: 'e1', event: 'FIRE BS1', timeMs: 1000, timestamp: '00:01', isFavorite: false }];
        localStorage.setItem('fieldHockeyGames_v1', JSON.stringify(games));
        mod.saveQuickTags([
            { id: 'pride-bs', label: 'BS', team: 'team1', colorClass: 'btn-red', zoned: true }
        ]);

        mod.loadGame(GAME_ID);
        mod.setTaggingMode(true);

        expect(document.querySelector('.zone-button.is-active').dataset.zone).toBe('4');
        expect(document.querySelector('.tag-label').textContent).toBe('BS4');
        const [saved] = JSON.parse(localStorage.getItem('fieldHockeyGames_v1'));
        expect(saved.events[0].event).toBe('FIRE BS1');
    });

    test('Add zone number turns a baked-in zone digit into the stem', () => {
        const input = document.getElementById('new-tag-label-input');
        const box = document.getElementById('tag-add-zone-checkbox');
        input.value = 'BS1';
        box.checked = true;
        box.dispatchEvent(new Event('change'));
        expect(input.value).toBe('BS');
        expect(mod.prepareZoneAwareLabel('A25E', true)).toBe('A25E');
        expect(mod.prepareZoneAwareLabel('BS1', false)).toBe('BS1');
    });

    test('getMatchTeams, setMatchTeams, and swapMatchTeams sync with game metadata', () => {
        const initialTeams = mod.getMatchTeams();
        expect(Array.isArray(initialTeams)).toBe(true);
        expect(initialTeams).toHaveLength(2);

        // Set custom teams for current match
        mod.setMatchTeams([
            { code: 'FIRE', color: 'red' },
            { code: 'TIGERS', color: 'yellow' }
        ]);
        const updatedTeams = mod.getMatchTeams();
        expect(updatedTeams[0].code).toBe('FIRE');
        expect(updatedTeams[1].code).toBe('TIGERS');

        // Swap teams
        const swapped = mod.swapMatchTeams();
        expect(swapped[0].code).toBe('TIGERS');
        expect(swapped[1].code).toBe('FIRE');
        expect(swapped[0].color).toBe('yellow');
        expect(swapped[1].color).toBe('red');
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

    test('setTimelineCollapsed toggles timeline visibility without terminating tagging mode', () => {
        const layout = document.querySelector('.review-layout');
        const panel = document.getElementById('video-coding-panel');

        // Start in tagging mode
        mod.setTaggingMode(true);
        expect(panel.classList.contains('hidden')).toBe(false);

        // Collapse timeline for focus
        mod.setTimelineCollapsed(true);
        expect(layout.classList.contains('timeline-collapsed')).toBe(true);
        expect(panel.classList.contains('hidden')).toBe(false); // Quick tags still active!

        // Open timeline to inspect events
        mod.setTimelineCollapsed(false);
        expect(layout.classList.contains('timeline-collapsed')).toBe(false);
        expect(panel.classList.contains('hidden')).toBe(false); // Quick tags still active!
    });

    test('review screen has no duplicate Tag Video buttons in headers, and setTaggingMode toggles mode cleanly', () => {
        expect(document.getElementById('timeline-tag-mode-btn')).toBeNull();
        expect(document.getElementById('toggle-tagging-mode-btn')).toBeNull();

        const panel = document.getElementById('video-coding-panel');
        mod.setTaggingMode(true);
        expect(panel.classList.contains('hidden')).toBe(false);

        mod.setTaggingMode(false);
        expect(panel.classList.contains('hidden')).toBe(true);
    });

    test('continuing coding on a saved match preserves existing event fields, teamCodes, and updates elapsedTime', () => {
        const liveCaptureGame = {
            id: 'live-game-1',
            teams: 'FIRE vs TIGERS',
            teamCodes: ['FIRE', 'TIGERS'],
            elapsedTime: 120000,
            timestamp: '2026-10-23T08:00:00.000Z',
            events: [
                {
                    id: 'evt-1',
                    event: 'FIRE - Circle Entry',
                    eventCode: 'CE',
                    team: 'FIRE',
                    timeMs: 45000,
                    timestamp: '00:45',
                    lead: 8,
                    lag: 12,
                    leadTime: 8,
                    lagTime: 12
                }
            ]
        };
        localStorage.setItem('fieldHockeyGames_v1', JSON.stringify([liveCaptureGame]));

        mod.loadGame('live-game-1');
        mod.setTaggingMode(true);

        const video = document.getElementById('video-player');
        video.currentTime = 150; // 150,000 ms (2:30)
        mod.quickTagEvent('Goal');

        const [saved] = JSON.parse(localStorage.getItem('fieldHockeyGames_v1'));
        expect(saved.id).toBe('live-game-1');
        expect(saved.teams).toBe('FIRE vs TIGERS');
        expect(saved.teamCodes).toEqual(['FIRE', 'TIGERS']);
        expect(saved.elapsedTime).toBe(150000);
        expect(saved.events).toHaveLength(2);
        expect(saved.events[0]).toMatchObject({
            id: 'evt-1',
            event: 'FIRE - Circle Entry',
            eventCode: 'CE',
            team: 'FIRE',
            leadTime: 8,
            lagTime: 12
        });
        expect(saved.events[1]).toMatchObject({
            event: 'Goal',
            timeMs: 150000,
            timestamp: '02:30'
        });
    });
    test('showQuickTagFeedback updates text content without unhiding or shifting visual layout', () => {
        const feedback = document.getElementById('quick-tag-feedback');
        expect(feedback.classList.contains('sr-only')).toBe(true);

        mod.showQuickTagFeedback('Goal', '01:23');

        expect(feedback.textContent).toBe('Tagged Goal at 01:23');
        // Remains sr-only so no vertical layout shift is caused
        expect(feedback.classList.contains('sr-only')).toBe(true);
    });

    test('updateFabVisibility hides top toolbar add-event-fab in tagging mode to eliminate duplicate custom tag buttons', () => {
        const fab = document.getElementById('add-event-fab');
        const video = document.getElementById('video-player');

        // Simulate video ready
        video.src = 'blob:test';
        Object.defineProperty(video, 'readyState', { value: 4, configurable: true });

        // In review mode (not tagging mode), fab is visible
        mod.setTaggingMode(false);
        mod.updateFabVisibility();
        expect(fab.classList.contains('hidden')).toBe(false);

        // When switching to tagging mode, fab is hidden because panel has Custom Tag button
        mod.setTaggingMode(true);
        expect(fab.classList.contains('hidden')).toBe(true);

        // Switching back to review mode restores fab
        mod.setTaggingMode(false);
        expect(fab.classList.contains('hidden')).toBe(false);
    });

    describe('Video URL Attachment and Persistence', () => {
        test('validateVideoUrl validates direct video URLs and detects third-party watch links', () => {
            const validMp4 = mod.validateVideoUrl('https://club-media.example.org/videos/match-2026.mp4');
            expect(validMp4.valid).toBe(true);
            expect(validMp4.isSupportedDirect).toBe(true);

            const validWebm = mod.validateVideoUrl('https://example.com/stream.webm');
            expect(validWebm.valid).toBe(true);
            expect(validWebm.isSupportedDirect).toBe(true);

            const youtubeLink = mod.validateVideoUrl('https://www.youtube.com/watch?v=sample123');
            expect(youtubeLink.valid).toBe(true);
            expect(youtubeLink.isSupportedDirect).toBe(false);
            expect(youtubeLink.warning).toContain('YouTube');

            const youtuBeLink = mod.validateVideoUrl('https://youtu.be/sample123');
            expect(youtuBeLink.valid).toBe(true);
            expect(youtuBeLink.isSupportedDirect).toBe(false);

            const vimeoLink = mod.validateVideoUrl('https://vimeo.com/123456789');
            expect(vimeoLink.valid).toBe(true);
            expect(vimeoLink.isSupportedDirect).toBe(false);
            expect(vimeoLink.warning).toContain('Vimeo');

            const emptyResult = mod.validateVideoUrl('');
            expect(emptyResult.valid).toBe(false);

            const invalidResult = mod.validateVideoUrl('ftp://not-supported');
            expect(invalidResult.valid).toBe(false);
        });

        test('attachVideoUrl sets video source, hides empty overlay, and persists URL in storage', () => {
            const video = document.getElementById('video-player');
            const url = 'https://cloud-storage.example.com/hockey/q1.mp4';

            const result = mod.attachVideoUrl(url);
            expect(result.success).toBe(true);
            expect(video.src).toBe(url);

            const [saved] = JSON.parse(localStorage.getItem('fieldHockeyGames_v1'));
            expect(saved.videoUrl).toBe(url);
            expect(saved.metadata.videoUrl).toBe(url);

            const emptyOverlay = document.getElementById('video-stage-empty-overlay');
            expect(emptyOverlay.classList.contains('hidden')).toBe(true);
        });

        test('attachVideoUrl commits draft game automatically so video URL is saved', () => {
            const draft = mod.createNewVideoGame('Draft Match With Video');
            const url = 'https://videos.example.org/finals.mp4';

            const result = mod.attachVideoUrl(url);
            expect(result.success).toBe(true);

            const games = JSON.parse(localStorage.getItem('fieldHockeyGames_v1'));
            const savedDraft = games.find(g => g.id === draft.id);
            expect(savedDraft).toBeDefined();
            expect(savedDraft.videoUrl).toBe(url);
        });

        test('detachVideo clears player source and removes videoUrl from storage', () => {
            const url = 'https://cloud-storage.example.com/hockey/q1.mp4';
            mod.attachVideoUrl(url);

            const video = document.getElementById('video-player');
            expect(video.src).toBe(url);

            mod.detachVideo();
            expect(video.src).toBe('');

            const [saved] = JSON.parse(localStorage.getItem('fieldHockeyGames_v1'));
            expect(saved.videoUrl).toBeUndefined();
            expect(saved.metadata.videoUrl).toBeUndefined();
        });

        test('loadGame restores videoUrl from saved game automatically', () => {
            const testGameId = 'game-with-url';
            const videoUrl = 'https://media.hockey.org/replay-1080p.mp4';
            localStorage.setItem('fieldHockeyGames_v1', JSON.stringify([
                { id: testGameId, teams: 'Adelaide vs Melbourne', events: [], videoUrl, metadata: { videoUrl } }
            ]));

            mod.loadGame(testGameId);

            const video = document.getElementById('video-player');
            expect(video.src).toBe(videoUrl);
        });

        test('modal tabs switch cleanly between URL and Local File panels', () => {
            const tabUrl = document.getElementById('tab-attach-url');
            const tabFile = document.getElementById('tab-attach-file');
            const panelUrl = document.getElementById('panel-attach-url');
            const panelFile = document.getElementById('panel-attach-file');

            mod.switchAttachVideoTab('file');
            expect(tabFile.classList.contains('is-active')).toBe(true);
            expect(tabUrl.classList.contains('is-active')).toBe(false);
            expect(panelFile.classList.contains('hidden')).toBe(false);
            expect(panelUrl.classList.contains('hidden')).toBe(true);

            mod.switchAttachVideoTab('url');
            expect(tabUrl.classList.contains('is-active')).toBe(true);
            expect(tabFile.classList.contains('is-active')).toBe(false);
            expect(panelUrl.classList.contains('hidden')).toBe(false);
            expect(panelFile.classList.contains('hidden')).toBe(true);
        });
    });

    describe('Label Sweep and Tactical Tagging', () => {
        const testGameId = 'game-labels-1';
        const eventsWithSchemas = [
            { id: 'ev-1', event: 'FIRE CE', timeMs: 45000 },
            { id: 'ev-2', event: 'FIRE PC', timeMs: 90000, labels: [{ group: 'Execution', text: 'Direct' }] },
            { id: 'ev-3', event: 'FIRE BW 1', timeMs: 120000 },
            { id: 'ev-4', event: 'START', timeMs: 1000 } // No schema
        ];

        beforeEach(() => {
            localStorage.setItem('fieldHockeyGames_v1', JSON.stringify([
                { id: testGameId, teams: 'Fire vs Tigers', events: eventsWithSchemas, metadata: {} }
            ]));
            mod.loadGame(testGameId);
        });

        test('counts unlabelled events matching schemas accurately', () => {
            // ev-1 (CE) and ev-3 (BW 1) have schemas and no labels -> count is 2
            // ev-2 has label, ev-4 has no schema
            expect(mod.getUnlabelledEventsCount()).toBe(2);
        });

        test('setFilterViewMode isolates unlabelled events matching schemas', () => {
            mod.setFilterViewMode('unlabelled');
            const visible = mod.getVisibleEvents();
            expect(visible.map(e => e.id)).toEqual(['ev-1', 'ev-3']);

            mod.setFilterViewMode('all');
            expect(mod.getVisibleEvents()).toHaveLength(4);
        });

        test('updateEventLabel adds, replaces, and toggles off labels', () => {
            // Add label to ev-1
            mod.updateEventLabel('ev-1', 'Channel', 'Left');
            const [saved] = JSON.parse(localStorage.getItem('fieldHockeyGames_v1'));
            const ev1 = saved.events.find(e => e.id === 'ev-1');
            expect(ev1.labels).toEqual([{ group: 'Channel', text: 'Left' }]);

            // Replace with Center
            mod.updateEventLabel('ev-1', 'Channel', 'Center');
            const [saved2] = JSON.parse(localStorage.getItem('fieldHockeyGames_v1'));
            const ev1Updated = saved2.events.find(e => e.id === 'ev-1');
            expect(ev1Updated.labels).toEqual([{ group: 'Channel', text: 'Center' }]);

            // Toggle off by selecting same label again
            mod.updateEventLabel('ev-1', 'Channel', 'Center');
            const [saved3] = JSON.parse(localStorage.getItem('fieldHockeyGames_v1'));
            const ev1Toggled = saved3.events.find(e => e.id === 'ev-1');
            expect(ev1Toggled.labels).toEqual([]);
        });

        test('startLabelSweep activates sweep controls and loads first candidate', () => {
            mod.startLabelSweep();
            const video = document.getElementById('video-player');
            // ev-1 is at 45000ms (45s). Smart lead applies 8s minimum pre-roll -> 37s
            expect(video.currentTime).toBe(37);
            const sweepControls = document.getElementById('sweep-controls');
            expect(sweepControls.classList.contains('flex')).toBe(true);

            const counter = document.getElementById('sweep-counter');
            expect(counter.textContent).toBe('1/2');

            // Apply sweep label
            mod.applySweepLabel('Channel', 'Right');
            const [saved] = JSON.parse(localStorage.getItem('fieldHockeyGames_v1'));
            const ev1 = saved.events.find(e => e.id === 'ev-1');
            expect(ev1.labels).toEqual([{ group: 'Channel', text: 'Right' }]);

            // Next candidate ev-3 is at 120s. Smart lead pre-roll seeks to 120 - 8 = 112s
            expect(video.currentTime).toBe(112);

            // Replay clip re-seeks back to 112s
            video.currentTime = 119;
            mod.replayCurrentSweepClip();
            expect(video.currentTime).toBe(112);

            mod.exitLabelSweep();
            expect(sweepControls.classList.contains('flex')).toBe(false);
        });
    });
});

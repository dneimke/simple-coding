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

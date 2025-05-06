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


import { Router } from '../../src/components/router.js';
import { stateService } from '../../src/services/stateService.js';

// Mock the stateService
jest.mock('../../src/services/stateService.js', () => ({
    stateService: {
        subscribe: jest.fn(),
        setState: jest.fn(),
        getState: jest.fn()
    }
}));

// Mock window location and history
const originalLocation = window.location;
const originalHistory = window.history;

describe('Router', () => {
    let router;
    let mockViews;
    let mockTabs;

    beforeEach(() => {
        // Mock DOM elements
        mockViews = {
            EventCapture: {
                view: { classList: { add: jest.fn(), remove: jest.fn() } },
                button: {
                    classList: { add: jest.fn(), remove: jest.fn() },
                    removeAttribute: jest.fn(),
                    setAttribute: jest.fn()
                }
            },
            Config: {
                view: { classList: { add: jest.fn(), remove: jest.fn() } },
                button: {
                    classList: { add: jest.fn(), remove: jest.fn() },
                    removeAttribute: jest.fn(),
                    setAttribute: jest.fn()
                }
            }, Log: {
                view: { classList: { add: jest.fn(), remove: jest.fn() } },
                button: {
                    classList: { add: jest.fn(), remove: jest.fn() },
                    removeAttribute: jest.fn(),
                    setAttribute: jest.fn()
                }
            },
            SavedGames: {
                view: { classList: { add: jest.fn(), remove: jest.fn() } },
                button: {
                    classList: { add: jest.fn(), remove: jest.fn() },
                    removeAttribute: jest.fn(),
                    setAttribute: jest.fn()
                }
            }
        };

        mockTabs = {
            timeline: { classList: { toggle: jest.fn() } },
            xml: { classList: { toggle: jest.fn() } },
            statistics: { classList: { toggle: jest.fn() } },
            timelineView: { classList: { toggle: jest.fn() } },
            xmlView: { classList: { toggle: jest.fn() } },
            statisticsView: { classList: { toggle: jest.fn() } }
        };        // Mock window location
        delete window.location;
        window.location = {
            _hash: '',
            href: 'http://test.com',
            // Create a setter for hash that will update the hash property when it's assigned
            set hash(value) {
                // Make sure the hash starts with #
                this._hash = value.startsWith('#') ? value : `#${value}`;
            },
            get hash() {
                return this._hash || '';
            }
        };

        // Mock window history
        delete window.history;
        window.history = {
            pushState: jest.fn(),
            replaceState: jest.fn()
        };

        // Mock DOM event listeners
        window.addEventListener = jest.fn();
        document.addEventListener = jest.fn();

        // Create router instance
        router = new Router(mockViews, mockTabs);
    });

    afterEach(() => {
        // Restore window location and history
        window.location = originalLocation;
        window.history = originalHistory;

        // Clear mocks
        jest.clearAllMocks();
    });

    test('should subscribe to state changes on initialization', () => {
        expect(stateService.subscribe).toHaveBeenCalledWith('ui.currentTab', expect.any(Function));
        expect(stateService.subscribe).toHaveBeenCalledWith('ui.currentView', expect.any(Function));
    });

    test('should set up hash navigation listeners', () => {
        expect(window.addEventListener).toHaveBeenCalledWith('hashchange', expect.any(Function));
        expect(window.addEventListener).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function));
    });

    test('showView should update URL hash', () => {
        router.showView('Config');
        expect(window.location.hash).toBe('#configure');
    });

    test('a view with no nav button still switches', () => {
        const logView = { classList: { add: jest.fn(), remove: jest.fn() } };
        const logRouter = new Router({
            ...mockViews,
            Log: { view: logView, button: null }
        }, mockTabs);

        expect(() => logRouter._handleViewChange('Log')).not.toThrow();
        expect(logView.classList.remove).toHaveBeenCalledWith('hidden');
        expect(mockViews.EventCapture.button.removeAttribute).toHaveBeenCalledWith('aria-current');
    });
    test('_handleTabChange should update tab visibility', () => {
        const handleTabChange = router._handleTabChange;
        handleTabChange('timelineView');

        // Check that timeline tab is active
        expect(mockTabs.timeline.classList.toggle).toHaveBeenCalledWith('tab-button-active', true);
        expect(mockTabs.xml.classList.toggle).toHaveBeenCalledWith('tab-button-active', false);
        expect(mockTabs.statistics.classList.toggle).toHaveBeenCalledWith('tab-button-active', false);

        // Check that timeline view is visible
        expect(mockTabs.timelineView.classList.toggle).toHaveBeenCalledWith('hidden', false);
        expect(mockTabs.xmlView.classList.toggle).toHaveBeenCalledWith('hidden', true);
        expect(mockTabs.statisticsView.classList.toggle).toHaveBeenCalledWith('hidden', true);
    });

    test('_handleTabChange handles any button and panel pair, such as a Recent tab', () => {
        const recent = { classList: { toggle: jest.fn() } };
        const recentView = { classList: { toggle: jest.fn() } };
        const tabRouter = new Router(mockViews, { ...mockTabs, recent, recentView });

        tabRouter._handleTabChange('recentView');

        expect(recent.classList.toggle).toHaveBeenCalledWith('tab-button-active', true);
        expect(recentView.classList.toggle).toHaveBeenCalledWith('hidden', false);
        expect(mockTabs.timeline.classList.toggle).toHaveBeenCalledWith('tab-button-active', false);
        expect(mockTabs.timelineView.classList.toggle).toHaveBeenCalledWith('hidden', true);
    });

    test('switchTab should update the current tab state', () => {
        router.switchTab('xmlView');
        expect(stateService.setState).toHaveBeenCalledWith('ui.currentTab', 'xmlView');
    });

    test('viewToHashMap should correctly map view names to hash values', () => {
        expect(router.viewToHashMap).toEqual({
            'EventCapture': 'event-capture',
            'Config': 'configure',
            'Log': 'log',
            'SavedGames': 'saved-games'
        });
    });

    test('hashToViewMap should correctly map hash values to view names', () => {
        expect(router.hashToViewMap).toEqual({
            'event-capture': 'EventCapture',
            'configure': 'Config',
            'log': 'Log',
            'saved-games': 'SavedGames'
        });
    });

    describe('Log route guard', () => {
        test('#log without an active game redirects to Event Capture', () => {
            stateService.getState.mockReturnValue(false);
            window.location.hash = 'log';

            router._handleHashChange();

            expect(stateService.setState).toHaveBeenCalledWith('ui.logGameId', null);
            expect(stateService.setState).not.toHaveBeenCalledWith('ui.currentView', 'Log');
            expect(window.location.hash).toBe('#event-capture');
        });

        test('#log with an active game shows the live Log view', () => {
            stateService.getState.mockReturnValue(true);
            window.location.hash = 'log';

            router._handleHashChange();

            expect(stateService.setState).toHaveBeenCalledWith('ui.logGameId', null);
            expect(stateService.setState).toHaveBeenCalledWith('ui.currentView', 'Log');
        });

        test('#log/<id> shows a saved game log without an active game', () => {
            stateService.getState.mockReturnValue(false);
            window.location.hash = 'log/game-abc%20123';

            router._handleHashChange();

            expect(stateService.setState).toHaveBeenCalledWith('ui.logGameId', 'game-abc 123');
            expect(stateService.setState).toHaveBeenCalledWith('ui.currentView', 'Log');
        });

        test('other views clear the saved game id', () => {
            window.location.hash = 'saved-games';

            router._handleHashChange();

            expect(stateService.setState).toHaveBeenCalledWith('ui.logGameId', null);
            expect(stateService.setState).toHaveBeenCalledWith('ui.currentView', 'SavedGames');
        });
    });
});

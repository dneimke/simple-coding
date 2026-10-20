import { logger } from '../utils/formatUtils.js';
import { stateService } from '../services/stateService.js';
import { ensureSampleGameExists, SAMPLE_GAME_ID } from '../utils/seedData.js';

export class Router {
    constructor(views, tabs) {
        this.views = views;
        this.tabs = tabs;

        // Map to convert between view names and hash values
        this.viewToHashMap = {
            'EventCapture': 'event-capture',
            'Config': 'configure',
            'Log': 'log',
            'SavedGames': 'saved-games'
        };

        this.hashToViewMap = Object.entries(this.viewToHashMap).reduce((acc, [view, hash]) => {
            acc[hash] = view;
            return acc;
        }, {});

        // Subscribe to UI state changes
        stateService.subscribe('ui.currentTab', this._handleTabChange.bind(this));
        stateService.subscribe('ui.currentView', this._handleViewChange.bind(this));

        // Set up hash-based navigation
        this._initializeHashNavigation();
    }

    /**
     * Set up hash navigation handlers
     * @private
     */
    _initializeHashNavigation() {
        // Handle initial hash on page load
        window.addEventListener('DOMContentLoaded', () => {
            this._handleHashChange();
        });

        // Handle hash changes
        window.addEventListener('hashchange', () => {
            this._handleHashChange();
        });
    }

    /**
     * Handle URL hash changes
     * @private
     */
    _handleHashChange() {
        // Get the hash without the # character
        const fullHash = window.location.hash.substring(1);
        const [hash, param] = fullHash.split('/');
        if (hash) {
            const viewName = this.hashToViewMap[hash];
            if (viewName) {
                const savedGameId = viewName === 'Log' && param ? decodeURIComponent(param) : null;
                stateService.setState('ui.logGameId', savedGameId);
                if (savedGameId === SAMPLE_GAME_ID) {
                    ensureSampleGameExists();
                }

                if (viewName === 'Log' && !savedGameId) {
                    // Check if there's an active game via state service instead of localStorage
                    const hasActiveGame = stateService.getState('game.hasCurrentGame');
                    if (!hasActiveGame) {
                        this._updateHashSilently(hash);
                        this.showView('event-capture');
                        return;
                    }
                }

                // Switch to the view without updating hash (to avoid loop)
                this._showViewWithoutHashUpdate(viewName);
            } else {
                // Invalid hash, default to EventCapture
                this._updateHashSilently('event-capture');
                this._showViewWithoutHashUpdate('EventCapture');
            }
        } else {
            // No hash, default to EventCapture
            this._updateHashSilently('event-capture');
            this._showViewWithoutHashUpdate('EventCapture');
        }
    }

    /**
     * Update URL hash without triggering hashchange event
     * @param {string} hash - Hash value (without #)
     * @private
     */
    _updateHashSilently(hash) {
        const currentUrl = window.location.href;
        const baseUrl = currentUrl.split('#')[0];
        const newUrl = `${baseUrl}#${hash}`;

        history.replaceState(null, '', newUrl);
    }

    /**
     * Show view without updating hash (for internal use)
     * @param {string} viewName - Name of view to show
     * @private
     */
    _showViewWithoutHashUpdate(viewName) {
        stateService.setState('ui.currentView', viewName);
    }

    /**
     * Handle tab change from state service
     * @param {string} tabName - New tab name
     * @private
     */
    _handleTabChange = (tabName) => {
        // Tabs come in pairs: a button under `name` and its panel under `${name}View`
        Object.entries(this.tabs)
            .filter(([name]) => !name.endsWith('View') && this.tabs[`${name}View`])
            .forEach(([name, button]) => {
                const panelName = `${name}View`;
                const isActive = tabName === panelName;
                button.classList.toggle('tab-button-active', isActive);
                this.tabs[panelName].classList.toggle('hidden', !isActive);
            });
    };

    switchTab = (tabToShow) => {
        stateService.setState('ui.currentTab', tabToShow);
    };

    /**
     * Handle view change from state service
     * @param {string} viewName - New view name
     * @private
     */
    _handleViewChange = (viewName) => {
        Object.values(this.views).forEach(({ view, button }) => {
            view.classList.add('hidden');
            if (!button) return;

            // Remove active classes for both old and new styles
            button.classList.remove('text-white', 'hover:text-white');
            button.classList.add('text-gray-400', 'hover:text-white');

            // Remove any active styling for new navigation style
            button.classList.remove('nav-link-active');

            // Remove ARIA current attribute
            button.removeAttribute('aria-current');
        });

        const selectedView = this.views[viewName];
        if (!selectedView) {
            logger.error(`Invalid view: ${viewName}`);
            return;
        }

        selectedView.view.classList.remove('hidden');
        if (!selectedView.button) return;

        // Apply active styles for both old and new navigation styles
        selectedView.button.classList.add('text-white', 'hover:text-white', 'nav-link-active');
        selectedView.button.classList.remove('text-gray-400', 'hover:text-white');

        // Set ARIA current page attribute
        selectedView.button.setAttribute('aria-current', 'page');
    };

    /**
     * Show a specific view and update URL hash
     * @param {string} viewToShow - View name to show
     * @param {Function} [callback] - Optional callback after view change
     */
    showView = (viewToShow, callback) => {
        // Update URL hash, which will trigger view change via hash handler
        const hash = this.viewToHashMap[viewToShow] || 'event-capture';
        window.location.hash = hash;

        if (typeof callback === 'function') {
            callback();
        }
    };
}
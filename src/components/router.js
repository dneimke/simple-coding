import { logger } from '../utils/formatUtils.js';
import { stateService } from '../services/stateService.js';

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
        const hash = window.location.hash.substring(1);

        if (hash) {
            const viewName = this.hashToViewMap[hash];
            if (viewName) {
                // Check if view has prerequisites (like active game for Log)
                if (viewName === 'Log') {
                    const hasActiveGame = localStorage.getItem('currentGame') !== null;
                    if (!hasActiveGame) {
                        // Default to EventCapture if no active game
                        this._updateHashSilently('event-capture');
                        this.showView('EventCapture');
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
        const isTimelineView = tabName === 'timelineView';
        const isXmlView = tabName === 'xmlView';
        const isStatisticsView = tabName === 'statisticsView';

        const { timeline, xml, statistics, timelineView, xmlView, statisticsView } = this.tabs;

        timeline.classList.toggle('tab-button-active', isTimelineView);
        xml.classList.toggle('tab-button-active', isXmlView);
        statistics.classList.toggle('tab-button-active', isStatisticsView);

        timelineView.classList.toggle('hidden', !isTimelineView);
        xmlView.classList.toggle('hidden', !isXmlView);
        statisticsView.classList.toggle('hidden', !isStatisticsView);
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
            button.classList.remove('text-white', 'hover:text-white');
            button.classList.add('text-gray-400', 'hover:text-white');
        });

        const selectedView = this.views[viewName];
        if (!selectedView) {
            logger.error(`Invalid view: ${viewName}`);
            return;
        }

        selectedView.view.classList.remove('hidden');
        selectedView.button.classList.add('text-white', 'hover:text-white');
        selectedView.button.classList.remove('text-gray-400', 'hover:text-white');
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
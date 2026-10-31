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
            'SavedGames': 'saved-games',
            'Help': 'help'
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
     * Scroll to an in-page anchor element if it exists
     * @param {string} anchorId
     * @private
     */
    _scrollToAnchor(anchorId) {
        if (!anchorId || typeof document === 'undefined') return;
        const target = document.getElementById(anchorId);
        if (target && typeof target.scrollIntoView === 'function') {
            setTimeout(() => {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 50);
        }
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

        if (typeof document !== 'undefined' && document.readyState !== 'loading') {
            this._handleHashChange();
        }

        // Handle hash changes
        window.addEventListener('hashchange', () => {
            this._handleHashChange();
        });
    }

    /**
     * Parse hash into route segments
     * @private
     * @returns {{ hash: string, param: string|undefined }}
     */
    _parseHashRoute() {
        const fullHash = (typeof window !== 'undefined' && window.location?.hash ? window.location.hash.substring(1) : '');
        const routeOnly = fullHash.split('?')[0];
        const [hash, param] = routeOnly.split('/');
        return { hash, param };
    }

    /**
     * Find containing view for a DOM element anchor
     * @private
     * @param {HTMLElement} el
     * @returns {string|null} View key
     */
    _findViewForElement(el) {
        for (const [key, obj] of Object.entries(this.views)) {
            const v = obj?.view;
            if (v && (v === el || (typeof v.contains === 'function' && v.contains(el)))) {
                return key;
            }
        }
        return null;
    }

    /**
     * Resolve view name and anchor target from hash segments
     * @private
     * @param {string} hash
     * @param {string} [param]
     * @returns {{ viewName: string|null, anchorTarget: string|null }}
     */
    _resolveViewAndAnchor(hash, param) {
        const directView = this.hashToViewMap[hash];
        if (directView) {
            return { viewName: directView, anchorTarget: param || null };
        }

        const targetEl = typeof document !== 'undefined' && typeof document.getElementById === 'function'
            ? document.getElementById(hash)
            : null;

        if (targetEl) {
            const containingView = this._findViewForElement(targetEl);
            if (containingView) {
                return { viewName: containingView, anchorTarget: hash };
            }
        }

        return { viewName: null, anchorTarget: null };
    }

    /**
     * Resolve default view when no hash is present
     * @private
     * @returns {string} View name
     */
    // fallow-ignore-next-line complexity
    _resolveDefaultView() {
        const search = typeof window !== 'undefined' && window.location?.search ? window.location.search : '';
        const params = new URLSearchParams(search);
        const viewParam = params.get('view');
        const mockParam = params.get('mock');
        const pathname = typeof window !== 'undefined' && window.location?.pathname ? window.location.pathname : '';

        if (viewParam === 'config') return 'Config';
        if (viewParam === 'help') return 'Help';
        if (pathname.includes('/dev/preview') || viewParam === 'event-capture' || mockParam === 'active' || mockParam === 'pc-counter') {
            return 'EventCapture';
        }
        return 'SavedGames';
    }

    /**
     * Handle active view transition and side effects
     * @private
     */
    _handleActiveView(viewName, param, anchorTarget, hash) {
        const savedGameId = viewName === 'Log' && param ? decodeURIComponent(param) : null;
        stateService.setState('ui.logGameId', savedGameId);
        if (savedGameId === SAMPLE_GAME_ID) {
            ensureSampleGameExists();
        }

        if (viewName === 'Log' && !savedGameId) {
            const hasActiveGame = stateService.getState('game.hasCurrentGame');
            if (!hasActiveGame) {
                this._updateHashSilently(hash);
                this.showView('saved-games');
                return;
            }
        }

        this._showViewWithoutHashUpdate(viewName);

        if (anchorTarget) {
            this._scrollToAnchor(anchorTarget);
        }
    }

    /**
     * Handle URL hash changes
     * @private
     */
    _handleHashChange() {
        const { hash, param } = this._parseHashRoute();
        if (hash) {
            const { viewName, anchorTarget } = this._resolveViewAndAnchor(hash, param);
            if (viewName) {
                this._handleActiveView(viewName, param, anchorTarget, hash);
            } else {
                this._updateHashSilently('saved-games');
                this._showViewWithoutHashUpdate('SavedGames');
            }
        } else {
            const defaultView = this._resolveDefaultView();
            if (defaultView === 'SavedGames') {
                this._updateHashSilently('saved-games');
            }
            this._showViewWithoutHashUpdate(defaultView);
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
        const hash = this.viewToHashMap[viewToShow] || 'saved-games';
        window.location.hash = hash;

        if (typeof callback === 'function') {
            callback();
        }
    };
}

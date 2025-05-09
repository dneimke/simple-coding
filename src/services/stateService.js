/**
 * State Service - Manages application state and subscriptions
 *
 * Implements a simple pub/sub pattern to allow components
 * to subscribe to state changes and be notified when they occur.
 */

/**
 * State Service - Centralized state management with pub/sub pattern
 */
export const stateService = {
    // Private state store
    _state: {
        game: {
            isActive: false,
            isRunning: false,
            elapsedTime: 0,
            loggedEvents: [],
            hasCurrentGame: false
        },
        ui: {
            currentView: 'EventCapture',
            currentTab: 'timelineView'
        }
    },

    // Subscribers map (event name -> array of handlers)
    _subscribers: {},

    /**
     * Get current state or a specific state slice
     * @param {string} [path] - Optional dot notation path to specific state slice
     * @returns {any} Current state or state slice
     */
    getState(path) {
        if (!path) return { ...this._state };

        return path.split('.').reduce((obj, key) =>
            obj && obj[key] !== undefined ? obj[key] : null
            , this._state);
    },

    /**
     * Update state and notify subscribers
     * @param {string} path - Dot notation path to state slice to update
     * @param {any} newValue - New value to set
     * @param {boolean} [merge=false] - Whether to merge with existing object or replace
     */
    setState(path, newValue, merge = false) {
        // Navigate to the parent object of the property to update
        const pathParts = path.split('.');
        const propToUpdate = pathParts.pop();
        const parent = pathParts.reduce((obj, key) => {
            if (!obj[key]) obj[key] = {};
            return obj[key];
        }, this._state);

        // Update the property
        if (merge && typeof parent[propToUpdate] === 'object' && typeof newValue === 'object') {
            parent[propToUpdate] = { ...parent[propToUpdate], ...newValue };
        } else {
            parent[propToUpdate] = newValue;
        }

        // Notify subscribers
        this._notify(path, this.getState(path));
    },

    /**
     * Subscribe to state changes
     * @param {string} path - Path to state slice to subscribe to
     * @param {Function} handler - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribe(path, handler) {
        if (!this._subscribers[path]) {
            this._subscribers[path] = [];
        }

        this._subscribers[path].push(handler);

        // Return unsubscribe function
        return () => {
            this._subscribers[path] = this._subscribers[path].filter(h => h !== handler);
        };
    },

    /**
     * Notify subscribers of state change
     * @private
     * @param {string} path - Path that changed
     * @param {any} value - New value
     */
    _notify(path, value) {
        // Notify direct subscribers to this path
        if (this._subscribers[path]) {
            this._subscribers[path].forEach(handler => handler(value));
        }

        // Also notify subscribers of parent paths
        const pathParts = path.split('.');
        while (pathParts.length > 0) {
            pathParts.pop();
            const parentPath = pathParts.join('.');

            if (parentPath && this._subscribers[parentPath]) {
                const parentValue = this.getState(parentPath);
                this._subscribers[parentPath].forEach(handler => handler(parentValue));
            }
        }
    }
};

export default stateService;

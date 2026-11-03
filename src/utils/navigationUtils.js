/**
 * Navigation and View Resolution Utilities
 * Handles URL query, hash, and anchor resolution for top-level application routing and help quick-jumps.
 */

const EVENT_CAPTURE_MOCKS = new Set(['active', 'pc-counter', 'armed']);

/**
 * Checks if routing parameters correspond to EventCapture view.
 *
 * @param {string|null} viewParam
 * @param {string} cleanHash
 * @param {string|null} mockParam
 * @param {boolean} isDevPreview
 * @returns {boolean}
 */
function isEventCaptureRoute(viewParam, cleanHash, mockParam, isDevPreview) {
    if (isDevPreview) return true;
    if (viewParam === 'event-capture' || cleanHash === 'event-capture') return true;
    return Boolean(mockParam && EVENT_CAPTURE_MOCKS.has(mockParam));
}

/**
 * Resolves the initial view name based on query params, URL hash, and pathname.
 *
 * @param {string} search - e.g. window.location.search
 * @param {string} [hash=''] - e.g. window.location.hash
 * @param {string} [pathname=''] - e.g. window.location.pathname
 * @returns {'Config' | 'Help' | 'EventCapture' | 'Log' | 'SavedGames'}
 */
export function resolveInitialView(search, hash = '', pathname = '') {
    const urlParams = new URLSearchParams(search);
    const viewParam = urlParams.get('view');
    const mockParam = urlParams.get('mock');
    const isDevPreview = pathname.includes('/dev/preview');
    const cleanHash = hash.replace(/^#/, '').split('?')[0].split('/')[0];

    if (viewParam === 'config' || cleanHash === 'configure') {
        return 'Config';
    }
    if (viewParam === 'help' || cleanHash === 'help') {
        return 'Help';
    }
    if (isEventCaptureRoute(viewParam, cleanHash, mockParam, isDevPreview)) {
        return 'EventCapture';
    }
    if (viewParam === 'log' || cleanHash === 'log') {
        return 'Log';
    }
    return 'SavedGames';
}

/**
 * Extracts element target ID from a hash or deep-link href.
 *
 * @param {string} href
 * @returns {string|null}
 */
export function parseHelpJumpTargetId(href) {
    if (!href || typeof href !== 'string' || !href.includes('#')) {
        return null;
    }
    const hashIndex = href.indexOf('#');
    const targetPart = href.substring(hashIndex + 1).split('?')[0];
    return targetPart.includes('/') ? targetPart.split('/')[1] : targetPart;
}

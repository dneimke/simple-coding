// Utility functions for the Field Hockey Event Tracker

/**
 * Formats time in milliseconds to a string in MM:SS format.
 * @param {number} timeMs - Time in milliseconds.
 * @returns {string} - Formatted time string.
 */
export function formatTime(timeMs) {
    const totalSeconds = Math.floor(timeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Escapes special characters in a string for XML.
 * @param {string} unsafe - The string to escape.
 * @returns {string} - Escaped string.
 */
export function escapeXml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe.replace(/[<>&'"/]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}

// formatter utility functions

/**
 * Formats milliseconds to a MM:SS time string
 * @param {number} milliseconds - Time in milliseconds
 * @returns {string} Formatted time string (MM:SS)
 */
export function formatTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Escapes special characters in XML content
 * @param {string} unsafe - The string to escape
 * @returns {string} Escaped string safe for XML
 */
export function escapeXml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe.replace(/[<>&'"]/g, function (c) {
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

/**
 * Logger utility for consistent console logging
 */
export const logger = {
    log: (message) => console.log(message),
    error: (message) => console.error(message),
    warn: (message) => console.warn(message),
};

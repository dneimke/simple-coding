// Game data utility functions
import { formatTime } from './formatUtils.js';

/**
 * Computes statistics from game events
 * @param {Array} gameEvents - Array of event objects
 * @returns {Object} Statistics object with event counts
 */
export const computeGameStatistics = (gameEvents) => {
    return gameEvents.reduce((stats, event) => {
        if (event && event.event) { // Ensure event and event.event are defined
            stats[event.event] = (stats[event.event] || 0) + 1;
        }
        return stats;
    }, {});
};

/**
 * Calculates time offset between video playhead and first match event.
 * Handles both positive shifts (video ahead) and negative shifts (video behind).
 *
 * @param {number} videoTimeSec - Current video playhead position in seconds
 * @param {number} eventTimeSec - Event timestamp in seconds
 * @returns {Object} Calculated offset details
 */
export function calculateVideoOffset(videoTimeSec, eventTimeSec) {
    const vSec = typeof videoTimeSec === 'number' && !isNaN(videoTimeSec) ? Math.max(0, videoTimeSec) : 0;
    const eSec = typeof eventTimeSec === 'number' && !isNaN(eventTimeSec) ? Math.max(0, eventTimeSec) : 0;
    const offsetSec = Math.round(vSec - eSec);
    const offsetMs = offsetSec * 1000;
    const sign = offsetSec >= 0 ? '+' : '-';
    const absSec = Math.abs(offsetSec);
    const m = Math.floor(absSec / 60);
    const s = Math.floor(absSec % 60);
    const formatted = `${sign}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return {
        offsetSec,
        offsetMs,
        formatted,
        isPositive: offsetSec >= 0
    };
}

/**
 * Shifts an array of event timestamps by offsetMs (can be positive or negative).
 * Timestamps that fall below 0ms are safely clamped to 0ms (00:00).
 *
 * @param {Array} events - Array of match event objects
 * @param {number} offsetMs - Milliseconds to shift (positive or negative)
 * @returns {Array} New array of shifted event objects
 */
export function shiftEventTimings(events, offsetMs) {
    if (!Array.isArray(events)) return [];
    const shift = typeof offsetMs === 'number' && !isNaN(offsetMs) ? offsetMs : 0;
    return events.map(evt => {
        const currentMs = typeof evt.timeMs === 'number' ? evt.timeMs : 0;
        const newMs = Math.max(0, currentMs + shift);
        return {
            ...evt,
            timeMs: newMs,
            timestamp: formatTime(newMs)
        };
    });
}

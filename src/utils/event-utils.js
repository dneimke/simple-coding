/**
 * Event utilities for standardized event model
 *
 * @typedef {Object} GameEvent
 * @property {string} event - Event type/code (e.g., "GOAL_FOR", "PRESS")
 * @property {number} timeMs - Time in milliseconds from game start
 */

/**
 * Creates a formatted time string from milliseconds
 * @param {number} timeMs - Time in milliseconds
 * @returns {string} Formatted time string (MM:SS)
 */
export function formatTimeFromMs(timeMs) {
    const totalSeconds = Math.floor(timeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Creates a sample GameEvent
 * @param {string} eventName - Name of the event
 * @param {number} minutes - Minutes into the game
 * @param {number} seconds - Seconds into the game
 * @returns {GameEvent} A sample event
 */
export function createSampleEvent(eventName, minutes, seconds = 0) {
    return {
        event: eventName,
        timeMs: ((minutes * 60) + seconds) * 1000
    };
}

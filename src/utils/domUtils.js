// DOM manipulation utility functions
import { escapeXml } from './formatUtils.js';
import { formatTime } from './formatUtils.js';

/**
 * Shows an element by setting display to inline-block
 * @param {HTMLElement} element - Element to show
 */
export const showElement = (element) => {
    element.style.display = 'inline-block';
};

/**
 * Hides an element by setting display to none
 * @param {HTMLElement} element - Element to hide
 */
export const hideElement = (element) => {
    element.style.display = 'none';
};

/**
 * Updates navbar visibility based on game state
 * @param {boolean} isVisible - Whether game-related buttons should be visible
 */
export function updateNavbarVisibility(isVisible) {
    const requiresGameButtons = document.querySelectorAll('[data-requires-game]');
    requiresGameButtons.forEach(button => {
        button.classList.toggle('hidden', !isVisible);
    });
}

/**
 * Adds visual feedback to buttons when clicked
 * @param {Array<HTMLElement>} buttons - Array of button elements
 */
export function addVisualFeedbackToButtons(buttons) {
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            button.classList.add('clicked');
            setTimeout(() => button.classList.remove('clicked'), 200);
        });
    });
}

/**
 * Creates a reusable button element with specified properties
 * @param {Object} options - Button options
 * @param {string} options.text - Button text
 * @param {string} options.className - CSS classes for the button
 * @param {Function} options.onClick - Click event handler
 * @param {string} [options.id=null] - Button ID (optional)
 * @returns {HTMLButtonElement} Created button element
 */
export const createButton = ({ text, className, onClick, id = null }) => {
    let button = id ? document.getElementById(id) : null;
    if (!button) {
        button = document.createElement('button');
        if (id) button.id = id;
    }
    button.className = className;
    button.textContent = text;
    if (onClick) {
        button.addEventListener('click', onClick);
    }
    return button;
};

/**
 * Creates a log entry element for displaying event information
 * @param {Object} options - Log entry options
 * @param {string} options.event - Event name
 * @param {number} options.time - Event time in milliseconds
 * @returns {HTMLDivElement} Created log entry element
 */
export function createLogEntry({ event, time }) {
    const logItem = document.createElement('div');
    logItem.className = 'event-log-item';
    logItem.innerHTML = `<span class="font-medium text-gray-700">${escapeXml(event)}</span> <span class="text-gray-500">${formatTime(time)}</span>`;
    return logItem;
}

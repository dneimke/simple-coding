/**
 * Log entry UI components
 * @module components/ui/log
 */
import { formatTime } from '../../utils/formatUtils.js';

/**
 * Creates a log entry element for displaying event information
 *
 * @param {Object} options - Log entry options
 * @param {string} options.event - Event name
 * @param {number} options.time - Event time in milliseconds
 * @param {boolean} [options.isSelected=false] - Whether the entry is selected
 * @param {Function} [options.onClick=null] - Click handler for the entry
 * @returns {HTMLDivElement} Created log entry element
 */
export const createLogEntry = ({
    event,
    time,
    isSelected = false,
    onClick = null
}) => {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry py-2 px-3 border-b border-gray-200 flex justify-between items-center transition-colors ${isSelected ? 'bg-blue-100' : 'hover:bg-gray-100'}`;

    if (onClick) {
        logEntry.style.cursor = 'pointer';
        logEntry.addEventListener('click', () => onClick({ event, time }));
    }

    const eventText = document.createElement('span');
    eventText.className = 'font-medium';
    eventText.textContent = event;

    const timeText = document.createElement('span');
    timeText.className = 'text-sm text-gray-600';
    timeText.textContent = formatTime(time);

    logEntry.appendChild(eventText);
    logEntry.appendChild(timeText);

    return logEntry;
};

/**
 * Creates a log container for multiple entries
 *
 * @param {Object} options - Log container options
 * @param {Array<{event: string, time: number}>} options.entries - Log entries
 * @param {string} [options.title="Event Log"] - Container title
 * @param {string} [options.emptyMessage="No events logged"] - Message when there are no entries
 * @param {boolean} [options.isScrollable=true] - Whether the container should be scrollable
 * @param {Function} [options.onEntryClick=null] - Click handler for entries
 * @returns {HTMLDivElement} Created log container element
 */
export const createLogContainer = ({
    entries,
    title = "Event Log",
    emptyMessage = "No events logged",
    isScrollable = true,
    onEntryClick = null
}) => {
    const container = document.createElement('div');
    container.className = 'border border-gray-300 rounded-md bg-white';

    // Add header
    const header = document.createElement('div');
    header.className = 'px-4 py-2 bg-gray-100 border-b border-gray-200';

    const titleElement = document.createElement('h3');
    titleElement.className = 'text-lg font-semibold text-gray-800';
    titleElement.textContent = title;
    header.appendChild(titleElement);

    container.appendChild(header);

    // Add entries container
    const entriesContainer = document.createElement('div');
    entriesContainer.className = isScrollable ? 'max-h-60 overflow-y-auto' : '';

    if (entries && entries.length > 0) {
        entries.forEach(entry => {
            const logEntryElement = createLogEntry({
                event: entry.event,
                time: entry.time,
                onClick: onEntryClick
            });
            entriesContainer.appendChild(logEntryElement);
        });
    } else {
        const emptyElement = document.createElement('div');
        emptyElement.className = 'py-4 text-center text-gray-500';
        emptyElement.textContent = emptyMessage;
        entriesContainer.appendChild(emptyElement);
    }

    container.appendChild(entriesContainer);

    return container;
};

import { formatTimeFromMs } from '../utils/event-utils.js';

/**
 * Renders timeline events into a specified container, sorted by time with earliest events at the top.
 * @param {Array<object>} events - Array of standardized event objects { event, timeMs }
 * @param {string} containerId - The ID of the HTML element to render into.
 */
export function renderTimeline(events, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Timeline container with ID "${containerId}" not found.`);
        return;
    }    // Clear existing content
    container.innerHTML = '';

    // Sort events by timeMs (earliest first for display)
    const sortedEvents = [...events].sort((a, b) => a.timeMs - b.timeMs);

    if (sortedEvents.length === 0) {
        container.innerHTML = '<p class="text-gray-500 italic">No events yet.</p>';
        return;
    }    // Create and append event elements
    sortedEvents.forEach(event => {
        const eventElement = document.createElement('div');
        eventElement.className = 'mb-4 p-3 bg-blue-50 rounded border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors duration-150';
        // Add data attribute for potential interaction (e.g., seeking video)
        eventElement.setAttribute('data-time-ms', event.timeMs);

        // Format the time nicely (MM:SS)
        const timeFormatted = formatTimeFromMs(event.timeMs);

        eventElement.innerHTML = `
            <p class="font-medium text-sm text-blue-800">${timeFormatted} - ${event.event}</p>
        `;
        container.appendChild(eventElement);

        // Add event listener for timeline interaction
        eventElement.addEventListener('click', () => {
            // Calculate seconds for video seeking
            const seekTime = event.timeMs / 1000;

            console.log(`Event clicked: ${event.event} at ${seekTime} seconds`);            // Dispatch a custom event that our main script can listen for
            const timelineClickEvent = new CustomEvent('timeline-event-clicked', {
                detail: {
                    event: event.event,
                    seekTime: seekTime
                }
            });
            document.dispatchEvent(timelineClickEvent);
        });
    });
}

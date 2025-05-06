/**
 * Renders timeline events into a specified container.
 * @param {Array<object>} events - Array of event objects { timestamp, title, description }
 * @param {string} containerId - The ID of the HTML element to render into.
 */
export function renderTimeline(events, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Timeline container with ID "${containerId}" not found.`);
        return;
    }

    // Clear existing content
    container.innerHTML = '';

    // Sort events (assuming timestamps are ISO strings or Date objects)
    // Sort descending to show newest first, or ascending for oldest first
    const sortedEvents = [...events].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (sortedEvents.length === 0) {
        container.innerHTML = '<p class="text-gray-500 italic">No events yet.</p>';
        return;
    }

    // Create and append event elements
    sortedEvents.forEach(event => {
        const eventElement = document.createElement('div');
        eventElement.className = 'mb-4 p-3 bg-blue-50 rounded border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors duration-150'; // Added cursor/hover
        // Add data attribute for potential interaction (e.g., seeking video)
        // Convert timestamp to seconds or a suitable format if needed for video seeking
        // eventElement.dataset.timestamp = new Date(event.timestamp).getTime() / 1000;

        const time = new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        eventElement.innerHTML = `
            <p class="font-medium text-sm text-blue-800">${time} - ${event.title}</p>
            <p class="text-xs text-gray-600">${event.description}</p>
        `;
        container.appendChild(eventElement);        // Add event listener for timeline interaction
        eventElement.addEventListener('click', () => {
            console.log(`Event clicked: ${event.title} at ${event.timestamp}`);

            // Calculate timestamp in seconds for video seeking
            const timestampInSeconds = Math.floor((new Date(event.timestamp).getTime() - new Date(sortedEvents[sortedEvents.length - 1].timestamp).getTime()) / 1000);

            // Dispatch a custom event that our main script can listen for
            const timelineClickEvent = new CustomEvent('timeline-event-clicked', {
                detail: {
                    title: event.title,
                    timestamp: event.timestamp,
                    description: event.description,
                    seekTime: timestampInSeconds > 0 ? timestampInSeconds : 0
                }
            });
            document.dispatchEvent(timelineClickEvent);
        });
    });
}

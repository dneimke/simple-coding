import { escapeXml, computeGameStatistics } from '../utils/utils.js';

export class EventLog {
    constructor(timelineContainer, xmlContainer, statisticsContainer) {
        this.statisticsContainer = statisticsContainer;
        this.timelineContainer = timelineContainer;
        this.xmlContainer = xmlContainer;
    }

    render(events) {
        const logIsEmpty = events.length === 0;

        if (logIsEmpty) {
            this.statisticsContainer.innerHTML = '<p class="text-gray-500 text-center">No statistics available.</p>';
            this.timelineContainer.innerHTML = '<p class="text-gray-500 text-center">No events recorded yet.</p>';
            this.xmlContainer.innerHTML = '<p class="text-gray-500 text-center">No events recorded yet.</p>';
            return;
        }

        this.renderTimeline(events);

        let styledXmlString = '';
        events.forEach((logEntry, index) => {
            const eventTimeSeconds = Math.floor(logEntry.timeMs / 1000);
            const startSeconds = Math.max(0, eventTimeSeconds - 5);
            const endSeconds = eventTimeSeconds + 5;
            const eventCode = escapeXml(logEntry.event);
            styledXmlString += `<span class="xml-tag">&lt;instance&gt;</span><span class="xml-tag">&lt;ID&gt;</span><span class="xml-text">${index + 1}</span><span class="xml-tag">&lt;/ID&gt;</span><span class="xml-tag">&lt;start&gt;</span><span class="xml-text">${startSeconds}</span><span class="xml-tag">&lt;/start&gt;</span><span class="xml-tag">&lt;end&gt;</span><span class="xml-text">${endSeconds}</span><span class="xml-tag">&lt;/end&gt;</span><span class="xml-tag">&lt;code&gt;</span><span class="xml-text">${eventCode}</span><span class="xml-tag">&lt;/code&gt;</span><span class="xml-tag">&lt;/instance&gt;</span>\n`;
        });
        this.xmlContainer.innerHTML = styledXmlString;

        // Render statistics
        this.statisticsContainer.innerHTML = '';

        let gameStatistics = computeGameStatistics(events);

        if (Object.keys(gameStatistics).length === 0) {
            this.statisticsContainer.innerHTML = '<p class="text-gray-500 text-center">No statistics available.</p>';
            return;
        }

        const gameStatisticsEntries = Object.entries(gameStatistics); // Convert object to array of [key, value] pairs

        this.statisticsContainer.innerHTML = gameStatisticsEntries
            .sort(([eventA], [eventB]) => eventA.localeCompare(eventB)) // Sort alphabetically by event name
            .map(([event, count]) => {
                return `
        <div class="event-log-item">
            <span>${event}</span>
            <span>${count}</span>
        </div>
        `;
            })
            .join('');
    }

    renderTimeline(events) {
        // Clear the timeline container
        this.timelineContainer.innerHTML = '';

        // Group events by type
        const eventsByType = events.reduce((acc, event) => {
            if (!acc[event.event]) acc[event.event] = [];
            acc[event.event].push(event);
            return acc;
        }, {});

        // Get the earliest and latest timestamps for scaling
        const allTimestamps = events.map(event => event.timeMs);
        const minTime = Math.min(...allTimestamps);
        const maxTime = Math.max(...allTimestamps);

        // Define a consistent starting point for event markers
        const markerStartOffset = 150; // Adjust this value as needed for spacing after row headings

        // Create a row for each event type
        Object.entries(eventsByType)
            .sort(([eventTypeA], [eventTypeB]) => eventTypeA.localeCompare(eventTypeB)) // Sort alphabetically by eventType
            .forEach(([eventType, eventList]) => {
                // Create a row container
                const row = document.createElement('div');
                row.className = 'relative h-8 border-b border-gray-300 flex items-center';

                // Add a label for the event type
                const label = document.createElement('span');
                label.className = 'absolute left-0 top-1/2 transform -translate-y-1/2 text-sm text-gray-600 w-[140px] truncate';
                label.textContent = eventType;
                row.appendChild(label);

                // Add event markers to the row
                eventList.forEach(event => {
                    const marker = document.createElement('div');
                    marker.className = 'absolute w-2 h-2 bg-blue-500 rounded-full';

                    // Calculate position as a percentage of the timeline width
                    const positionPercent = ((event.timeMs - minTime) / (maxTime - minTime)) * 100;
                    marker.style.left = `calc(${markerStartOffset}px + ${positionPercent}%)`;

                    // Add tooltip for event time
                    const hours = Math.floor(event.timeMs / 3600000).toString().padStart(2, '0');
                    const minutes = Math.floor((event.timeMs % 3600000) / 60000).toString().padStart(2, '0');
                    const seconds = Math.floor((event.timeMs % 60000) / 1000).toString().padStart(2, '0');
                    marker.title = `${hours}:${minutes}:${seconds}`;

                    row.appendChild(marker);
                });

                this.timelineContainer.appendChild(row);
            });
    }
}
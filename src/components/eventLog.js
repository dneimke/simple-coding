import { escapeXml } from '../utils/formatUtils.js';
import { computeGameStatistics } from '../utils/gameUtils.js';
import { createLogEntry, createLogContainer } from './ui/index.js';
import { generateSportscodeXml } from '../utils/xmlUtils.js';

// The rendered textContent must equal the XML string so Copy XML yields a valid document.
const highlightXml = (xml) => xml
    .split(/(<[^>]+>)/)
    .map(token => {
        if (!token) return '';
        if (token.startsWith('<')) return `<span class="xml-tag">${escapeXml(token)}</span>`;
        if (!token.trim()) return token;
        return `<span class="xml-text">${escapeXml(token)}</span>`;
    })
    .join('');

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

        this.xmlContainer.innerHTML = highlightXml(generateSportscodeXml(events));

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
    } renderTimeline(events) {
        // Clear the timeline container
        this.timelineContainer.innerHTML = '';

        // For simple views, we could use our new createLogContainer component
        // For now, we'll keep the custom timeline visualization logic as is

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
                row.className = 'relative h-8 bg-white flex items-center';

                // Add a label for the event type
                const label = document.createElement('span');
                // Apply sticky positioning and background - rely on parent's flex items-center for vertical alignment
                // Added bg-white back to ensure label covers markers behind it.
                label.className = 'sticky left-0 text-sm text-gray-600 w-[140px] truncate bg-white z-10 p-2';
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
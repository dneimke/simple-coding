import { escapeXml } from '../utils/utils.js';

export class EventLog {
    constructor(listContainer, xmlContainer) {
        this.listContainer = listContainer;
        this.xmlContainer = xmlContainer;
    }

    render(events) {
        const logIsEmpty = events.length === 0;

        if (logIsEmpty) {
            this.listContainer.innerHTML = '<p class="text-gray-500 text-center">No events recorded yet.</p>';
            this.xmlContainer.innerHTML = '<p class="text-gray-500 text-center">No events recorded yet.</p>';
            return;
        }

        this.listContainer.innerHTML = events
            .sort((a, b) => b.timeMs - a.timeMs) // Sort events by timeMs in descending order
            .map(event => {
                const eventTime = new Date(event.timeMs).toISOString().slice(11, 19);
                return `
                <div class="event-log-item">
                    <span>${event.event}</span>
                    <span>${eventTime}</span>
                </div>
            `;
            }).join('');

        let styledXmlString = '';
        events.forEach((logEntry, index) => {
            const eventTimeSeconds = Math.floor(logEntry.timeMs / 1000);
            const startSeconds = Math.max(0, eventTimeSeconds - 5);
            const endSeconds = eventTimeSeconds + 5;
            const eventCode = escapeXml(logEntry.event);
            styledXmlString += `<span class="xml-tag">&lt;instance&gt;</span><span class="xml-tag">&lt;ID&gt;</span><span class="xml-text">${index + 1}</span><span class="xml-tag">&lt;/ID&gt;</span><span class="xml-tag">&lt;start&gt;</span><span class="xml-text">${startSeconds}</span><span class="xml-tag">&lt;/start&gt;</span><span class="xml-tag">&lt;end&gt;</span><span class="xml-text">${endSeconds}</span><span class="xml-tag">&lt;/end&gt;</span><span class="xml-tag">&lt;code&gt;</span><span class="xml-text">${eventCode}</span><span class="xml-tag">&lt;/code&gt;</span><span class="xml-tag">&lt;/instance&gt;</span>\n`;
        });
        this.xmlContainer.innerHTML = styledXmlString;
    }
}
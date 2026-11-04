import { escapeXml } from '../utils/formatUtils.js';
import { computeGameStatistics } from '../utils/gameUtils.js';
import { generateSportscodeXml } from '../utils/xmlUtils.js';

export const XML_HIGHLIGHT_MAX_EVENTS = 150;

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
        this._events = [];
        this._dirty = {
            timelineView: false,
            xmlView: false,
            statisticsView: false
        };
    }

    /**
     * Render log sub-tabs. When activeTab is omitted, renders all sub-tabs immediately.
     * When activeTab is provided, renders only that tab and marks the others dirty for on-demand renderTab().
     * @param {Array} events
     * @param {{activeTab?: string|null}} [options]
     */
    render(events = [], { activeTab = null } = {}) {
        this._events = Array.isArray(events) ? events : [];
        const logIsEmpty = this._events.length === 0;

        if (logIsEmpty) {
            this.statisticsContainer.innerHTML = '<p class="text-gray-500 text-center">No statistics available.</p>';
            this.timelineContainer.innerHTML = '<p class="text-gray-500 text-center">No events recorded yet.</p>';
            this.xmlContainer.innerHTML = '<p class="text-gray-500 text-center">No events recorded yet.</p>';
            this._dirty.timelineView = false;
            this._dirty.xmlView = false;
            this._dirty.statisticsView = false;
            return;
        }

        this._dirty.timelineView = true;
        this._dirty.xmlView = true;
        this._dirty.statisticsView = true;

        if (!activeTab) {
            this.renderTab('timelineView');
            this.renderTab('xmlView');
            this.renderTab('statisticsView');
            return;
        }

        this.renderTab(activeTab);
    }

    /**
     * Render a specific log sub-tab on demand if dirty.
     * @param {string} tabName - 'timelineView' | 'xmlView' | 'statisticsView' | 'recentView'
     */
    renderTab(tabName) {
        if (!this._events || this._events.length === 0) return;

        if (tabName === 'timelineView' && this._dirty.timelineView) {
            this.renderTimeline(this._events);
            this._dirty.timelineView = false;
        } else if (tabName === 'xmlView' && this._dirty.xmlView) {
            this.renderXml(this._events);
            this._dirty.xmlView = false;
        } else if (tabName === 'statisticsView' && this._dirty.statisticsView) {
            this.renderStatistics(this._events);
            this._dirty.statisticsView = false;
        }
    }

    /**
     * Ensure XML container is up to date and return the valid Sportscode XML string.
     * @returns {string}
     */
    getXmlText() {
        this.renderTab('xmlView');
        return this.xmlContainer ? this.xmlContainer.textContent : '';
    }

    renderXml(events) {
        const xml = generateSportscodeXml(events);
        if (events.length > XML_HIGHLIGHT_MAX_EVENTS) {
            this.xmlContainer.textContent = xml;
            return;
        }
        this.xmlContainer.innerHTML = highlightXml(xml);
    }

    renderStatistics(events) {
        this.statisticsContainer.innerHTML = '';

        const gameStatistics = computeGameStatistics(events);

        if (Object.keys(gameStatistics).length === 0) {
            this.statisticsContainer.innerHTML = '<p class="text-gray-500 text-center">No statistics available.</p>';
            return;
        }

        const gameStatisticsEntries = Object.entries(gameStatistics);

        this.statisticsContainer.innerHTML = gameStatisticsEntries
            .sort(([eventA], [eventB]) => eventA.localeCompare(eventB))
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
        this.timelineContainer.innerHTML = '';

        const eventsByType = events.reduce((acc, event) => {
            if (!acc[event.event]) acc[event.event] = [];
            acc[event.event].push(event);
            return acc;
        }, {});

        const allTimestamps = events.map(event => event.timeMs);
        const minTime = Math.min(...allTimestamps);
        const maxTime = Math.max(...allTimestamps);
        const timeRange = maxTime - minTime;

        const markerStartOffset = 150;

        Object.entries(eventsByType)
            .sort(([eventTypeA], [eventTypeB]) => eventTypeA.localeCompare(eventTypeB))
            .forEach(([eventType, eventList]) => {
                const row = document.createElement('div');
                row.className = 'relative h-8 bg-white flex items-center';

                const label = document.createElement('span');
                label.className = 'sticky left-0 text-sm text-gray-600 w-[140px] truncate bg-white z-10 p-2';
                label.textContent = eventType;
                row.appendChild(label);

                eventList.forEach(event => {
                    const marker = document.createElement('div');
                    marker.className = 'absolute w-2 h-2 bg-blue-500 rounded-full';

                    const positionPercent = timeRange > 0 ? ((event.timeMs - minTime) / timeRange) * 100 : 0;
                    marker.style.left = `calc(${markerStartOffset}px + ${positionPercent}%)`;

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

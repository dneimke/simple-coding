/**
 * Tests for the EventLog XML View and lazy per-tab rendering
 */
import { EventLog, XML_HIGHLIGHT_MAX_EVENTS } from '../../src/components/eventLog.js';
import { generateSportscodeXml } from '../../src/utils/xmlUtils.js';

describe('EventLog XML View', () => {
    let timelineContainer;
    let xmlContainer;
    let statisticsContainer;
    let eventLog;

    beforeEach(() => {
        timelineContainer = document.createElement('div');
        xmlContainer = document.createElement('div');
        statisticsContainer = document.createElement('div');
        eventLog = new EventLog(timelineContainer, xmlContainer, statisticsContainer);
    });

    test('renders the full Sportscode document so its text is valid XML', () => {
        const events = [
            { event: 'GOAL_FOR', timeMs: 60000 },
            { event: 'A & B', timeMs: 120000 }
        ];

        eventLog.render(events);

        expect(xmlContainer.textContent).toBe(generateSportscodeXml(events));
        expect(xmlContainer.querySelector('.xml-tag')).not.toBeNull();
        expect(xmlContainer.querySelector('.xml-text')).not.toBeNull();
    });

    test('shows a placeholder when there are no events', () => {
        eventLog.render([]);
        expect(xmlContainer.textContent).toBe('No events recorded yet.');
    });

    test('renders only the requested activeTab when activeTab option is provided, and renders other tabs lazily on renderTab()', () => {
        const events = [
            { event: 'FIRE CE', timeMs: 45000 },
            { event: 'FIRE GOAL', timeMs: 90000 }
        ];

        // When opening #log on the Recent tab, timeline/xml/statistics are deferred
        eventLog.render(events, { activeTab: 'recentView' });
        expect(timelineContainer.innerHTML).toBe('');
        expect(xmlContainer.innerHTML).toBe('');
        expect(statisticsContainer.innerHTML).toBe('');

        // Switching to statisticsView renders only statistics
        eventLog.renderTab('statisticsView');
        expect(statisticsContainer.textContent).toContain('FIRE CE');
        expect(timelineContainer.innerHTML).toBe('');
        expect(xmlContainer.innerHTML).toBe('');

        // Switching to timelineView renders timeline
        eventLog.renderTab('timelineView');
        expect(timelineContainer.children.length).toBe(2);
        expect(xmlContainer.innerHTML).toBe('');

        // getXmlText() or switching to xmlView renders XML on demand
        expect(eventLog.getXmlText()).toBe(generateSportscodeXml(events));
        expect(xmlContainer.textContent).toBe(generateSportscodeXml(events));
    });

    test('falls back to fast plain-text XML rendering without span explosion above XML_HIGHLIGHT_MAX_EVENTS', () => {
        const count = (XML_HIGHLIGHT_MAX_EVENTS || 150) + 25;
        const events = Array.from({ length: count }, (_, idx) => ({
            event: idx % 2 === 0 ? 'FIRE BS1' : 'TIGERS CE2',
            timeMs: (idx + 1) * 3000
        }));

        eventLog.render(events);

        expect(xmlContainer.textContent).toBe(generateSportscodeXml(events));
        expect(xmlContainer.querySelectorAll('span').length).toBe(0);
    });
});

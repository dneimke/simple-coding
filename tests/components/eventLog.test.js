/**
 * Tests for the EventLog XML View
 */
import { EventLog } from '../../src/components/eventLog.js';
import { generateSportscodeXml } from '../../src/utils/xmlUtils.js';

describe('EventLog XML View', () => {
    let xmlContainer;
    let eventLog;

    beforeEach(() => {
        xmlContainer = document.createElement('div');
        eventLog = new EventLog(document.createElement('div'), xmlContainer, document.createElement('div'));
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
});

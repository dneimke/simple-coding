import { parseXmlToEvents, validateXmlStructure } from '../../src/utils/xmlUtils.js';
import { computeGameStatistics } from '../../src/utils/gameUtils.js';

// Mock DOM elements for tests
beforeEach(() => {
    document.body.innerHTML = `
    <div>
      <button id="importXmlButton">Import XML</button>
      <input id="xmlFileInput" type="file" class="hidden" />
    </div>
  `;
});

describe('sanityTests', () => {
    test('should succeed', () => {
        expect(true).toBe(true);
    });
});

describe('parseXmlToEvents', () => {
    test('should parse valid XML content into an array of events with event and timeMs', () => {
        const xmlContent = `
      <instances>
        <instance><ID>1</ID><start>0</start><end>10</end><code>PRESS</code></instance>
        <instance><ID>2</ID><start>1</start><end>11</end><code>PRESS</code></instance>
        <instance><ID>3</ID><start>2</start><end>12</end><code>OUTLET</code></instance>
      </instances>
    `;
        const events = parseXmlToEvents(xmlContent);
        expect(events).toEqual([
            { event: 'PRESS', timeMs: 5000 },
            { event: 'PRESS', timeMs: 6000 },
            { event: 'OUTLET', timeMs: 7000 },
        ]);
    });

    test('should return an empty array for XML with no instances', () => {
        const xmlContent = '<instances></instances>';
        const events = parseXmlToEvents(xmlContent);
        expect(events).toEqual([]);
    });
});

describe('validateXmlStructure', () => {
    test('should throw an error for invalid XML format', () => {
        const invalidXml = '<instances><instance><ID>1</ID><start>0</start><end>10</end><code>PRESS</code></instance></instances';
        expect(() => validateXmlStructure(invalidXml)).toThrow('Invalid XML format.');
    }); test('should throw an error if no events or instances are found', () => {
        const noInstancesXml = '<instances></instances>';
        expect(() => validateXmlStructure(noInstancesXml)).toThrow('No events or instances found in the XML file.');
    });

    test('should throw an error for invalid instance data', () => {
        const invalidInstanceXml = '<instances><instance><ID>1</ID><start>0</start><end></end><code>PRESS</code></instance></instances>';
        expect(() => validateXmlStructure(invalidInstanceXml)).toThrow('Invalid instance data in XML.');
    });

    test('should return the XML document for valid XML', () => {
        const validXml = '<instances><instance><ID>1</ID><start>0</start><end>10</end><code>PRESS</code></instance></instances>';
        const xmlDoc = validateXmlStructure(validXml);
        expect(xmlDoc).toBeInstanceOf(Document);
    });
});

describe('computeGameStatistics', () => {
    test('computes statistics for unique event types', () => {
        const currentGame = { loggedEvents: [{ event: 'goal' }, { event: 'foul' }] };
        const result = computeGameStatistics(currentGame.loggedEvents);
        expect(result).toEqual({ goal: 1, foul: 1 });
    });

    test('aggregates counts for repeated event types', () => {
        const currentGame = { loggedEvents: [{ event: 'goal' }, { event: 'goal' }, { event: 'foul' }] };
        const result = computeGameStatistics(currentGame.loggedEvents);
        expect(result).toEqual({ goal: 2, foul: 1 });
    });

    test('handles an empty loggedEvents array', () => {
        const currentGame = { loggedEvents: [] };
        const result = computeGameStatistics(currentGame.loggedEvents);
        expect(result).toEqual({});
    });

    test('handles a single event', () => {
        const currentGame = { loggedEvents: [{ event: 'goal' }] };
        const result = computeGameStatistics(currentGame.loggedEvents);
        expect(result).toEqual({ goal: 1 });
    });

    test('ignores events with undefined event properties', () => {
        const currentGame = { loggedEvents: [{ event: 'goal' }, { event: undefined }, { event: 'foul' }] };
        const result = computeGameStatistics(currentGame.loggedEvents);
        expect(result).toEqual({ goal: 1, foul: 1 });
    });

    test('handles a large number of events', () => {
        const currentGame = { loggedEvents: Array(1000).fill({ event: 'goal' }) };
        const result = computeGameStatistics(currentGame.loggedEvents);
        expect(result).toEqual({ goal: 1000 });
    });
});

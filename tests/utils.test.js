import { parseXmlToEvents, validateXmlStructure } from '../utils.js';

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
    test('should parse valid XML content into an array of events', () => {
        const xmlContent = `
      <game>
        <event name="GOAL FOR" timeMs="120000" />
        <event name="SHOT FOR" timeMs="180000" />
      </game>
    `;
        const events = parseXmlToEvents(xmlContent);
        expect(events).toEqual([
            { event: 'GOAL FOR', timeMs: 120000 },
            { event: 'SHOT FOR', timeMs: 180000 },
        ]);
    });

    test('should return an empty array for XML with no events', () => {
        const xmlContent = '<game></game>';
        const events = parseXmlToEvents(xmlContent);
        expect(events).toEqual([]);
    });
});

describe('validateXmlStructure', () => {
    test('should throw an error for invalid XML format', () => {
        const invalidXml = '<game><event name="GOAL FOR" timeMs="120000"></game>';
        expect(() => validateXmlStructure(invalidXml)).toThrow('Invalid XML format.');
    });

    test('should throw an error if no events are found', () => {
        const noEventsXml = '<game></game>';
        expect(() => validateXmlStructure(noEventsXml)).toThrow('No events found in the XML file.');
    });

    test('should throw an error for invalid event data', () => {
        const invalidEventXml = '<game><event name="GOAL FOR" /></game>';
        expect(() => validateXmlStructure(invalidEventXml)).toThrow('Invalid event data in XML.');
    });

    test('should return the XML document for valid XML', () => {
        const validXml = '<game><event name="GOAL FOR" timeMs="120000" /></game>';
        const xmlDoc = validateXmlStructure(validXml);
        expect(xmlDoc).toBeInstanceOf(Document);
    });
});

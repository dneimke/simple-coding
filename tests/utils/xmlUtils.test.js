/**
 * Tests for xmlUtils.js functionality
 */
import {
    parseXmlToEvents,
    validateXmlStructure,
    generateGameXml,
    generateSportscodeXml
} from '../../src/utils/xmlUtils.js';

jest.mock('../../src/utils/formatUtils.js', () => ({
    ...jest.requireActual('../../src/utils/formatUtils.js'),
    logger: {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

jest.mock('../../src/services/notificationService.js', () => ({
    notificationService: {
        notify: jest.fn()
    }
}));

const parse = (xml) => new DOMParser().parseFromString(xml, 'application/xml');
const texts = (doc, selector) => Array.from(doc.querySelectorAll(selector)).map(n => n.textContent);

const USER_EXAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<file>
  <ALL_INSTANCES>
    <instance>
      <ID>1</ID>
      <start>142.50</start>
      <end>150.25</end>
      <code_id>10</code_id>
      <code>Shot on Target</code>
      <label>
        <group>Player</group>
        <text>Striker 9</text>
      </label>
      <label>
        <group>Outcome</group>
        <text>Saved</text>
      </label>
    </instance>
  </ALL_INSTANCES>
  <ROWS>
    <row>
      <id>10</id>
      <name>Shot on Target</name>
    </row>
  </ROWS>
</file>`;

const sportscodeWithInstance = (instanceXml, rowsXml = '<row><id>1</id><name>GOAL_FOR</name></row>') =>
    `<?xml version="1.0" encoding="utf-8"?><file><ALL_INSTANCES>${instanceXml}</ALL_INSTANCES><ROWS>${rowsXml}</ROWS></file>`;

describe('XML Utils', () => {
    describe('generateSportscodeXml', () => {
        const events = [
            { event: 'GOAL_FOR', timeMs: 60000 },
            { event: 'FOUL', timeMs: 120500 },
            { event: 'GOAL_FOR', timeMs: 180000 }
        ];

        test('produces a complete, well-formed Sportscode document', () => {
            const xml = generateSportscodeXml(events);
            expect(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>')).toBe(true);

            const doc = parse(xml);
            expect(doc.querySelector('parsererror')).toBeNull();
            expect(doc.documentElement.nodeName).toBe('file');
            expect(doc.querySelectorAll('file > ALL_INSTANCES > instance')).toHaveLength(3);
            expect(doc.querySelectorAll('file > ROWS > row')).toHaveLength(2);
        });

        test('assigns code_id values that match row ids, sharing rows for repeated codes', () => {
            const doc = parse(generateSportscodeXml(events));
            expect(texts(doc, 'instance > ID')).toEqual(['1', '2', '3']);
            expect(texts(doc, 'instance > code_id')).toEqual(['1', '2', '1']);
            expect(texts(doc, 'row > id')).toEqual(['1', '2']);
            expect(texts(doc, 'row > name')).toEqual(['GOAL_FOR', 'FOUL']);
        });

        test('writes clip windows in seconds with 2 decimals, clamping start at 0', () => {
            const doc = parse(generateSportscodeXml([...events, { event: 'KICKOFF', timeMs: 2000 }]));
            expect(texts(doc, 'instance > start')).toEqual(['55.00', '115.50', '175.00', '0.00']);
            expect(texts(doc, 'instance > end')).toEqual(['65.00', '125.50', '185.00', '7.00']);
        });

        test('uses per-event lead and lag, falling back to 5 seconds for missing values', () => {
            const doc = parse(generateSportscodeXml([
                { event: 'PC', timeMs: 100000, lead: 2, lag: 10 },
                { event: 'ASC', timeMs: 100000, lead: 10 },
                { event: 'SHOT', timeMs: 100000, lag: 0 },
                { event: 'GOAL', timeMs: 100000 }
            ]));
            expect(texts(doc, 'instance > start')).toEqual(['98.00', '90.00', '95.00', '95.00']);
            expect(texts(doc, 'instance > end')).toEqual(['110.00', '105.00', '100.00', '105.00']);
        });

        test('clamps start at 0 when the lead reaches before the start of the video', () => {
            const doc = parse(generateSportscodeXml([{ event: 'START', timeMs: 4000, lead: 15, lag: 5 }]));
            expect(texts(doc, 'instance > start')).toEqual(['0.00']);
            expect(texts(doc, 'instance > end')).toEqual(['9.00']);
        });

        test('escapes special characters in codes', () => {
            const xml = generateSportscodeXml([{ event: 'A & B <C>', timeMs: 10000 }]);
            expect(xml).toContain('<code>A &amp; B &lt;C&gt;</code>');
            expect(xml).toContain('<name>A &amp; B &lt;C&gt;</name>');
            expect(texts(parse(xml), 'instance > code')).toEqual(['A & B <C>']);
        });

        test('skips invalid events and produces empty sections when there are none', () => {
            const xml = generateSportscodeXml([{ event: '', timeMs: 1000 }, { event: 'X', timeMs: NaN }]);
            expect(xml).toContain('<ALL_INSTANCES />');
            expect(xml).toContain('<ROWS />');
            expect(parse(xml).querySelector('parsererror')).toBeNull();
        });

        test('does not write labels, teams, date or favourite', () => {
            const xml = generateGameXml({
                teams: 'Team A vs Team B',
                timestamp: '2025-05-10T12:00:00Z',
                events: [{ event: 'GOAL_FOR', timeMs: 60000, favourite: true }]
            }, 1);
            expect(xml).not.toMatch(/label|Team A|2025-05-10|favourite/);
        });
    });

    describe('generateGameXml', () => {
        test('returns the Sportscode document for the game events', () => {
            const game = { events: [{ event: 'GOAL_FOR', timeMs: 60000 }] };
            expect(generateGameXml(game, 1)).toBe(generateSportscodeXml(game.events));
        });
    });

    describe('parseXmlToEvents', () => {
        test('parses the Sportscode example, keeping decimal times and labels', () => {
            const events = parseXmlToEvents(USER_EXAMPLE);
            expect(events).toEqual([{
                event: 'Shot on Target',
                timeMs: 146375,
                lead: 3.875,
                lag: 3.875,
                labels: [
                    { group: 'Player', text: 'Striker 9' },
                    { group: 'Outcome', text: 'Saved' }
                ]
            }]);
            expect(events.teamsAttribute).toBeUndefined();
        });

        test('exports explicit and derived labels to Sportscode XML', () => {
            const events = [
                { id: '1', event: 'FIRE BW 1', team: 'FIRE', timeMs: 50000 },
                {
                    id: '2',
                    event: 'FIRE CE',
                    team: 'FIRE',
                    timeMs: 56000,
                    labels: [{ group: 'Channel', text: 'Left' }]
                }
            ];
            const xml = generateSportscodeXml(events);
            const doc = parse(xml);
            const instances = doc.querySelectorAll('instance');
            expect(instances).toHaveLength(2);

            const ceLabels = Array.from(instances[1].querySelectorAll('label')).map(l => ({
                group: l.querySelector('group')?.textContent,
                text: l.querySelector('text')?.textContent
            }));

            expect(ceLabels).toEqual([
                { group: 'Channel', text: 'Left' },
                { group: 'Origin', text: 'Counter' }
            ]);
        });

        test('round-trips events through export and import', () => {
            const events = [
                { event: 'KICKOFF', timeMs: 0 },
                { event: 'EARLY', timeMs: 3000 },
                { event: 'GOAL_FOR', timeMs: 60000 },
                { event: 'A & B', timeMs: 125250 }
            ];
            const xml = generateSportscodeXml(events);
            expect(() => validateXmlStructure(xml)).not.toThrow();
            expect(parseXmlToEvents(xml)).toEqual(events);
        });

        test('re-exporting imported uneven clips reproduces the same start and end', () => {
            const xml = generateSportscodeXml([
                { event: 'BLAZE PC', timeMs: 111140, lead: 2, lag: 10 },
                { event: 'BLAZE SHOT', timeMs: 1667910, lead: 15, lag: 5 },
                { event: 'BLAZE ASC', timeMs: 60620, lead: 10, lag: 1 },
                { event: 'START', timeMs: 20340, lead: 1, lag: 1 }
            ]);
            const imported = parseXmlToEvents(xml);
            const doc = parse(generateSportscodeXml(imported));

            expect(texts(doc, 'instance > start')).toEqual(['109.14', '1652.91', '50.62', '19.34']);
            expect(texts(doc, 'instance > end')).toEqual(['121.14', '1672.91', '61.62', '21.34']);
            expect(generateSportscodeXml(imported)).toBe(xml);
        });

        test('parses legacy <game> format with teams and favourites', () => {
            const events = parseXmlToEvents(`<?xml version="1.0" encoding="UTF-8"?>
                <game date="2025-05-10" teams="Team A vs Team B">
                    <events>
                        <event event="GOAL_FOR" timeMs="60000" favourite="true" />
                        <event event="FOUL" timeMs="120000" />
                    </events>
                </game>`);

            expect([...events]).toEqual([
                { event: 'GOAL_FOR', timeMs: 60000, favourite: true },
                { event: 'FOUL', timeMs: 120000 }
            ]);
            expect(events.teamsAttribute).toBe('Team A vs Team B');
        });

        test('parses loose <instance> elements without a <file> root', () => {
            const events = parseXmlToEvents(
                '<root><instance><ID>1</ID><start>55</start><end>65</end><code>GOAL_FOR</code></instance></root>'
            );
            expect(events).toEqual([{ event: 'GOAL_FOR', timeMs: 60000 }]);
        });
    });

    describe('validateXmlStructure', () => {
        test('accepts the Sportscode example', () => {
            expect(() => validateXmlStructure(USER_EXAMPLE)).not.toThrow();
        });

        test('accepts legacy <game> format', () => {
            expect(() => validateXmlStructure(
                '<game teams="A vs B"><events><event event="GOAL_FOR" timeMs="60000" /></events></game>'
            )).not.toThrow();
        });

        test('throws for malformed XML', () => {
            expect(() => validateXmlStructure('<file><ALL_INSTANCES>')).toThrow('Invalid XML format.');
        });

        test('throws when a Sportscode file has no instances', () => {
            expect(() => validateXmlStructure(sportscodeWithInstance(''))).toThrow('No instances found');
        });

        test('throws when an instance is missing required fields', () => {
            expect(() => validateXmlStructure(sportscodeWithInstance(
                '<instance><ID>1</ID><start>1</start><end>2</end><code_id>1</code_id></instance>'
            ))).toThrow('Invalid instance 1: ID and code are required.');
        });

        test('throws when start or end is not a number', () => {
            expect(() => validateXmlStructure(sportscodeWithInstance(
                '<instance><ID>1</ID><start>abc</start><end>2</end><code>GOAL_FOR</code></instance>'
            ))).toThrow('start and end must be numbers');
        });

        test('throws when end is before start', () => {
            expect(() => validateXmlStructure(sportscodeWithInstance(
                '<instance><ID>1</ID><start>10</start><end>2</end><code>GOAL_FOR</code></instance>'
            ))).toThrow('end must not be before start');
        });

        test('throws when code_id has no matching row', () => {
            expect(() => validateXmlStructure(sportscodeWithInstance(
                '<instance><ID>1</ID><start>1</start><end>2</end><code_id>99</code_id><code>GOAL_FOR</code></instance>'
            ))).toThrow('code_id 99 has no matching row');
        });
    });
});

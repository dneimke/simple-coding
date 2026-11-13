/**
 * Tests for xmlUtils.js functionality
 */
import {
    parseXmlToEvents,
    validateXmlStructure,
    generateGameXml,
    generateSportscodeXml,
    mergeXmlEventStreams
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

        test('pure generateSportscodeXml produces clean file tag without custom metadata attributes', () => {
            const xml = generateSportscodeXml([{ event: 'GOAL_FOR', timeMs: 60000 }]);
            const doc = parse(xml);
            expect(doc.documentElement.getAttribute('app')).toBeNull();
            expect(doc.documentElement.getAttribute('teams')).toBeNull();
        });

        test('serializes note and favorite status as Sportscode label groups', () => {
            const xml = generateSportscodeXml([
                {
                    event: 'GOAL_FOR',
                    timeMs: 60000,
                    note: 'Top right corner strike',
                    isFavorite: true
                }
            ]);
            expect(xml).toContain('<group>Notes</group>');
            expect(xml).toContain('<text>Top right corner strike</text>');
            expect(xml).toContain('<group>Favorite</group>');
            expect(xml).toContain('<text>Yes</text>');
        });

        test('escapes special characters in notes and ignores empty whitespace notes', () => {
            const xml = generateSportscodeXml([
                {
                    event: 'TURNOVER',
                    timeMs: 15000,
                    note: 'High press <left & right>',
                    favorite: true
                },
                {
                    event: 'CIRCLE_ENTRY',
                    timeMs: 20000,
                    note: '   '
                }
            ]);
            expect(xml).toContain('<text>High press &lt;left &amp; right&gt;</text>');
            expect(xml).not.toMatch(/<group>Notes<\/group>\s*<text>\s*<\/text>/);
        });
    });

    describe('generateGameXml', () => {
        test('returns the Sportscode document for the game events with lossless root metadata', () => {
            const game = {
                id: 'game-123',
                teams: 'FIRE vs TIGERS',
                teamCodes: ['FIRE', 'TIGERS'],
                teamMeta: [{ code: 'FIRE', color: 'team-color-fire' }, { code: 'TIGERS', color: 'team-color-tigers' }],
                elapsedTime: 4200000,
                timestamp: '2026-11-11T12:00:00.000Z',
                videoOffsetMs: 1500,
                events: [{ event: 'GOAL_FOR', timeMs: 60000 }]
            };
            const xml = generateGameXml(game, 1);
            const doc = parse(xml);
            const root = doc.documentElement;

            expect(root.getAttribute('app')).toBe('simple-coding');
            expect(root.getAttribute('game_id')).toBe('game-123');
            expect(root.getAttribute('teams')).toBe('FIRE vs TIGERS');
            expect(root.getAttribute('team_codes')).toBe('FIRE,TIGERS');
            expect(JSON.parse(root.getAttribute('team_meta'))).toEqual(game.teamMeta);
            expect(root.getAttribute('elapsed_time')).toBe('4200000');
            expect(root.getAttribute('timestamp')).toBe('2026-11-11T12:00:00.000Z');
            expect(root.getAttribute('video_offset')).toBe('1500');

            // Sportscode elements remain standard
            expect(doc.querySelectorAll('file > ALL_INSTANCES > instance')).toHaveLength(1);
            expect(doc.querySelectorAll('file > ROWS > row')).toHaveLength(1);
        });

        test('serializes bare game with default fallback when metadata is missing', () => {
            const game = { events: [{ event: 'GOAL_FOR', timeMs: 60000 }] };
            const xml = generateGameXml(game);
            const doc = parse(xml);
            expect(doc.documentElement.getAttribute('app')).toBe('simple-coding');
            expect(doc.documentElement.getAttribute('game_id')).toBeNull();
        });

        test('round-trips custom playlists and empty playlists through Sportscode XML', () => {
            const game = {
                id: 'game-pl-1',
                teams: 'NSW vs VIC',
                events: [
                    { id: 'e1', event: 'FIRE BS1', timeMs: 12000, isFavorite: true },
                    { id: 'e2', event: 'FIRE CE', timeMs: 35000 }
                ],
                metadata: {
                    playlists: [
                        { id: 'pl-press', name: 'NSW Press', eventIds: ['e2'] },
                        { id: 'pl-empty', name: 'Corners', eventIds: [] }
                    ]
                }
            };

            const xml = generateGameXml(game);
            expect(xml).toContain('<group>Playlist</group>');
            expect(xml).toContain('<text>NSW Press</text>');

            const parsed = parseXmlToEvents(xml);
            expect(parsed).toHaveLength(2);
            // Playlist labels should be extracted as reserved metadata, not card tactical pills
            expect((parsed[1].labels || []).some(l => l.group === 'Playlist')).toBe(false);
            expect(parsed.gameMetadata.playlists).toEqual([
                { id: 'pl-press', name: 'NSW Press', eventIds: [parsed[1].id] },
                { id: 'pl-empty', name: 'Corners', eventIds: [] }
            ]);
        });

        test('rehydrates playlists from third-party Sportscode Playlist labels without root attribute', () => {
            const xml = sportscodeWithInstance(`
                <instance>
                    <ID>1</ID>
                    <start>10.00</start>
                    <end>20.00</end>
                    <code_id>1</code_id>
                    <code>GOAL_FOR</code>
                    <label><group>Playlist</group><text>High Press</text></label>
                </instance>
            `);
            const parsed = parseXmlToEvents(xml);
            expect(parsed.gameMetadata.playlists).toHaveLength(1);
            expect(parsed.gameMetadata.playlists[0].name).toBe('High Press');
            expect(parsed.gameMetadata.playlists[0].eventIds).toEqual([parsed[0].id]);
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

        test('extracts lossless metadata into events.gameMetadata and attaches teamsAttribute', () => {
            const xml = `<?xml version="1.0" encoding="utf-8"?>
<file app="simple-coding" game_id="game-xyz" teams="LIONS vs SHARKS" team_codes="LIONS,SHARKS" team_meta='[{"code":"LIONS","color":"team-color-fire"}]' elapsed_time="120000" timestamp="2026-11-11T10:00:00.000Z" video_offset="2500">
  <ALL_INSTANCES>
    <instance>
      <ID>1</ID>
      <start>10.00</start>
      <end>20.00</end>
      <code>GOAL</code>
    </instance>
  </ALL_INSTANCES>
  <ROWS>
    <row><id>1</id><name>GOAL</name></row>
  </ROWS>
</file>`;
            const events = parseXmlToEvents(xml);
            expect(events).toHaveLength(1);
            expect(events.teamsAttribute).toBe('LIONS vs SHARKS');
            expect(events.gameMetadata).toEqual({
                gameId: 'game-xyz',
                teams: 'LIONS vs SHARKS',
                teamCodes: ['LIONS', 'SHARKS'],
                teamMeta: [{ code: 'LIONS', color: 'team-color-fire' }],
                elapsedTime: 120000,
                timestamp: '2026-11-11T10:00:00.000Z',
                videoOffsetMs: 2500
            });
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

        test('extracts Notes and Favorite labels and keeps domain labels segregated', () => {
            const xml = `<?xml version="1.0" encoding="utf-8"?>
<file>
  <ALL_INSTANCES>
    <instance>
      <ID>1</ID>
      <start>55.00</start>
      <end>65.00</end>
      <code_id>1</code_id>
      <code>FIRE CE</code>
      <label>
        <group>Channel</group>
        <text>Left</text>
      </label>
      <label>
        <group>Notes</group>
        <text>Great overhead pass from #4</text>
      </label>
      <label>
        <group>Favorite</group>
        <text>Yes</text>
      </label>
    </instance>
  </ALL_INSTANCES>
  <ROWS>
    <row><id>1</id><name>FIRE CE</name></row>
  </ROWS>
</file>`;
            const [parsed] = parseXmlToEvents(xml);
            expect(parsed.event).toBe('FIRE CE');
            expect(parsed.note).toBe('Great overhead pass from #4');
            expect(parsed.isFavorite).toBe(true);
            expect(parsed.favorite).toBe(true);
            expect(parsed.labels).toEqual([{ group: 'Channel', text: 'Left' }]);
        });

        test('handles alternative group names for comments and favorites on import', () => {
            const xml = `<?xml version="1.0" encoding="utf-8"?>
<file>
  <ALL_INSTANCES>
    <instance>
      <ID>1</ID>
      <start>55.00</start>
      <end>65.00</end>
      <code_id>1</code_id>
      <code>FIRE CE</code>
      <label>
        <group>Comment</group>
        <text>Opposition caught pressing</text>
      </label>
      <label>
        <group>Starred</group>
        <text>Key clip</text>
      </label>
    </instance>
  </ALL_INSTANCES>
  <ROWS>
    <row><id>1</id><name>FIRE CE</name></row>
  </ROWS>
</file>`;
            const [parsed] = parseXmlToEvents(xml);
            expect(parsed.note).toBe('Opposition caught pressing');
            expect(parsed.isFavorite).toBe(true);
            expect(parsed.labels).toBeUndefined();
        });

        test('round-trips notes and favorites through export and import without label pollution', () => {
            const events = [
                {
                    event: 'FIRE CE',
                    timeMs: 60000,
                    note: 'Crucial baseline attack',
                    isFavorite: true,
                    favorite: true,
                    labels: [{ group: 'Channel', text: 'Right' }]
                }
            ];
            const xml = generateSportscodeXml(events);
            const imported = parseXmlToEvents(xml);
            expect(imported).toHaveLength(1);
            expect(imported[0].event).toBe('FIRE CE');
            expect(imported[0].timeMs).toBe(60000);
            expect(imported[0].note).toBe('Crucial baseline attack');
            expect(imported[0].isFavorite).toBe(true);
            expect(imported[0].labels).toEqual([
                { group: 'Channel', text: 'Right' },
                { group: 'Origin', text: 'Build-Up' }
            ]);
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

    describe('mergeXmlEventStreams', () => {
        test('interleaves two event streams chronologically by timeMs', () => {
            const base = [
                { event: 'CE', timeMs: 10000 },
                { event: 'SHOT', timeMs: 30000 }
            ];
            const incoming = [
                { event: 'TURNOVER', timeMs: 20000 },
                { event: 'GOAL', timeMs: 40000 }
            ];
            const result = mergeXmlEventStreams(base, incoming);
            expect(result.map(e => e.event)).toEqual(['CE', 'TURNOVER', 'SHOT', 'GOAL']);
            expect(result.addedCount).toBe(2);
            expect(result.duplicateCount).toBe(0);
        });

        test('deduplicates events with identical codes within the tolerance window', () => {
            const base = [
                { event: 'SHOT', timeMs: 15000 }
            ];
            const incoming = [
                { event: 'SHOT', timeMs: 15300 },
                { event: 'SHOT', timeMs: 17000 }
            ];
            const result = mergeXmlEventStreams(base, incoming, { dedupeWindowMs: 500 });
            expect(result).toHaveLength(2);
            expect(result.addedCount).toBe(1);
            expect(result.duplicateCount).toBe(1);
            expect(result[0].timeMs).toBe(15000);
            expect(result[1].timeMs).toBe(17000);
        });

        test('enriches duplicate events with incoming notes, favorites, and labels', () => {
            const base = [
                { event: 'SHOT', timeMs: 15000 }
            ];
            const incoming = [
                {
                    event: 'SHOT',
                    timeMs: 15200,
                    note: 'Top right deflection',
                    isFavorite: true,
                    labels: [{ group: 'Outcome', text: 'Saved' }]
                }
            ];
            const result = mergeXmlEventStreams(base, incoming, { dedupeWindowMs: 500 });
            expect(result).toHaveLength(1);
            expect(result.duplicateCount).toBe(1);
            expect(result.addedCount).toBe(0);
            expect(result[0].note).toBe('Top right deflection');
            expect(result[0].isFavorite).toBe(true);
            expect(result[0].favorite).toBe(true);
            expect(result[0].labels).toEqual([{ group: 'Outcome', text: 'Saved' }]);
        });

        test('handles intra-file duplicates in incoming stream', () => {
            const base = [];
            const incoming = [
                { event: 'PC', timeMs: 5000 },
                { event: 'PC', timeMs: 5200 }
            ];
            const result = mergeXmlEventStreams(base, incoming);
            expect(result).toHaveLength(1);
            expect(result.addedCount).toBe(1);
            expect(result.duplicateCount).toBe(1);
        });

        test('handles empty or null inputs gracefully', () => {
            const result = mergeXmlEventStreams(null, null);
            expect(result).toHaveLength(0);
            expect(result.addedCount).toBe(0);
            expect(result.duplicateCount).toBe(0);
        });
    });
});

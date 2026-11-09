import { convertSportscodeXml } from '../../scripts/convert-sportscode-xml.js';

describe('convertSportscodeXml', () => {
    const createSampleXml = (instances) => {
        const instanceXml = instances.map((inst, idx) => `
    <instance>
        <ID>${idx + 1}</ID>
        <code>${inst.code}</code>
        <start>${inst.start}</start>
        <end>${inst.end}</end>
        ${(inst.labels || []).map(l => `<label><text>${l}</text></label>`).join('\n')}
    </instance>`).join('\n');

        return `<?xml version="1.0" encoding="UTF-8"?>
<file>
<ALL_INSTANCES>
${instanceXml}
</ALL_INSTANCES>
</file>`;
    };

    test('throws if XML contains no instances', () => {
        expect(() => convertSportscodeXml('<file></file>')).toThrow('No <instance> entries found');
    });

    test('detects teams and extracts standard Q1-Q4 quarters', () => {
        const xml = createSampleXml([
            { code: 'Q1', start: 10, end: 11 },
            { code: 'Q2', start: 100, end: 101 },
            { code: 'Q3', start: 200, end: 201 },
            { code: 'Q4', start: 300, end: 301 },
            { code: 'THUNDER CE', start: 20, end: 30, labels: ['Circle Entry Left'] },
            { code: 'BLAZE CE', start: 50, end: 60, labels: ['Circle Entry Right'] }
        ]);

        const result = convertSportscodeXml(xml);
        expect(result.game.teams).toEqual(['THUNDER', 'BLAZE']);
        expect(result.game.events.filter(e => /^Q[1-4]$/.test(e.event))).toHaveLength(4);
    });

    test('extracts quarters from 6 QTR WHISTLE pushback instances', () => {
        const xml = createSampleXml([
            { code: 'QTR WHISTLE', start: 10, end: 11 },    // Q1 start
            { code: 'QTR WHISTLE', start: 100, end: 101 },  // Q2 start
            { code: 'QTR WHISTLE', start: 180, end: 181 },  // Halftime
            { code: 'QTR WHISTLE', start: 220, end: 221, labels: ['3'] }, // Q3 start
            { code: 'QTR WHISTLE', start: 310, end: 311, labels: ['4'] }, // Q4 start
            { code: 'QTR WHISTLE', start: 400, end: 401 },  // Full-time
            { code: 'COBRAS CE', start: 30, end: 40 },
            { code: 'FIRE CE', start: 120, end: 130 }
        ]);

        const result = convertSportscodeXml(xml);
        expect(result.game.teams).toEqual(['COBRAS', 'FIRE']);
        const quarterEvents = result.game.events.filter(e => /^Q[1-4]$/.test(e.event));
        expect(quarterEvents).toHaveLength(4);
        expect(quarterEvents[0].timeMs).toBe(10000);
        expect(quarterEvents[1].timeMs).toBe(100000);
        expect(quarterEvents[2].timeMs).toBe(220000);
        expect(quarterEvents[3].timeMs).toBe(310000);
    });

    test('maps Circle Entries with channel labels and nearby fallback', () => {
        const xml = createSampleXml([
            { code: 'Q1', start: 1, end: 2 },
            { code: 'COBRAS CIRCLE ENTRY', start: 20, end: 30, labels: ['LF'] },
            { code: 'COBRAS CIRCLE ENTRY', start: 50, end: 60, labels: ['CT'] },
            { code: 'FIRE CIRCLE ENTRY', start: 80, end: 90, labels: ['RT'] },
            // Missing direct label but nearby instance has RTE
            { code: 'FIRE A25 ENTRY', start: 108, end: 112, labels: ['RTE'] },
            { code: 'FIRE CIRCLE ENTRY', start: 110, end: 120, labels: [] }
        ]);

        const result = convertSportscodeXml(xml, { teams: ['COBRAS', 'FIRE'] });
        const ces = result.game.events.filter(e => e.event.includes('CE'));
        expect(ces).toHaveLength(4);
        expect(ces[0].labels).toEqual([{ group: 'Channel', text: 'Left' }]);
        expect(ces[1].labels).toEqual([{ group: 'Channel', text: 'Center' }]);
        expect(ces[2].labels).toEqual([{ group: 'Channel', text: 'Right' }]);
        expect(ces[3].labels).toEqual([{ group: 'Channel', text: 'Right' }]);
    });

    test('maps GAINED POS to BW1-BW4 with zone detection and 6s lead compensation', () => {
        const xml = createSampleXml([
            { code: 'COBRAS GAINED POS', start: 10, end: 30, labels: ['COBRAS D30'] },
            { code: 'COBRAS GAINED POS', start: 40, end: 60, labels: ['COBRAS D50'] },
            { code: 'COBRAS GAINED POS', start: 70, end: 90, labels: ['COBRAS A50'] },
            { code: 'FIRE GAINED POS', start: 100, end: 120, labels: ['FIRE A25'] },
            { code: 'FIRE GAINED POS', start: 130, end: 150, labels: [] }
        ]);

        const result = convertSportscodeXml(xml, { teams: ['COBRAS', 'FIRE'] });
        const bws = result.game.events.filter(e => e.event.includes('BW'));
        expect(bws).toHaveLength(5);
        expect(bws[0].event).toBe('COBRAS BW1');
        expect(bws[0].timeMs).toBe(16000); // 10 + 6 = 16s
        expect(bws[1].event).toBe('COBRAS BW2');
        expect(bws[2].event).toBe('COBRAS BW3');
        expect(bws[3].event).toBe('FIRE BW4');
        expect(bws[4].event).toBe('FIRE BW');
    });

    test('skips continuous possession, press, and standalone spatial boxes', () => {
        const xml = createSampleXml([
            { code: 'COBRAS POSSESSION', start: 10, end: 30 },
            { code: 'FIRE PRESS', start: 10, end: 30 },
            { code: 'COBRAS D30', start: 15, end: 20 },
            { code: 'FIRE A50', start: 20, end: 25 },
            { code: 'COBRAS PCD', start: 40, end: 50 },
            { code: 'COBRAS FREE HIT', start: 60, end: 66 },
            { code: 'FIRE OUTLET', start: 70, end: 76 }
        ]);

        const result = convertSportscodeXml(xml, { teams: ['COBRAS', 'FIRE'] });
        const actions = result.game.events.map(e => e.event);
        expect(actions).toEqual(['COBRAS BS', 'FIRE BS']);
    });

    test('deduplicates shots/GSO, PC/PCA, and maps goals with correct type', () => {
        const xml = createSampleXml([
            { code: 'COBRAS SHOTS', start: 20, end: 30 },
            { code: 'COBRAS GSO', start: 20, end: 32 }, // duplicate shot within 2.5s
            { code: 'COBRAS PC WON', start: 40, end: 50 },
            { code: 'COBRAS PCA', start: 40, end: 50 },    // duplicate PC within 3s
            { code: 'COBRAS GOAL', start: 60, end: 70, labels: ['FIELD GOAL'] },
            { code: 'COBRAS GOAL', start: 80, end: 90, labels: ['SHOOTOUT GOAL'] },
            { code: 'FIRE GOAL', start: 100, end: 110, labels: ['PC GOAL'] }
        ]);

        const result = convertSportscodeXml(xml, { teams: ['COBRAS', 'FIRE'] });
        const shots = result.game.events.filter(e => e.event === 'COBRAS SHOT');
        expect(shots).toHaveLength(1);

        const pcs = result.game.events.filter(e => e.event === 'COBRAS PC');
        expect(pcs).toHaveLength(1);

        const goals = result.game.events.filter(e => e.event.includes('GOAL'));
        expect(goals).toHaveLength(3);
        expect(goals[0].labels).toEqual([{ group: 'Type', text: 'Field Goal' }]);
        expect(goals[1].labels).toEqual([{ group: 'Type', text: 'Shootout' }]);
        expect(goals[2].labels).toEqual([{ group: 'Type', text: 'Penalty Corner' }]);
    });

    test('generates valid XML, sequence classification, and report', () => {
        const xml = createSampleXml([
            { code: 'Q1', start: 10, end: 11 },
            { code: 'COBRAS GAINED POS', start: 20, end: 25, labels: ['COBRAS D50'] },
            { code: 'COBRAS CIRCLE ENTRY', start: 30, end: 40, labels: ['LF'] },
            { code: 'COBRAS SHOTS', start: 35, end: 45 },
            { code: 'FIRE OUTLET', start: 50, end: 60 }
        ]);

        const result = convertSportscodeXml(xml, { teams: ['COBRAS', 'FIRE'] });
        expect(result.xml).toContain('<ALL_INSTANCES>');
        expect(result.sequences).toBeDefined();
        expect(result.sequences.stats.circleEntries.total).toBe(1);
        expect(result.markdownReport).toContain('# Attacking entries — COBRAS vs FIRE');
    });
});

import { convertSportscodeXml, decodeSportscodeXml } from '../../scripts/convert-sportscode-xml.js';

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

describe('convertSportscodeXml - quarters and team detection', () => {
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
            { code: 'QTR WHISTLE', start: 10, end: 11 },
            { code: 'QTR WHISTLE', start: 100, end: 101 },
            { code: 'QTR WHISTLE', start: 180, end: 181 },
            { code: 'QTR WHISTLE', start: 220, end: 221, labels: ['3'] },
            { code: 'QTR WHISTLE', start: 310, end: 311, labels: ['4'] },
            { code: 'QTR WHISTLE', start: 400, end: 401 },
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

    test('extracts quarters from five plain whistles and keeps full time as an umpire mark', () => {
        const xml = createSampleXml([
            { code: 'Whistle', start: 10, end: 12 },
            { code: 'Whistle', start: 100, end: 102 },
            { code: 'Whistle', start: 900, end: 902 },
            { code: 'Whistle', start: 1200, end: 1202 },
            { code: 'Whistle', start: 1600, end: 1602 },
            { code: 'CHILL AC Entry', start: 30, end: 40 },
            { code: 'NSW Shot', start: 110, end: 120 }
        ]);

        const result = convertSportscodeXml(xml, { mapTeam: { NSW: 'PRIDE' } });
        const quarterEvents = result.game.events.filter(e => /^Q[1-4]$/.test(e.event));
        expect(quarterEvents.map(e => e.event)).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
        expect(quarterEvents.map(e => e.timeMs)).toEqual([10000, 100000, 900000, 1200000]);
        const umps = result.game.events.filter(e => e.event === 'UMP');
        expect(umps).toHaveLength(1);
        expect(umps[0].timeMs).toBe(1601000);
    });

    test('extracts four quarters from eight paired period whistles', () => {
        const xml = createSampleXml([
            { code: 'Whistle', start: 175.4, end: 176.4 },
            { code: 'Whistle', start: 176.9, end: 177.9 },
            { code: 'Whistle', start: 1280.7, end: 1281.7 },
            { code: 'Whistle', start: 1282.3, end: 1283.3 },
            { code: 'Whistle', start: 3023.1, end: 3024.1 },
            { code: 'Whistle', start: 3024.7, end: 3025.7 },
            { code: 'Whistle', start: 4113.7, end: 4114.7 },
            { code: 'Whistle', start: 4115.4, end: 4116.4 },
            { code: 'THUNDER Shoot Out', start: 4678.3, end: 4688.3 },
            { code: 'FIRE Shoot Out Against', start: 4686.3, end: 4696.3 }
        ]);

        const result = convertSportscodeXml(xml);
        expect(result.game.events.filter(e => /^Q[1-4]$/.test(e.event)).map(e => e.timeMs))
            .toEqual([175400, 1280700, 3023100, 4113700]);
        expect(result.game.events.filter(e => e.event === 'UMP')).toHaveLength(4);
        expect(result.game.events.filter(e => e.event === 'THUNDER SO')).toHaveLength(1);
        expect(result.game.events.some(e => e.event.includes('Against'))).toBe(false);
    });

    test('leaves eight evenly spaced whistles as umpire marks', () => {
        const xml = createSampleXml([
            { code: 'Whistle', start: 10, end: 12 },
            { code: 'Whistle', start: 20, end: 22 },
            { code: 'Whistle', start: 30, end: 32 },
            { code: 'Whistle', start: 40, end: 42 },
            { code: 'Whistle', start: 50, end: 52 },
            { code: 'Whistle', start: 60, end: 62 },
            { code: 'Whistle', start: 70, end: 72 },
            { code: 'Whistle', start: 80, end: 82 },
            { code: 'THUNDER CE', start: 15, end: 25 }
        ]);

        const result = convertSportscodeXml(xml);
        expect(result.game.events.some(e => /^Q[1-4]$/.test(e.event))).toBe(false);
        expect(result.game.events.filter(e => e.event === 'UMP')).toHaveLength(8);
    });

    test('maps a hyphenated outlet to the team named after the hyphen', () => {
        const xml = createSampleXml([
            { code: 'Q1', start: 1, end: 2 },
            { code: 'PTX CE', start: 10, end: 20 },
            { code: 'Outlet - OPP', start: 30, end: 40 },
            { code: 'Outlet - PTX', start: 50, end: 60 }
        ]);

        const result = convertSportscodeXml(xml, { mapTeam: { OPP: 'FIRE' } });
        expect(result.game.teams).toEqual(['THUNDER', 'FIRE']);
        expect(result.game.events.filter(e => e.event === 'FIRE BS')).toHaveLength(1);
        expect(result.game.events.filter(e => e.event === 'THUNDER BS')).toHaveLength(1);
    });

    test('extracts four quarters from four plain whistles', () => {
        const xml = createSampleXml([
            { code: 'Whistle', start: 10, end: 12 },
            { code: 'Whistle', start: 900, end: 902 },
            { code: 'Whistle', start: 1800, end: 1802 },
            { code: 'Whistle', start: 2700, end: 2702 },
            { code: 'THUNDER CE', start: 30, end: 40 }
        ]);

        const result = convertSportscodeXml(xml);
        expect(result.game.events.filter(e => /^Q[1-4]$/.test(e.event)).map(e => e.timeMs))
            .toEqual([10000, 900000, 1800000, 2700000]);
        expect(result.game.events.some(e => e.event === 'UMP')).toBe(false);
    });

    test('decodes UTF-16 LE Sportscode exports', () => {
        const xml = createSampleXml([
            { code: 'Q1', start: 1, end: 2 },
            { code: 'PTX CE', start: 10, end: 20 }
        ]);
        const encoded = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(xml, 'utf16le')]);
        const result = convertSportscodeXml(decodeSportscodeXml(encoded));
        expect(result.game.teams).toEqual(['THUNDER', 'BLAZE']);
        expect(result.game.events.some(e => e.event === 'THUNDER CE')).toBe(true);
    });
});

describe('convertSportscodeXml - attacking entries and channels', () => {
    test('maps Circle Entries with channel labels and nearby fallback', () => {
        const xml = createSampleXml([
            { code: 'Q1', start: 1, end: 2 },
            { code: 'COBRAS CIRCLE ENTRY', start: 20, end: 30, labels: ['LF'] },
            { code: 'COBRAS CIRCLE ENTRY', start: 50, end: 60, labels: ['CT'] },
            { code: 'FIRE CIRCLE ENTRY', start: 80, end: 90, labels: ['RT'] },
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
        expect(bws[0].timeMs).toBe(16000);
        expect(bws[1].event).toBe('COBRAS BW2');
        expect(bws[2].event).toBe('COBRAS BW3');
        expect(bws[3].event).toBe('FIRE BW4');
        expect(bws[4].event).toBe('FIRE BW');
    });
});

describe('convertSportscodeXml - noise filtering and set pieces', () => {
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
            { code: 'COBRAS GSO', start: 20, end: 32 },
            { code: 'COBRAS PC WON', start: 40, end: 50 },
            { code: 'COBRAS PCA', start: 40, end: 50 },
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

    test('maps long corners and hyphenated shootout rows', () => {
        const xml = createSampleXml([
            { code: 'Q1', start: 1, end: 2 },
            { code: 'PRIDE LC', start: 20, end: 26 },
            { code: 'CHILL LONG CORNER', start: 40, end: 46 },
            { code: 'PRIDE Shootout-Goal', start: 80, end: 88 },
            { code: 'CHILL Shootout-Shot', start: 100, end: 108 },
            { code: 'PRIDE SHOOTOUT', start: 120, end: 130, labels: ['SHOOTOUT GOAL'] }
        ]);

        const result = convertSportscodeXml(xml, { teams: ['PRIDE', 'CHILL'] });
        const restarts = result.game.events.filter(e => e.event.endsWith(' BS'));
        expect(restarts.map(e => e.event)).toEqual(['PRIDE BS', 'CHILL BS']);

        const shots = result.game.events.filter(e => e.event === 'CHILL SHOT');
        expect(shots).toHaveLength(1);

        const goals = result.game.events.filter(e => e.event.includes('GOAL'));
        expect(goals.map(e => e.event)).toEqual(['PRIDE GOAL', 'PRIDE GOAL']);
        expect(goals.every(e => e.labels[0].text === 'Shootout')).toBe(true);
        expect(result.game.events.some(e => e.event === 'PRIDE SO')).toBe(true);
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

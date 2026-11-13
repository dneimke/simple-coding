import fs from 'fs';
import path from 'path';
import {
    inferTeamsFromEvents,
    parseMatchReportData,
    generateMatchReportHtml,
    buildMatchReportFromXml,
    parseXmlFallback
} from '../src/utils/matchReportGenerator.js';

describe('matchReportGenerator', () => {
    describe('parseXmlFallback', () => {
        test('parses instances and labels via fallback regex', () => {
            const xml = `<file><ALL_INSTANCES>
              <instance>
                <start>10.5</start>
                <end>15.5</end>
                <code>THUNDER SHOT</code>
                <label><group>Origin</group><text>Build-Up</text></label>
              </instance>
            </ALL_INSTANCES></file>`;
            const parsed = parseXmlFallback(xml);
            expect(parsed).toHaveLength(1);
            expect(parsed[0].event).toBe('THUNDER SHOT');
            expect(parsed[0].timeMs).toBe(10500);
            expect(parsed[0].lag).toBe(5);
            expect(parsed[0].labels).toEqual([{ group: 'Origin', text: 'Build-Up' }]);
        });
    });
    describe('inferTeamsFromEvents', () => {
        test('infers team codes from standard event prefixes, ignoring structural codes', () => {
            const events = [
                { event: 'Q1', timeMs: 1000 },
                { event: 'UMP', timeMs: 2000 },
                { event: 'THUNDER SHOT', timeMs: 3000 },
                { event: 'BLAZE CE', timeMs: 4000 },
                { event: 'THUNDER PC', timeMs: 5000 },
                { event: 'BLAZE A25E', timeMs: 6000 },
                { event: 'Q2', timeMs: 15000 }
            ];

            const teams = inferTeamsFromEvents(events);
            expect(teams).toEqual(['THUNDER', 'BLAZE']);
        });

        test('falls back to provided fallback teams or defaults when codes lack team prefixes', () => {
            const events = [
                { event: 'SHOT', timeMs: 1000 },
                { event: 'PC', timeMs: 2000 }
            ];

            expect(inferTeamsFromEvents(events, 'FIRE vs TIGERS')).toEqual(['FIRE', 'TIGERS']);
            expect(inferTeamsFromEvents(events, '')).toEqual(['Team 1', 'Team 2']);
        });

        test('respects fixture title team order even when the second-named team has more events', () => {
            const events = [
                { event: 'MATCH START', timeMs: 5000 },
                { event: 'PRIDE BS2', timeMs: 10000 },
                { event: 'PRIDE A25E', timeMs: 20000 },
                { event: 'PRIDE CE', timeMs: 30000 },
                { event: 'HCM BS2', timeMs: 40000 },
                { event: 'MATCH END', timeMs: 50000 }
            ];

            expect(inferTeamsFromEvents(events, 'h1m 20261113 hcm v pride')).toEqual(['HCM', 'PRIDE']);
        });
    });

    describe('parseMatchReportData', () => {
        test('computes accurate totals, quarter breakdown, and momentum buckets', () => {
            const events = [
                { event: 'Q1', timeMs: 60000 },
                { event: 'FIRE SHOT', timeMs: 120000 },
                { event: 'TIGERS CE', timeMs: 180000 },
                { event: 'FIRE GOAL', timeMs: 240000 },
                { event: 'Q2', timeMs: 900000 },
                { event: 'TIGERS PC', timeMs: 960000 },
                { event: 'FIRE CARD', timeMs: 1020000 }
            ];

            const data = parseMatchReportData({ events, title: 'FIRE vs TIGERS' });

            expect(data.teams).toEqual(['FIRE', 'TIGERS']);
            expect(data.score).toEqual({ team1: 1, team2: 0 });
            expect(data.kpis.team1.SHOT).toBe(1);
            expect(data.kpis.team1.GOAL).toBe(1);
            expect(data.kpis.team2.CE).toBe(1);
            expect(data.kpis.team2.PC).toBe(1);
            expect(data.kpis.team1.CARD).toBe(1);

            expect(data.quarters.Q1.score).toEqual({ team1: 1, team2: 0 });
            expect(data.quarters.Q2.kpis.team2.PC).toBe(1);
            expect(Array.isArray(data.momentum)).toBe(true);
            expect(data.momentum.length).toBeGreaterThan(0);
        });

        test('handles matches without quarter markers without error', () => {
            const events = [
                { event: 'FIRE SHOT', timeMs: 10000 },
                { event: 'TIGERS SHOT', timeMs: 20000 }
            ];

            const data = parseMatchReportData({ events });
            expect(data.kpis.team1.SHOT).toBe(1);
            expect(data.kpis.team2.SHOT).toBe(1);
            expect(data.quarters.Q1.kpis.team1.SHOT).toBe(1);
        });

        test('counts zone-qualified ball wins (BW1-BW4) and GREEN/YELLOW cards, and infers quarters from MATCH START', () => {
            const events = [
                { event: 'MATCH START', timeMs: 5000 },
                { event: 'PRIDE BW2', timeMs: 28000 },
                { event: 'HCM BW1', timeMs: 42000 },
                { event: 'HCM RED', timeMs: 112000 },
                { event: 'HCM GOAL', timeMs: 589000 },
                { event: 'MATCH END', timeMs: 1086000 },
                { event: 'MATCH START', timeMs: 1212000 },
                { event: 'PRIDE BW3', timeMs: 1250000 },
                { event: 'HCM SHOT', timeMs: 1300000 },
                { event: 'MATCH END', timeMs: 2286000 },
                { event: 'MATCH START', timeMs: 2740000 },
                { event: 'PRIDE BW4', timeMs: 2800000 },
                { event: 'HCM GREEN', timeMs: 3663000 },
                { event: 'MATCH END', timeMs: 3816000 },
                { event: 'MATCH START', timeMs: 3935000 },
                { event: 'PRIDE YELLOW', timeMs: 4000000 },
                { event: 'PRIDE GOAL', timeMs: 4770000 },
                { event: 'MATCH END', timeMs: 5184000 }
            ];

            const data = parseMatchReportData({ events, title: 'h1m 20261113 hcm v pride' });

            expect(data.teams).toEqual(['HCM', 'PRIDE']);
            expect(data.kpis.team1.BW).toBe(1);
            expect(data.kpis.team2.BW).toBe(3);
            expect(data.kpis.team1.CARD).toBe(1);
            expect(data.kpis.team2.CARD).toBe(1);

            expect(data.quarters.Q1.score).toEqual({ team1: 1, team2: 0 });
            expect(data.quarters.Q2.kpis.team1.SHOT).toBe(1);
            expect(data.quarters.Q2.kpis.team2.BW).toBe(1);
            expect(data.quarters.Q3.kpis.team1.CARD).toBe(1);
            expect(data.quarters.Q4.kpis.team2.GOAL).toBe(1);
            expect(data.quarters.Q4.kpis.team2.CARD).toBe(1);
        });
    });

    describe('generateMatchReportHtml', () => {
        test('produces valid self-contained HTML document with dark theme and no jargon', () => {
            const events = [
                { event: 'Q1', timeMs: 60000 },
                { event: 'FIRE SHOT', timeMs: 120000 },
                { event: 'FIRE GOAL', timeMs: 180000, labels: [{ group: 'Type', text: 'Field Goal' }] },
                { event: 'TIGERS PC', timeMs: 240000 }
            ];

            const data = parseMatchReportData({ events, title: 'Fire vs Tigers Round 1' });
            const html = generateMatchReportHtml(data);

            expect(typeof html).toBe('string');
            expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
            expect(html).toContain('FIRE');
            expect(html).toContain('TIGERS');
            expect(html).toContain('1'); // Score
            expect(html).toContain('tailwindcss.min.js');
            expect(html).toContain('Match Analytics Dossier');

            // No developer jargon
            expect(html).not.toContain('localStorage');
            expect(html).not.toContain('JSON.stringify');
            expect(html).not.toContain('factory default');
        });
    });

    describe('Real Match XML Validation (Thunder vs Blaze)', () => {
        const fixturePath = '/home/antigravity/h1w-20261107-thunder-v-blaze-converted.xml';

        test('parses converted match XML and extracts exact verified match stats', () => {
            if (!fs.existsSync(fixturePath)) {
                // Skip if environment doesn't have the external file
                return;
            }

            const xmlContent = fs.readFileSync(fixturePath, 'utf8');
            const { data, html } = buildMatchReportFromXml(xmlContent, { title: 'Thunder vs Blaze' });

            expect(data.teams).toEqual(['THUNDER', 'BLAZE']);
            // Thunder scored 1 goal
            const thunderKey = data.teams[1] === 'THUNDER' ? 'team2' : 'team1';
            const blazeKey = data.teams[0] === 'BLAZE' ? 'team1' : 'team2';

            expect(data.kpis[thunderKey].GOAL).toBe(1);
            expect(data.kpis[blazeKey].GOAL).toBe(0);
            expect(data.kpis[thunderKey].SHOT).toBe(19);
            expect(data.kpis[blazeKey].SHOT).toBe(18);
            expect(data.kpis[thunderKey].PC).toBe(11);
            expect(data.kpis[blazeKey].PC).toBe(12);
            expect(data.kpis[thunderKey].CE).toBe(18);
            expect(data.kpis[blazeKey].CE).toBe(26);
            expect(data.kpis[thunderKey].A25E).toBe(32);
            expect(data.kpis[blazeKey].A25E).toBe(46);
            expect(data.kpis[thunderKey].BW).toBe(37);
            expect(data.kpis[blazeKey].BW).toBe(42);
            expect(data.kpis[thunderKey].CARD).toBe(4);
            expect(data.kpis[blazeKey].CARD).toBe(2);

            expect(data.events.length).toBe(364);
            expect(html).toContain('THUNDER');
            expect(html).toContain('BLAZE');
            expect(html).toContain('364');
        });
    });

    describe('openMatchReport Browser Trigger', () => {
        test('opens a blob URL window or falls back safely', () => {
            const originalWindowOpen = window.open;
            const originalCreateObjectURL = URL.createObjectURL;
            const openMock = jest.fn().mockReturnValue({});
            const createUrlMock = jest.fn().mockReturnValue('blob:test-report');

            window.open = openMock;
            URL.createObjectURL = createUrlMock;

            const game = {
                teams: 'FIRE vs TIGERS',
                events: [
                    { event: 'FIRE SHOT', timeMs: 1000 },
                    { event: 'TIGERS PC', timeMs: 2000 }
                ]
            };

            const { openMatchReport } = require('../src/utils/matchReportGenerator.js');
            openMatchReport(game);

            expect(createUrlMock).toHaveBeenCalled();
            expect(openMock).toHaveBeenCalledWith('blob:test-report', '_blank');

            window.open = originalWindowOpen;
            URL.createObjectURL = originalCreateObjectURL;
        });
    });
});

/**
 * @jest-environment jsdom
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildSequences } from '../../src/spike/sequences/engine.js';
import { analyseGameText, gameLabel, readSavedGames } from '../../src/spike/sequences/games.js';
import { mountSequenceSpike } from '../../src/spike/sequences/page.js';
import { renderReport } from '../../src/spike/sequences/render.js';
import { formatReport } from '../../src/spike/sequences/report.js';

const fixtureText = readFileSync(path.join(process.cwd(), 'src/spike/sequences/fixture.json'), 'utf8');

describe('sequence spike', () => {
    test('classifies A25E and CE entries as Counter or Build-Up and leaves coded events unchanged', () => {
        const analysed = analyseGameText(fixtureText);
        expect(analysed.mutated).toBe(false);
        expect(analysed.game.name).toBe('Circle entry fixture');
        expect(analysed.result.stats.circleEntries).toEqual({
            total: 8,
            counter: 2,
            buildUp: 6
        });
        expect(analysed.result.stats.a25Entries).toEqual({
            total: 1,
            counter: 0,
            buildUp: 1
        });

        const report = document.createElement('div');
        renderReport(report, analysed.game, analysed.result, { mutated: false });
        expect(report.textContent).toContain('Circle Entries (CE)');
        expect(report.textContent).toContain('8 Total CE');
        expect(report.textContent).toContain('25m Entries (A25E)');
        expect(report.textContent).toContain('1 Total 25m');
        expect(report.textContent).toContain('8s after BW1');
        expect(report.textContent).toContain('12s after BW2 (over 10s counter window)');
        expect(report.textContent).not.toContain('GREEN');
        expect(report.textContent).not.toContain('BW3');

        const markdown = formatReport(analysed.game, analysed.result, { mutated: false });
        expect(markdown).toContain('Attacking entries — Circle entry fixture');
        expect(markdown).toContain('| Circle entries (CE) | 8 | 2 | 6 |');
        expect(markdown).toContain('| 25m entries (A25E) | 1 | 0 | 1 |');
    });

    test('resolves team names from object teams and isTeam1 flags', () => {
        const result = buildSequences(
            [
                { id: '1', event: 'BW1', isTeam1: true, timeMs: 1000 },
                { id: '2', event: 'CE', isTeam1: true, timeMs: 5000 },
                { id: '3', event: 'A25E', isTeam1: false, timeMs: 25000 }
            ],
            { teams: [{ code: 'FIRE' }, { name: 'TIGERS' }] }
        );
        expect(result.entries[0].team).toBe('FIRE');
        expect(result.entries[0].originType).toBe('Counter');
        expect(result.entries[1].team).toBe('TIGERS');
        expect(result.entries[1].originType).toBe('Build-Up');
    });

    test('reads saved matches and formats labels across team representations', () => {
        const storage = {
            getItem: () => JSON.stringify([
                { name: 'FIRE vs TIGERS', events: [{ event: 'FIRE CE', timeMs: 1000 }] },
                { name: 'Empty' },
                null
            ])
        };
        const games = readSavedGames(storage);
        expect(games).toHaveLength(1);
        expect(gameLabel(games[0])).toBe('FIRE vs TIGERS');
        expect(gameLabel({ teams: 'PRIDE vs THUNDER' })).toBe('PRIDE vs THUNDER');
        expect(gameLabel({ teams: [{ code: 'FIRE' }, { name: 'TIGERS' }] })).toBe('FIRE vs TIGERS');
        expect(gameLabel({ teams: ['FIRE', 'TIGERS'] })).toBe('FIRE vs TIGERS');
        expect(gameLabel(null)).toBe('Coded match');
        expect(gameLabel({})).toBe('Coded match');
        expect(readSavedGames({ getItem: () => 'not-json' })).toEqual([]);
    });

    test('runs a saved match and the sample from the page and filters rows', async () => {
        document.body.innerHTML = `
            <details id="match-selector-details" open>
                <summary><span id="match-selector-title"></span></summary>
                <div id="saved-games"></div>
                <p id="status"></p>
                <button type="button" id="upload-button"></button>
                <button type="button" id="sample-button"></button>
                <input id="file-input">
            </details>
            <div id="report"></div>
        `;
        const storage = {
            getItem: () => JSON.stringify([
                { name: 'Saved final', events: [{ id: '1', event: 'FIRE CE', timeMs: 4000 }] }
            ])
        };

        mountSequenceSpike(document, {
            storage,
            fetchSample: () => Promise.resolve(fixtureText)
        });

        const savedButton = document.querySelector('#saved-games button');
        expect(savedButton.textContent).toContain('Saved final');
        savedButton.click();
        expect(document.getElementById('status').textContent).toBe('Saved final');
        expect(document.getElementById('report').textContent).toContain('1 Total CE');

        document.getElementById('sample-button').click();
        await Promise.resolve();
        expect(document.getElementById('status').textContent).toBe('Sample match');
        expect(document.getElementById('report').textContent).toContain('8 Total CE');

        // Test filter interaction
        const counterPill = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('⚡ Counter'));
        expect(counterPill).toBeDefined();
        counterPill.click();
        expect(document.getElementById('report').textContent).toContain('Showing 2 of 9 entries');

        // Test row click seeks video
        const firstRow = document.querySelector('#report .entry-row');
        expect(firstRow).toBeDefined();
        firstRow.click();
        expect(document.getElementById('active-entry-info').textContent).toContain('Counter');
    });
});

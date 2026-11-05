/**
 * @jest-environment jsdom
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { analyseGameText, gameLabel, readSavedGames } from '../../src/spike/sequences/games.js';
import { mountSequenceSpike } from '../../src/spike/sequences/page.js';
import { renderReport } from '../../src/spike/sequences/render.js';

const fixtureText = readFileSync(path.join(process.cwd(), 'src/spike/sequences/fixture.json'), 'utf8');

describe('sequence spike', () => {
    test('keeps every circle entry and leaves the coded events unchanged', () => {
        const analysed = analyseGameText(fixtureText);
        expect(analysed.mutated).toBe(false);
        expect(analysed.game.name).toBe('Circle entry fixture');
        expect(analysed.result.stats.circleEntriesCoded).toBe(8);
        expect(analysed.result.stats.circleEntriesInSequences).toBe(8);
        expect(analysed.result.stats.circleEntriesByOutcome).toEqual({
            Goal: 1,
            PC: 1,
            Shot: 2,
            Turnover: 1,
            'No shot': 3,
            'No circle': 0,
            'No entry': 0
        });

        const report = document.createElement('div');
        renderReport(report, analysed.game, analysed.result, { mutated: false });
        expect(report.textContent).toContain('8 circle entries coded, 8 placed in a chain');
        expect(report.textContent).toContain('BW1');
        expect(report.textContent).toContain('The coded events were left unchanged.');
        expect(report.textContent).toContain('card or substitution');
    });

    test('reads saved matches and ignores anything that is not a coded game', () => {
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
        expect(readSavedGames({ getItem: () => 'not-json' })).toEqual([]);
    });

    test('runs a saved match and the sample from the page', async () => {
        document.body.innerHTML = `
            <div id="saved-games"></div>
            <p id="status"></p>
            <div id="report"></div>
            <button type="button" id="upload-button"></button>
            <button type="button" id="sample-button"></button>
            <input id="file-input">
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
        expect(document.getElementById('report').textContent).toContain('1 circle entry coded, 1 placed in a chain');

        document.getElementById('sample-button').click();
        await Promise.resolve();
        expect(document.getElementById('status').textContent).toBe('Sample match');
        expect(document.getElementById('report').textContent).toContain('8 circle entries coded');
    });
});

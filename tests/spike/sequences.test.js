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
        expect(report.textContent).toContain('Circle Entries (8)');
        expect(report.textContent).toContain('25m Entries (1)');
        expect(report.textContent).not.toContain('D-Penetration');
        expect(report.textContent).not.toContain('Attack Origins');
        expect(report.textContent).not.toContain('Feedback Batch');
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

    test('classifies chain starting from restart as Build-Up even with late intermediate BW tag', () => {
        const result = buildSequences(
            [
                { id: '1', event: 'BS4', isTeam1: true, timeMs: 1000 },
                { id: '2', event: 'A25E', isTeam1: true, timeMs: 20000 },
                { id: '3', event: 'BW4', isTeam1: true, timeMs: 27000 },
                { id: '4', event: 'CE', isTeam1: true, timeMs: 29000 }
            ],
            { teams: ['FIRE', 'PRIDE'] }
        );
        expect(result.entries).toHaveLength(1);
        expect(result.entries[0].originType).toBe('Build-Up');
        expect(result.entries[0].triggerCode).toBe('BS4');
        expect(result.entries[0].reason).toContain('after BS4');
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
        expect(gameLabel({ name: 'h1m 20261031 fire v pride' })).toBe('fire vs pride');
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
        expect(document.getElementById('report').textContent).toContain('Circle Entries (1)');

        document.getElementById('sample-button').click();
        await Promise.resolve();
        expect(document.getElementById('status').textContent).toBe('Sample match');
        expect(document.getElementById('report').textContent).toContain('Circle Entries (8)');

        // Test filter interaction
        const counterPill = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('⚡ Counter'));
        expect(counterPill).toBeDefined();
        counterPill.click();
        expect(document.getElementById('report').textContent).toContain('Showing 2 of 9 entries');

        // Test row click seeks video, highlights active row, and displays clean lead-in note without video duplication
        const firstRow = document.querySelector('#report .entry-row');
        expect(firstRow).toBeDefined();
        expect(firstRow.textContent).toContain('Starts');
        expect(firstRow.textContent).not.toContain('(video');
        firstRow.click();
        expect(firstRow.classList.contains('ring-2')).toBe(true);

        // Test Cloud URL toggle & loading
        const toggleUrlBtn = document.getElementById('btn-toggle-url');
        expect(toggleUrlBtn).not.toBeNull();
        toggleUrlBtn.click();
        const urlBar = document.getElementById('video-url-bar');
        expect(urlBar.classList.contains('hidden')).toBe(false);

        const urlInput = document.getElementById('video-url-input');
        urlInput.value = 'https://example.com/matches/test-match.mp4';
        document.getElementById('btn-load-url').click();

        const videoEl = document.querySelector('#report video');
        expect(videoEl.src).toBe('https://example.com/matches/test-match.mp4');
        expect(document.getElementById('video-filename').textContent).toContain('test-match.mp4');

        // Once video is loaded, 1-tap sources remain available and detach button is displayed
        expect(document.getElementById('btn-attach-file')).not.toBeNull();
        expect(document.getElementById('btn-toggle-url')).not.toBeNull();
        const clearBtn = document.getElementById('btn-clear-video');
        expect(clearBtn).not.toBeNull();
        expect(clearBtn.classList.contains('hidden')).toBe(false);
        expect(urlBar.classList.contains('hidden')).toBe(true);

        // Detaching video resets filename and hides clear button
        clearBtn.click();
        expect(document.getElementById('video-filename').textContent).toBe('No video attached');
        expect(clearBtn.classList.contains('hidden')).toBe(true);

        // Verifying Disk file input does not open the Cloud URL bar
        const originalCreateObjectURL = window.URL?.createObjectURL;
        window.URL.createObjectURL = jest.fn(() => 'blob:mock-video-url');
        try {
            const fileInput = document.getElementById('video-file-input');
            const mockFile = new File(['mock'], 'game-recording.mp4', { type: 'video/mp4' });
            Object.defineProperty(fileInput, 'files', { value: [mockFile] });
            fileInput.dispatchEvent(new Event('change'));

            expect(document.getElementById('video-filename').textContent).toBe('game-recording.mp4');
            expect(clearBtn.classList.contains('hidden')).toBe(false);
            expect(urlBar.classList.contains('hidden')).toBe(true);
        } finally {
            window.URL.createObjectURL = originalCreateObjectURL;
        }
    });

    test('auto-loads sample match on visit and wires matches popover modal', async () => {
        document.body.innerHTML = `
            <header>
                <span id="current-match-badge"></span>
                <button type="button" id="matches-button">Matches</button>
            </header>
            <div id="report"></div>
            <div id="matches-modal" class="hidden">
                <button type="button" id="close-matches-modal"></button>
                <button type="button" id="sample-button"></button>
                <div id="saved-games"></div>
                <button type="button" id="upload-button"></button>
                <input id="file-input">
                <p id="status"></p>
            </div>
        `;

        mountSequenceSpike(document, {
            storage: { getItem: () => '[]' },
            fetchSample: () => Promise.resolve(fixtureText)
        });

        await Promise.resolve();
        await Promise.resolve();

        expect(document.getElementById('current-match-badge').textContent).toBe('Sample match');
        expect(document.getElementById('report').textContent).toContain('Circle Entries (8)');

        // Modal open & close
        const modal = document.getElementById('matches-modal');
        const openBtn = document.getElementById('matches-button');
        const closeBtn = document.getElementById('close-matches-modal');

        expect(modal.classList.contains('hidden')).toBe(true);
        openBtn.click();
        expect(modal.classList.contains('hidden')).toBe(false);
        closeBtn.click();
        expect(modal.classList.contains('hidden')).toBe(true);
    });
});

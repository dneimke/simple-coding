/**
 * @jest-environment jsdom
 */

import { buildSequences } from '../../src/spike/sequences/engine.js';
import { buildSequenceCutlist } from '../../src/spike/sequences/cutlist.js';
import { buildCutlistDownloadFilename } from '../../src/js/playlistCutlist.js';
import { renderReport } from '../../src/spike/sequences/render.js';

function entry(overrides) {
    return {
        id: 'seq-1',
        eventId: 'ce-1',
        team: 'FIRE',
        entryType: 'CE',
        quarter: 'Q2',
        timeMs: 20000,
        matchClock: '00:20',
        seekSeconds: 12,
        originType: 'Counter',
        ...overrides
    };
}

function gameWith(events, extra = {}) {
    return {
        id: 'game-1',
        name: 'FIRE vs TIGERS',
        videoUrl: 'https://cdn.example.com/fire.mp4',
        events,
        ...extra
    };
}

describe('sequence cutlist', () => {
    test('exports one clip from the row start through the entry plus stored post-roll', () => {
        const cutlist = buildSequenceCutlist(
            gameWith([{ id: 'ce-1', event: 'CE', lag: 10 }]),
            [entry()]
        );

        expect(cutlist.version).toBe(1);
        expect(cutlist.playlistId).toBe('sequences');
        expect(cutlist.playlistName).toBe('Sequences');
        expect(cutlist.videoSource).toBe('https://cdn.example.com/fire.mp4');
        expect(cutlist.clipCount).toBe(1);
        expect(cutlist.clips[0]).toMatchObject({
            index: 1,
            eventId: 'ce-1',
            quarter: 'Q2',
            matchTime: '00:20',
            team: 'FIRE',
            code: 'CE',
            label: 'Counter',
            startSec: 12,
            endSec: 30,
            durationSec: 18
        });
        expect(cutlist.clips[0].overlayText).toBe('Q2 00:20 · FIRE · CE (Counter)');
        expect(buildCutlistDownloadFilename(cutlist)).toBe('fire-vs-tigers-sequences-cutlist.json');
    });

    test('uses 10 seconds after a circle or 25m entry when lag was not stored', () => {
        const game = gameWith([
            { id: 'ce-1', event: 'CE' },
            { id: 'a25-1', event: 'A25E' }
        ]);
        const cutlist = buildSequenceCutlist(game, [
            entry({ id: 'seq-ce', eventId: 'ce-1', timeMs: 20000, seekSeconds: 12 }),
            entry({
                id: 'seq-a25',
                eventId: 'a25-1',
                entryType: 'A25E',
                timeMs: 40000,
                seekSeconds: 30,
                originType: 'Build-Up',
                matchClock: '00:40'
            })
        ]);

        expect(cutlist.clips.map((clip) => [clip.code, clip.endSec])).toEqual([
            ['CE', 30],
            ['A25E', 50]
        ]);
    });

    test('uses 5 seconds of post-roll for any other code without a stored lag', () => {
        const cutlist = buildSequenceCutlist(gameWith([]), [
            entry({ entryType: 'SHOT', eventId: 'shot-1', timeMs: 10000, seekSeconds: 5, originType: 'Build-Up' })
        ]);
        expect(cutlist.clips[0].endSec).toBe(15);
    });

    test('never ends a clip before its start', () => {
        const cutlist = buildSequenceCutlist(
            gameWith([{ id: 'ce-1', lag: 5 }]),
            [entry({ seekSeconds: 100, timeMs: 1000 })]
        );
        expect(cutlist.clips[0].startSec).toBe(100);
        expect(cutlist.clips[0].endSec).toBe(100);
        expect(cutlist.clips[0].durationSec).toBe(0);
    });

    test('exports ticked sequences in match order under Selected sequences', () => {
        const cutlist = buildSequenceCutlist(gameWith([]), [
            entry({ id: 'later', eventId: 'b', timeMs: 50000, seekSeconds: 40, matchClock: '00:50' }),
            entry({ id: 'earlier', eventId: 'a', timeMs: 10000, seekSeconds: 2, matchClock: '00:10' }),
            entry({ id: 'skipped', eventId: 'c', timeMs: 30000 })
        ], { selectedIds: ['later', 'earlier'] });

        expect(cutlist.playlistName).toBe('Selected sequences');
        expect(cutlist.clipCount).toBe(2);
        expect(cutlist.clips.map((clip) => clip.eventId)).toEqual(['a', 'b']);
        expect(buildCutlistDownloadFilename(cutlist)).toMatch(/-selected-sequences-cutlist\.json$/);
    });

    test('exports the current lens and names the file from those filters', () => {
        const cutlist = buildSequenceCutlist(gameWith([]), [
            entry({ id: 'keep', team: 'FIRE', entryType: 'CE', originType: 'Counter' }),
            entry({ id: 'other-team', team: 'TIGERS', entryType: 'CE', originType: 'Counter', eventId: 'tigers' }),
            entry({ id: 'build', team: 'FIRE', entryType: 'CE', originType: 'Build-Up', eventId: 'build' }),
            entry({ id: 'a25', team: 'FIRE', entryType: 'A25E', originType: 'Counter', eventId: 'a25' })
        ], {
            filter: { team: 'FIRE', entryType: 'CE', originType: 'Counter' }
        });

        expect(cutlist.playlistName).toBe('FIRE Circle Entries Counter');
        expect(cutlist.clips.map((clip) => clip.eventId)).toEqual(['ce-1']);
        expect(buildCutlistDownloadFilename(cutlist)).toBe(
            'fire-vs-tigers-fire-circle-entries-counter-cutlist.json'
        );
    });

    test('returns no clips for an empty selection or an empty shown set', () => {
        const game = gameWith([]);
        const entries = [entry()];
        expect(buildSequenceCutlist(game, entries, { selectedIds: ['missing'] }).clipCount).toBe(0);
        expect(buildSequenceCutlist(game, entries, {
            filter: { team: 'TIGERS', entryType: 'all', originType: 'all' }
        }).clipCount).toBe(0);
        expect(buildSequenceCutlist(game, []).clipCount).toBe(0);
    });

    test('uses the seek time the sequence row already shows', () => {
        const events = [
            { id: 'bw', event: 'BW1', team: 'FIRE', quarter: 'Q1', timeMs: 20000, lead: 5 },
            { id: 'ce', event: 'CE', team: 'FIRE', quarter: 'Q1', timeMs: 28000, lag: 10 }
        ];
        const game = gameWith(events);
        const result = buildSequences(events, { teams: ['FIRE', 'TIGERS'] });
        const cutlist = buildSequenceCutlist(game, result.entries);

        expect(result.entries[0].seekSeconds).toBe(10);
        expect(cutlist.clips[0].startSec).toBe(10);
        expect(cutlist.clips[0].endSec).toBe(38);
        expect(cutlist.clips[0].code).toBe('CE');
    });
});

describe('sequence export controls', () => {
    function sampleMatch() {
        const events = [
            { id: 'f-bw', event: 'BW1', team: 'FIRE', quarter: 'Q1', timeMs: 10000 },
            { id: 'f-ce', event: 'CE', team: 'FIRE', quarter: 'Q1', timeMs: 18000, lag: 10 },
            { id: 't-ce', event: 'CE', team: 'TIGERS', quarter: 'Q2', timeMs: 40000 },
            { id: 'f-a25', event: 'A25E', team: 'FIRE', quarter: 'Q2', timeMs: 80000 }
        ];
        const game = gameWith(events, { id: 'sample', title: 'FIRE vs TIGERS' });
        const result = buildSequences(events, { teams: ['FIRE', 'TIGERS'] });
        return { game, result };
    }

    function clickControl(text) {
        const button = [...document.querySelectorAll('button')].find((node) => node.textContent.includes(text));
        expect(button).toBeDefined();
        button.click();
        return button;
    }

    function installDownloadSpy() {
        const downloads = [];
        URL.createObjectURL = jest.fn(() => 'blob:cutlist');
        URL.revokeObjectURL = jest.fn();
        const realCreate = document.createElement.bind(document);
        jest.spyOn(document, 'createElement').mockImplementation((tag) => {
            const element = realCreate(tag);
            if (tag === 'a') {
                element.click = () => downloads.push(element.download);
            }
            return element;
        });
        return downloads;
    }

    afterEach(() => {
        jest.restoreAllMocks();
        document.body.innerHTML = '';
    });

    test('exports the shown filter, then only the ticked rows, and clear restores shown', () => {
        const { game, result } = sampleMatch();
        const report = document.createElement('div');
        document.body.append(report);
        renderReport(report, game, result);
        const downloads = installDownloadSpy();

        expect(report.textContent).toContain('Export shown (3)');
        expect(document.getElementById('clear-sequence-selection').classList.contains('hidden')).toBe(true);

        clickControl('FIRE');
        clickControl('Circle Entries (CE)');
        clickControl('⚡ Counter');
        expect(report.textContent).toContain('Export shown (1)');

        document.getElementById('export-sequences-btn').click();
        expect(downloads).toEqual(['fire-vs-tigers-fire-circle-entries-counter-cutlist.json']);
        expect(document.getElementById('sequence-export-status').textContent).toBe('Exported 1 clip');

        clickControl('Clear filters');
        const toggles = () => [...document.querySelectorAll('.sequence-export-toggle')];
        const rows = () => [...document.querySelectorAll('.entry-row')];
        expect(rows()[0].className).toContain('ring-2');
        toggles()[1].click();
        expect(rows()[1].className).not.toContain('ring-2');
        expect(rows()[0].className).toContain('ring-2');
        toggles()[0].click();
        expect(document.getElementById('export-sequences-btn').textContent).toContain('Export selected (2)');

        clickControl('TIGERS');
        expect(document.getElementById('export-sequences-btn').textContent).toContain('Export selected (2)');
        document.getElementById('export-sequences-btn').click();
        expect(downloads[1]).toBe('fire-vs-tigers-selected-sequences-cutlist.json');
        expect(document.getElementById('sequence-export-status').textContent).toBe('Exported 2 clips');

        document.getElementById('clear-sequence-selection').click();
        expect(document.getElementById('export-sequences-btn').textContent).toContain('Export shown');
        expect(document.getElementById('clear-sequence-selection').classList.contains('hidden')).toBe(true);
    });

    test('places the export control in the page header when that bar is on the page', () => {
        const { game, result } = sampleMatch();
        document.body.innerHTML = '<div id="sequence-export-bar"></div><div id="report"></div>';
        renderReport(document.getElementById('report'), game, result);

        const bar = document.getElementById('sequence-export-bar');
        expect(bar.querySelector('#export-sequences-btn').textContent).toContain('Export shown (3)');
        expect(document.getElementById('report').querySelector('#export-sequences-btn')).toBeNull();
        expect(document.getElementById('report').textContent).toContain('Showing 3 of 3 entries');
    });

    test('hides export when the filter matches nothing and when the match has no entries', () => {
        const { game, result } = sampleMatch();
        const report = document.createElement('div');
        document.body.append(report);
        renderReport(report, game, result);

        clickControl('FIRE');
        clickControl('Circle Entries (CE)');
        clickControl('🛡️ Build-Up');
        expect(report.textContent).toContain('No matching entries');
        expect(document.getElementById('export-sequences-btn')).toBeNull();

        const quiet = document.createElement('div');
        renderReport(quiet, gameWith([{ id: '1', event: 'BS1', timeMs: 1000 }]), { entries: [], stats: {} });
        expect(quiet.textContent).toContain('No attacking entries');
        expect(quiet.querySelector('#export-sequences-btn')).toBeNull();
    });
});

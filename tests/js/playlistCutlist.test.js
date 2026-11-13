import {
    buildPlaylistCutlist,
    buildCutlistDownloadFilename,
    buildClipOverlayText,
    buildClipFilename
} from '../../src/js/playlistCutlist.js';

describe('playlistCutlist', () => {
    const sampleGame = {
        id: 'game-123',
        title: 'FIRE vs TIGERS',
        videoUrl: 'https://cdn.example.com/fire-vs-tigers.mp4',
        events: [
            {
                id: 'evt-2',
                event: 'SHOT',
                team: 'FIRE',
                quarter: 'Q2',
                timeMs: 1425000,
                timestamp: '08:45',
                lead: 6,
                lag: 4,
                isFavorite: true,
                labels: [{ group: 'Outcome', text: 'On Target' }]
            },
            {
                id: 'evt-1',
                event: 'CE',
                team: 'FIRE',
                quarter: 'Q1',
                timeMs: 3000,
                timestamp: '00:03',
                lead: 8,
                lag: 5,
                isFavorite: true,
                labels: [{ group: 'Flank', text: 'Left' }]
            },
            {
                id: 'evt-3',
                event: 'PC',
                team: 'TIGERS',
                quarter: 'Q3',
                timeMs: 2100000,
                timestamp: '05:00',
                isFavorite: false
            }
        ],
        metadata: {
            playlists: [
                {
                    id: 'pl-attack',
                    name: 'Circle Entries & Shots',
                    eventIds: ['evt-1', 'evt-2']
                }
            ]
        }
    };

    test('builds a chronological cutlist for Favorites with clamped lead/lag windows', () => {
        const cutlist = buildPlaylistCutlist(sampleGame, 'favorites');

        expect(cutlist.version).toBe(1);
        expect(cutlist.gameId).toBe('game-123');
        expect(cutlist.gameTitle).toBe('FIRE vs TIGERS');
        expect(cutlist.playlistId).toBe('favorites');
        expect(cutlist.playlistName).toBe('Favorites');
        expect(cutlist.videoSource).toBe('https://cdn.example.com/fire-vs-tigers.mp4');
        expect(cutlist.clipCount).toBe(2);

        // evt-1 (timeMs 3000) comes before evt-2 (timeMs 1425000)
        expect(cutlist.clips[0]).toMatchObject({
            index: 1,
            eventId: 'evt-1',
            quarter: 'Q1',
            matchTime: '00:03',
            team: 'FIRE',
            code: 'CE',
            label: 'Left',
            startSec: 0, // 3 - 8 clamped to 0
            endSec: 8,   // 3 + 5
            durationSec: 8,
            overlayText: 'Q1 00:03 · FIRE · CE (Left)',
            filename: '01_Q1_00m03s_FIRE_CE_Left.mp4'
        });

        expect(cutlist.clips[1]).toMatchObject({
            index: 2,
            eventId: 'evt-2',
            quarter: 'Q2',
            matchTime: '08:45',
            team: 'FIRE',
            code: 'SHOT',
            label: 'On Target',
            startSec: 1419, // 1425 - 6
            endSec: 1429,   // 1425 + 4
            durationSec: 10,
            overlayText: 'Q2 08:45 · FIRE · SHOT (On Target)',
            filename: '02_Q2_08m45s_FIRE_SHOT_On_Target.mp4'
        });
    });

    test('builds a cutlist for a custom named playlist and respects videoSource override', () => {
        const cutlist = buildPlaylistCutlist(sampleGame, 'pl-attack', {
            videoSource: 'local-match.mp4'
        });

        expect(cutlist.playlistId).toBe('pl-attack');
        expect(cutlist.playlistName).toBe('Circle Entries & Shots');
        expect(cutlist.videoSource).toBe('local-match.mp4');
        expect(cutlist.clipCount).toBe(2);
    });

    test('returns empty clips array when playlist has no matching events', () => {
        const cutlist = buildPlaylistCutlist({ id: 'g1', events: [] }, 'favorites');
        expect(cutlist.clipCount).toBe(0);
        expect(cutlist.clips).toEqual([]);
    });

    test('formats overlay text cleanly when optional fields are missing', () => {
        expect(buildClipOverlayText({
            quarter: '',
            matchTime: '12:00',
            team: '',
            code: 'PC',
            label: ''
        })).toBe('12:00 · PC');
    });

    test('formats safe filenames for clips and cutlist downloads', () => {
        expect(buildClipFilename({
            index: 3,
            quarter: 'Q4',
            matchTime: '14:22',
            team: 'Cobras H1M',
            code: 'A25E',
            label: 'Left / Baseline'
        })).toBe('03_Q4_14m22s_Cobras_H1M_A25E_Left_Baseline.mp4');

        expect(buildCutlistDownloadFilename({
            gameTitle: 'FIRE vs TIGERS',
            playlistName: 'Circle Entries & Shots'
        })).toBe('fire-vs-tigers-circle-entries-shots-cutlist.json');
    });
});

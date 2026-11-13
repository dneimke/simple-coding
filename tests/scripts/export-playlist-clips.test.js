import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    parseArgs,
    escapeDrawtext,
    buildClipFfmpegArgs,
    buildReelFilename,
    exportPlaylistClips
} from '../../scripts/export-playlist-clips.js';

describe('export-playlist-clips', () => {
    test('escapes FFmpeg drawtext special characters cleanly', () => {
        expect(escapeDrawtext("Q2 08:45 · FIRE · 100% Coach's Note"))
            .toBe("Q2 08\\:45 · FIRE · 100\\% Coach\\'s Note");
    });

    test('parses CLI arguments with defaults and flags', () => {
        const opts = parseArgs(['cutlist.json', 'match.mp4', '--mode', 'reel', '--height', '1080', '--no-overlay', '--dry-run']);
        expect(opts.mode).toBe('reel');
        expect(opts.height).toBe(1080);
        expect(opts.overlay).toBe(false);
        expect(opts.dryRun).toBe(true);
        expect(opts.cutlistPath.endsWith('cutlist.json')).toBe(true);
        expect(opts.videoPath.endsWith('match.mp4')).toBe(true);
    });

    test('builds WhatsApp-ready H.264 ffmpeg args with drawtext overlay', () => {
        const args = buildClipFfmpegArgs({
            videoPath: '/tmp/match.mp4',
            outputPath: '/tmp/clip1.mp4',
            clip: {
                startSec: 120.5,
                endSec: 130.5,
                overlayText: 'Q2 02:00 · FIRE · CE (Left)'
            },
            height: 720,
            overlay: true
        });

        expect(args).toContain('-ss');
        expect(args).toContain('120.5');
        expect(args).toContain('-t');
        expect(args).toContain('10');
        expect(args).toContain('libx264');
        expect(args).toContain('veryfast');
        expect(args).toContain('+faststart');

        const vfIndex = args.indexOf('-vf');
        expect(vfIndex).toBeGreaterThan(-1);
        expect(args[vfIndex + 1]).toContain('scale=-2:720');
        expect(args[vfIndex + 1]).toContain("drawtext=text='Q2 02\\:00 · FIRE · CE (Left)'");
    });

    test('dry-run generates clip and reel commands without executing ffmpeg', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cutlist-test-'));
        const cutlistPath = path.join(tmpDir, 'cutlist.json');
        const videoPath = path.join(tmpDir, 'match.mp4');

        fs.writeFileSync(videoPath, 'stub-mp4');
        fs.writeFileSync(cutlistPath, JSON.stringify({
            gameTitle: 'FIRE vs TIGERS',
            playlistName: 'Circle Entries',
            clips: [
                { index: 1, startSec: 1, endSec: 4, overlayText: 'Q1 00:01 · CE', filename: '01_Q1_CE.mp4' },
                { index: 2, startSec: 5, endSec: 9, overlayText: 'Q1 00:05 · SHOT', filename: '02_Q1_SHOT.mp4' }
            ]
        }));

        try {
            const clipsRes = exportPlaylistClips({
                cutlistPath,
                videoPath,
                mode: 'clips',
                outDir: path.join(tmpDir, 'out-clips'),
                dryRun: true
            });
            expect(clipsRes.outputs).toHaveLength(2);
            expect(clipsRes.commands).toHaveLength(2);

            const reelRes = exportPlaylistClips({
                cutlistPath,
                videoPath,
                mode: 'reel',
                outDir: path.join(tmpDir, 'out-reel'),
                dryRun: true
            });
            expect(reelRes.outputs).toEqual([
                path.join(tmpDir, 'out-reel', 'fire-vs-tigers-circle-entries-reel.mp4')
            ]);
            // 2 clip encodes + 1 concat command
            expect(reelRes.commands).toHaveLength(3);
            expect(buildReelFilename({ gameTitle: 'FIRE vs TIGERS', playlistName: 'Favorites' }))
                .toBe('fire-vs-tigers-favorites-reel.mp4');
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });
});

#!/usr/bin/env node
/**
 * Playlist Clip Exporter (Friction 3: Post-match assembly overhead)
 * Reads a Cutlist JSON exported from simple-coding and renders WhatsApp-ready
 * H.264 MP4 clips (or a single stitched highlight reel) via ffmpeg.
 *
 * Usage:
 *   node scripts/export-playlist-clips.js <cutlist.json> <video.mp4> [options]
 *
 * Options:
 *   --mode <clips|reel>   Export individual clips (default) or a stitched reel
 *   --out-dir <dir>       Output directory (default: ./out/clips)
 *   --height <720|1080>   Output video height (default: 720)
 *   --no-overlay          Disable burned-in event context text
 *   --dry-run             Print ffmpeg commands without executing
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

/**
 * Escapes text for FFmpeg's drawtext filter.
 * @param {string} text
 * @returns {string}
 */
export function escapeDrawtext(text) {
    return String(text || '')
        .replace(/\\/g, '\\\\')
        .replace(/:/g, '\\:')
        .replace(/'/g, "\\'")
        .replace(/%/g, '\\%');
}

function parseModeFlag(val) {
    const normalized = String(val || '').toLowerCase();
    if (normalized !== 'clips' && normalized !== 'reel') {
        throw new Error(`Invalid --mode "${val}". Expected "clips" or "reel".`);
    }
    return normalized;
}

function parseHeightFlag(val) {
    const parsed = Number(val);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --height "${val}".`);
    }
    return Math.round(parsed);
}

/**
 * Parses CLI arguments into structured options.
 * @param {string[]} argv
 * @returns {{
 *   cutlistPath: string,
 *   videoPath: string,
 *   mode: 'clips' | 'reel',
 *   outDir: string,
 *   height: number,
 *   overlay: boolean,
 *   dryRun: boolean
 * }}
 */
export function parseArgs(argv) {
    const positional = [];
    const state = {
        mode: /** @type {'clips' | 'reel'} */ ('clips'),
        outDir: path.resolve(process.cwd(), 'out', 'clips'),
        height: 720,
        overlay: true,
        dryRun: false
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--mode') state.mode = parseModeFlag(argv[++i]);
        else if (arg === '--out-dir') state.outDir = path.resolve(argv[++i] || '');
        else if (arg === '--height') state.height = parseHeightFlag(argv[++i]);
        else if (arg === '--no-overlay') state.overlay = false;
        else if (arg === '--dry-run') state.dryRun = true;
        else if (!arg.startsWith('--')) positional.push(arg);
    }

    return {
        cutlistPath: positional[0] ? path.resolve(positional[0]) : '',
        videoPath: positional[1] ? path.resolve(positional[1]) : '',
        ...state
    };
}

/**
 * Builds the FFmpeg argument list for rendering a single cutlist clip.
 * Uses fast input seeking (-ss before -i) + re-encode for frame-accurate, WhatsApp-ready MP4s.
 *
 * @param {{
 *   videoPath: string,
 *   outputPath: string,
 *   clip: { startSec: number, endSec: number, overlayText?: string },
 *   height?: number,
 *   overlay?: boolean
 * }} params
 * @returns {string[]}
 */
export function buildClipFfmpegArgs({ videoPath, outputPath, clip, height = 720, overlay = true }) {
    const startSec = Math.max(0, Number(clip?.startSec) || 0);
    const endSec = Math.max(startSec, Number(clip?.endSec) || 0);
    const durationSec = Math.max(0.1, Math.round((endSec - startSec) * 1000) / 1000);

    const vfParts = [`scale=-2:${height}`];
    if (overlay && clip?.overlayText) {
        const escaped = escapeDrawtext(clip.overlayText);
        const fontSize = Math.max(18, Math.round(height * 0.032));
        vfParts.push(
            `drawtext=text='${escaped}':x=24:y=h-th-24:fontsize=${fontSize}:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=10`
        );
    }

    return [
        '-y',
        '-ss', String(startSec),
        '-i', videoPath,
        '-t', String(durationSec),
        '-vf', vfParts.join(','),
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        outputPath
    ];
}

/**
 * Builds a slugified reel filename from cutlist metadata.
 * @param {{ gameTitle?: string, playlistName?: string }} cutlist
 * @returns {string}
 */
export function buildReelFilename(cutlist) {
    const slugify = (str, fallback) => {
        const cleaned = String(str || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return cleaned || fallback;
    };
    return `${slugify(cutlist?.gameTitle, 'match')}-${slugify(cutlist?.playlistName, 'playlist')}-reel.mp4`;
}

function loadValidatedCutlist(cutlistPath, videoPath) {
    if (!cutlistPath || !fs.existsSync(cutlistPath)) {
        throw new Error(`Cutlist JSON not found: ${cutlistPath || '(missing)'}`);
    }
    if (!videoPath || !fs.existsSync(videoPath)) {
        throw new Error(`Source video not found: ${videoPath || '(missing)'}`);
    }
    const cutlist = JSON.parse(fs.readFileSync(cutlistPath, 'utf8'));
    const clips = Array.isArray(cutlist?.clips) ? cutlist.clips : [];
    if (clips.length === 0) {
        throw new Error('Cutlist contains 0 clips. Add events to the playlist before exporting.');
    }
    return { cutlist, clips };
}

function runFfmpegIfLive(args, dryRun) {
    if (!dryRun) {
        execFileSync('ffmpeg', args, { stdio: 'inherit' });
    }
}

function exportIndividualClips({ clips, videoPath, outDir, height, overlay, dryRun }) {
    const commands = [];
    const outputs = [];
    clips.forEach((clip, i) => {
        const filename = clip.filename || `clip_${String(i + 1).padStart(2, '0')}.mp4`;
        const outputPath = path.join(outDir, filename);
        const args = buildClipFfmpegArgs({ videoPath, outputPath, clip, height, overlay });
        commands.push(args);
        outputs.push(outputPath);
        runFfmpegIfLive(args, dryRun);
    });
    return { outputs, commands };
}

function exportStitchedReel({ cutlist, clips, videoPath, outDir, height, overlay, dryRun }) {
    const tempDir = dryRun
        ? path.join(os.tmpdir(), 'playlist-reel-dryrun')
        : fs.mkdtempSync(path.join(os.tmpdir(), 'playlist-reel-'));
    const commands = [];
    const tempFiles = [];

    try {
        clips.forEach((clip, i) => {
            const tempClipPath = path.join(tempDir, `part_${String(i + 1).padStart(3, '0')}.mp4`);
            const args = buildClipFfmpegArgs({ videoPath, outputPath: tempClipPath, clip, height, overlay });
            commands.push(args);
            tempFiles.push(tempClipPath);
            runFfmpegIfLive(args, dryRun);
        });

        const concatListPath = path.join(tempDir, 'concat.txt');
        const concatBody = tempFiles.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join('\n');
        const reelPath = path.join(outDir, buildReelFilename(cutlist));
        const concatArgs = [
            '-y',
            '-f', 'concat',
            '-safe', '0',
            '-i', concatListPath,
            '-c', 'copy',
            '-movflags', '+faststart',
            reelPath
        ];
        commands.push(concatArgs);

        if (!dryRun) {
            fs.writeFileSync(concatListPath, concatBody, 'utf8');
            execFileSync('ffmpeg', concatArgs, { stdio: 'inherit' });
        }

        return { outputs: [reelPath], commands };
    } finally {
        if (!dryRun && fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    }
}

/**
 * Executes playlist clip export.
 * @param {{
 *   cutlistPath: string,
 *   videoPath: string,
 *   mode?: 'clips' | 'reel',
 *   outDir?: string,
 *   height?: number,
 *   overlay?: boolean,
 *   dryRun?: boolean
 * }} options
 * @returns {{ mode: string, outDir: string, outputs: string[], commands: string[][] }}
 */
export function exportPlaylistClips(options) {
    const {
        cutlistPath,
        videoPath,
        mode = 'clips',
        outDir = path.resolve(process.cwd(), 'out', 'clips'),
        height = 720,
        overlay = true,
        dryRun = false
    } = options;

    const { cutlist, clips } = loadValidatedCutlist(cutlistPath, videoPath);
    if (!dryRun) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    const res = mode === 'reel'
        ? exportStitchedReel({ cutlist, clips, videoPath, outDir, height, overlay, dryRun })
        : exportIndividualClips({ clips, videoPath, outDir, height, overlay, dryRun });

    return { mode, outDir, ...res };
}

const isCliEntry = Boolean(process.argv[1]) && path.basename(process.argv[1]) === 'export-playlist-clips.js';
if (isCliEntry) {
    try {
        const opts = parseArgs(process.argv.slice(2));
        if (!opts.cutlistPath || !opts.videoPath) {
            console.error('Usage: node scripts/export-playlist-clips.js <cutlist.json> <video.mp4> [--mode clips|reel] [--out-dir <dir>] [--height 720|1080] [--no-overlay] [--dry-run]');
            process.exit(1);
        }
        const res = exportPlaylistClips(opts);
        console.log(`\nExported ${res.outputs.length} file(s) (${res.mode} mode) to ${res.outDir}:`);
        res.outputs.forEach((out) => console.log(`  - ${out}`));
    } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    }
}

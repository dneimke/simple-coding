---
name: playlist-clip-exporter
description: >-
  Generates WhatsApp/Slack-ready H.264 MP4 clips or a stitched highlight reel
  from a simple-coding Playlist Cutlist JSON and a local match MP4 using ffmpeg.
  Use when the user exports a playlist cutlist or asks to render shareable
  video clips from coded match events.
---

# Playlist Clip Exporter

Converts a `simple-coding` Playlist Cutlist JSON (exported from Match Review in `timeline-video.html`) and a match MP4 recording into shareable, WhatsApp-ready H.264 MP4 clips or a single stitched highlight reel.

## Product Gate Adherence

- **Friction 3 (Post-match assembly overhead):** Eliminates manual NLE scrubbing, in/out point sizing, and 45-minute export workflows by consuming pre-baked `lead`/`lag` and video-aligned timestamps directly from the match playlist.
- **Invariant 2 (Zero-render presentation):** In-browser Presentation Mode remains the primary zero-render review path; this skill serves offline/chat sharing channels (WhatsApp, Slack, TeamApp) that require standalone `.mp4` files.

## Tooling & CLI Usage

Implemented in [`scripts/export-playlist-clips.js`](file:///scripts/export-playlist-clips.js) and verified via [`tests/scripts/export-playlist-clips.test.js`](file:///tests/scripts/export-playlist-clips.test.js).

```bash
node scripts/export-playlist-clips.js "<cutlist.json>" "<match-video.mp4>" [options]
```

### Options
- `--mode <clips|reel>`: `clips` (default) outputs one numbered MP4 per event; `reel` stitches all clips into a single highlight MP4.
- `--out-dir <dir>`: Output directory (default: `./out/clips`).
- `--height <720|1080>`: Target vertical resolution (default: `720` for fast, WhatsApp-friendly file sizes).
- `--no-overlay`: Omit the burned-in bottom-left event context pill (`Q2 08:45 · FIRE · CE (Left)`).
- `--dry-run`: Print/inspect generated FFmpeg commands without encoding.

### Examples

Individual WhatsApp clips:
```bash
node scripts/export-playlist-clips.js ~/Downloads/fire-vs-tigers-favorites-cutlist.json ~/Videos/fire-vs-tigers.mp4 --mode clips --out-dir ./out/clips
```

Single stitched highlight reel at 1080p:
```bash
node scripts/export-playlist-clips.js ~/Downloads/fire-vs-tigers-circle-entries-cutlist.json ~/Videos/fire-vs-tigers.mp4 --mode reel --height 1080 --out-dir ./out/reels
```

## Execution Protocol

1. **Verify Inputs:** Confirm both `<cutlist.json>` and `<match-video.mp4>` exist locally, and check `ffmpeg` is available (`which ffmpeg`).
2. **Run Exporter:** Execute `scripts/export-playlist-clips.js` with `--mode clips` or `--mode reel` as requested.
3. **Report Outputs:** List the generated `.mp4` paths and file sizes so the user can drop them straight into WhatsApp, Slack, or TeamApp.

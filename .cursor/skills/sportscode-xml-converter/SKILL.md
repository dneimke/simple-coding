---
name: sportscode-xml-converter
description: >-
  Ingests raw or third-party Sportscode XML files (e.g., Hudl Sportscode matrix
  coding, state league match exports) and normalizes them into canonical match
  events, Sportscode XML, match JSON, and sequence attack reports. Use when the
  user uploads or asks to convert an external XML file to our standard format.
---

# Sportscode XML Converter

Ingests raw or third-party Sportscode XML event streams (`<ALL_INSTANCES>`) and converts them into canonical `simple-coding` match events, ready for playback in Match Review (`timeline-video.html`), sequence classification (`spikes/sequences/`), and clean roundtrip Sportscode XML export.

## Product Gate Adherence

- **Friction 1 (Game Setup Divergence):** Eliminates setup drag and manual re-tagging when moving between external Hudl matrices and `simple-coding`. Teams and timestamps are parsed into a unified schema.
- **Persona 1 (Dedicated Analyst):** Ingests high-density match exports across back-to-back matches, preserving accurate `lead`/`lag` clip envelopes and XML fidelity without data loss.

## When to Use

- When the user uploads or attaches an `.xml` file and asks to convert it to "our format" or "our standard coding scheme".
- When ingesting external match footage coded in Hudl Sportscode, MyVA, or third-party button boards into the sequence classification spike or timeline video player.
- When cleaning up noisy raw matrix exports (removing spatial bounding boxes, continuous duration spans, and defensive mirrors).

## Tooling & Architecture

The primary conversion engine is implemented in [`scripts/convert-sportscode-xml.js`](file:///scripts/convert-sportscode-xml.js) and verified via [`tests/scripts/convert-sportscode-xml.test.js`](file:///tests/scripts/convert-sportscode-xml.test.js).

### CLI Usage

```bash
node scripts/convert-sportscode-xml.js "<path-to-input.xml>" --name "<match-slug>" [--out-dir "<output-dir>"] [--map-team "FROM:TO,FROM2:TO2"]
```

Example:
```bash
node scripts/convert-sportscode-xml.js "path/to/h1m-cobras-v-fire.xml" --name "h1m-cobras-v-fire"
```

### Outputs Produced

1. **Sportscode XML (`<name>-converted.xml`):** Canonical XML with `<ALL_INSTANCES>` and `<ROWS>`, sized with appropriate `lead`/`lag` windows per event type.
2. **Match JSON (`<name>-converted.json`):** Clean event array with millisecond-precision timestamps (`timeMs`), quarter tags, channel labels, and team assignments.
3. **Sequence Report (`<name>-sequences.md`):** Full breakdown of attacking 25m entries (`A25E`) and circle entries (`CE`) categorized as Counter vs. Build-Up via [`spikes/sequences/engine.js`](file:///src/spike/sequences/engine.js).

## Normalization & Mapping Rules

| Raw Code / Pattern | Normalized Event | Heuristics & Handling |
| :--- | :--- | :--- |
| **`Q1`–`Q4`**, `QUARTER 1`–`4`, `START` | `Q1`–`Q4` | Quarter markers with 1s lead/lag. |
| **`QTR WHISTLE`** (6 whistles) | `Q1`–`Q4` | Pushback whistles extracted at indices `[0, 1, 3, 4]` (skipping halftime whistle at `[2]` and match end whistle at `[5]`). |
| **`CIRCLE ENTRY`**, `CE`, `AC Entry` | `[TEAM] CE` | Channel direction (`Left`, `Center`, `Right`) extracted from instance labels or nearby short codes (`LF`/`LFE`, `CT`/`CTE`, `RT`/`RTE`). Sized with 10s lead / 10s lag. |
| **`A25 ENTRY`**, `A25E`, `25yd Entry` | `[TEAM] A25E` | Attacking 25m entry. Sized with 10s lead / 10s lag. |
| **`GAINED POS`**, `BW`, `REGAIN`, `Steal` | `[TEAM] BW[1-4]` | Turnovers mapped using first zone label present (`D30`/`D25` $\rightarrow$ `1`, `D50` $\rightarrow$ `2`, `A50` $\rightarrow$ `3`, `A25` $\rightarrow$ `4`). For Hudl `GAINED POS`, a 6.0s lead compensation is added to pin the exact moment possession was won. Sized with 5s lead / 5s lag. |
| **`FREE HIT`**, `OUTLET`, `LONG CORNER`, `BS` | `[TEAM] BS` | Restarts and controlled build-up restarts. Sized with 10s lead / 10s lag. |
| **`OVERHEAD BP`**, `OH`, `Overhead` | `[TEAM] OH` | Aerial overheads. Sized with 10s lead / 10s lag. |
| **`PC WON`**, `PCA WON`, `PCA`, `PC`, `ASC` | `[TEAM] PC` | Penalty corners won. Deduplicated within 3 seconds. Sized with 10s lead / 10s lag. |
| **`PS WON`**, `PS` | `[TEAM] PS` | Penalty stroke awards. Sized with 10s lead / 10s lag. |
| **`SHOTS`**, `GSO`, `Field Shot`, `PCA Shot` | `[TEAM] SHOT` | Goal-scoring opportunities and shots on goal. Deduplicated within 2.5 seconds. Sized with 10s lead / 10s lag. |
| **`GOAL`** | `[TEAM] GOAL` | Labeled with `{ group: 'Type', text: 'Field Goal' | 'Penalty Corner' | 'Shootout' }`. Sized with 10s lead / 10s lag. |
| **`SHOOTOUT`**, `1v1`, `SO` | `[TEAM] SO` | Shootout / 1v1 contests. Sized with 10s lead / 10s lag. |
| **`CARD`**, `GREEN`, `YELLOW`, `RED` | `[TEAM] CARD` | Disciplinary cards. Sized with 10s lead / 10s lag. |

### Excluded Administrative Noise

The converter automatically skips:
- Continuous possession spans (`POSSESSION`).
- Continuous pressing blocks (`PRESS`).
- Defensive mirror tags (`PCD`, `Against`, `Defence`).
- Standalone spatial boundary boxes (`D30`, `D50`, `A50`, `A25`, `AC`) that lack an `ENTRY` qualifier.
- Video container blocks (`FULL MATCH`, `QSW MATCH`, `Match Highlights`).

## Execution Protocol

1. **Locate or Extract the XML:** If uploaded as an attachment, obtain the absolute path (e.g. from `.user_uploaded/media_*.xml`).
2. **Execute Conversion Script:** Run `node scripts/convert-sportscode-xml.js "<path>" --name "<match-slug>"`.
3. **Verify Sequences:** Run `node spikes/sequences/run.js spikes/sequences/out/<match-slug>-converted.json` to verify attack chain classification and clock alignments.
4. **Copy Artifacts for the User:** Copy the generated files to the artifact directory so the user can download or inspect them.
5. **Present Scannable Summary:** Report the team names, total converted events, mapping highlights, and Counter vs. Build-Up attack stats with clickable `file:///` links.

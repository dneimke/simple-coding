---
name: match-report
description: >-
  Generates an interactive HTML match analytics dossier and executive coaching summary
  from a Sportscode XML file or game object. Use when the user attaches an XML file,
  requests a match report, or asks to analyze match statistics and momentum.
---

# Match Analytics Report Generator

Automates the production of standardized, interactive HTML match reports and executive tactical summaries from Sportscode XML files (`<ALL_INSTANCES>`) or saved match objects (`fieldHockeyGames_v1`).

## Product Gate & Purpose

Eliminates **Friction 3 (Post-match assembly overhead / review tax)** from `docs/core-friction-points.md`. Converts raw exported match XML into immediate, browser-native coaching telemetry (KPIs, quarter breakdowns, minute-by-minute momentum pressure curve, and filterable event streams) with zero external video slicing or manual spreadsheet calculations.

## When to Use

Use this skill whenever:
- The user attaches, links, or references a Sportscode XML file (e.g. `*.xml`) and asks for a match report, analysis, or statistics breakdown.
- The user asks to generate an executive report from a saved game in local storage or test fixture.
- A batch analysis or comparative match report is requested.

## Execution Workflow

### Step 1: Identify Input Source
Locate the target Sportscode XML file path:
- Uploaded file (e.g. `/home/antigravity/<file>.xml` or relative path).
- Or a game fixture (e.g. `src/assets/sample-game.xml`).

### Step 2: Generate the Standalone HTML Report
Use the repository's verified CLI generator:
```bash
npm run report -- <path-to-xml> [optional-output-path]
```
Or directly execute via Node:
```bash
node scripts/generate-match-report.js <path-to-xml> [optional-output-path]
```
Default output path is `reports/<basename>-report.html`.

### Step 3: Register Conversation Artifact (If in Antigravity / Agent Environment)
When operating in an agent environment with artifact support, copy or write the resulting HTML report into the conversation artifact directory (`<appDataDir>/brain/<conversation-id>/<filename>.html`) with `ArtifactMetadata` (`UserFacing: true`, `RequestFeedback: false`) so the user gets an interactive preview and download card.

### Step 4: Present Executive Match Summary in Chat
Provide a concise, high-signal executive coaching summary in chat:
1. **Match Snapshot:** Final score, competing teams (inferred automatically from codes), fixture date, and total logged events.
2. **Key Performance Indicators (KPIs) Table:**
   - Score
   - Shots on Goal & Shot Conversion
   - Penalty Corners (PCs)
   - Circle Entries (CE) & Conversion Rate
   - Attacking 25m Entries (A25E) & Penetration Rate
   - Ball Wins (Turnovers Won)
   - Build-Up: Zone 4 (Deep Attack) vs Zone 1 (Defensive Exits)
   - Disciplinary Cards (Green / Yellow)
3. **Core Tactical Takeaways:** 2–3 sharp coach bullet points explaining where the match was won/lost (e.g. defensive wall vs territorial siege, set piece flurries, card phases).
4. **Deliverable Link:** Provide a direct link to the generated interactive HTML report artifact.

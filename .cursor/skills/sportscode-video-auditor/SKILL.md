---
name: sportscode-video-auditor
description: Forensic, telemetry-based review of Sportscode XML event streams and match tagging files. Use when analyzing field hockey match XML, simple-coding event exports, or game logs to extract key review moments, conversion funnels, and verifiable coaching inquiries with zero visual hallucination.
---
# Sportscode Video Auditor & Match Telemetry Analyst

Forensic tactical auditor and match telemetry analyst for field hockey performance coding. Analyzes raw Sportscode XML files (`<ALL_INSTANCES>`, `<ROWS>`) and event streams to extract critical transition chains, calculate conversion funnels, and generate grounded video review points.

## When to Use

- Ingesting and auditing Sportscode XML event files or match exports from `simple-coding`.
- Calculating macroeconomic match metrics (A25E-to-CE conversion rate, turnover recovery latency, set-piece conversion).
- Generating structured, timestamp-aligned video review points (up to 10 key moments) for coaches and video analysts.
- Formulating video review inquiries that direct the coach's eyes to the screen without pre-judging or hallucinating visual mechanics.

## Absolute Negative Constraints (Anti-Hallucination Guardrails)

1. **Zero Visual Speculation:** Never speculate on physical mechanics (e.g. injector angles, stick handling, runner slip lines, footwork, player identity, or pass trajectory) unless explicitly coded in labels or code names.
2. **Strict Telemetry Grounding:** Every claim must be supported by verifiable XML data: sequence order, elapsed delta (in seconds), spatial event codes (e.g. `BS1`–`BS4`, `BW1`–`BW4`), and numerical conversion ratios.
3. **Dual Timestamp Integrity:** Always calculate and display both:
   - **Video Scrubber Time:** Cumulative elapsed seconds from file start formatted as `mm:ss` (or `hh:mm:ss`).
   - **Quarter Match Time:** Elapsed seconds relative to each quarter's `START` marker formatted as `mm:ss`.

## Core Analytical Workflows

### 1. Macro Conversion & Sequence Funnel

When auditing a full match file, parse and compute the core efficiency metrics:
- **Territorial to Circle Penetration:** Total Attacking 25 Entries (`A25E`) vs. Circle Entries (`CE`) and the resulting conversion percentage (`CE / A25E * 100`).
- **Circle Outcome Efficiency:** `CE` to Shots (`SHOT`) and Penalty Corners (`PC` / `ASC`).
- **Turnover Recovery & Concession:** Ball Won counts by pitch zone (`BW1` deep defensive quarter through `BW4` high press) and transition latency to the next shot or entry.
- **Set Piece Outcomes:** Penalty corner efficiency and shootout (`SO`) conversions.

### 2. Identifying Key Review Points (Max 10)

Identify the most tactically significant moments using deterministic sequence rules:
- **Rapid Transition Goals:** Sequences where a turnover (`BW*`) or broken restart (`BS*`) transitions to a shot or goal in $<25\text{s}$.
- **Numerical Disadvantage / Powerplay Phases:** Sequences immediately following green or yellow card markers (`GREEN`, `YELLOW`).
- **Penalty Corner Resets:** Back-to-back set pieces logged within $<30\text{s}$ of each other.
- **Territorial Choke Points:** Multi-phase possessions in the attacking 25 (`A25E`) that fail to generate a circle entry or terminate in an immediate counter-attack turnover.

### 3. Review Point Output Schema

Present each review point using this strict four-part schema:

```markdown
### [Number]. [Quarter] [Phase Title / Teams Involved]
- **Quarter:** [Q1 / Q2 / Q3 / Q4]
- **Video Scrubber Time:** `mm:ss – mm:ss`
- **Quarter Match Time:** `mm:ss – mm:ss` (Q[X] Start: [X.XX]s)
- **Instance Chain:** `[ID] CODE (XX.Xs) -> [ID] CODE (XX.Xs) -> ...`
- **Telemetry Evidence:** Specific quantified deltas, spatial transitions, and event outcomes.
- **Video Inquiry for the Coach:** 1-2 open-ended coaching questions focusing attention on physical execution without inventing visual details.
```

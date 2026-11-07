# Sequence spike

Classifies attacking 25m entries (`A25E`) and circle entries (`CE`) from a coded match as **Counter** or **Build-Up**. The trial page is served with the site at `/spike/sequences/`. Capture and match review do not use it.

On the deployed site, open **Sequence trial** from Matches, or go directly to `spike/sequences/`. Pick a match saved in that browser, upload an export, or open the sample.

The command-line check reads the same rules:

```bash
node spikes/sequences/check.js
node spikes/sequences/run.js src/spike/sequences/fixture.json --out spikes/sequences/out
node spikes/sequences/run.js path/to/saved-game.json --out spikes/sequences/out
node spikes/sequences/run.js path/to/sportscode.xml --out spikes/sequences/out
```

A saved match keeps each event's `timeMs`. A Sportscode export recovers event times with lead-in windows, applying a default 5-second pre-roll before the possession trigger so the video seek captures the turnover or restart setup.

## Current Rules

- **Target Entries Only:** Only attacking entries (`A25E` and `CE`) are emitted in the report. Isolated turnovers, restarts, cards, substitutions, and quarter markers provide chain context rather than standalone rows.
- **Attack Consolidation:** When an attack penetrates into the circle, `CE` supersedes `A25E` in the same possession chain. `A25E` is preserved in the breadcrumb sequence (`BW1 → A25E → CE`), while standalone `A25E` rows remain only for attacks that broke down before reaching the circle.
- **Possession Gap (25s):** A same-team possession window stays open while same-team tags occur within 25 seconds without an opponent tag or goal.
- **Counter-Attack (<10s):** An attack reached within 10 seconds of a same-team Ball Won (`BW`, `BW1`–`BW4`) in the active possession window.
- **Build-Up:** An attack originating from a restart (`BS1`–`BS4`, `OH`), a Ball Won taking longer than 10 seconds, or patient possession without an immediate prior turnover.
- **Seek Pre-Roll (5s):** Seeks land 5 seconds prior to the chain's opening trigger event (or instance start) to provide clear visual context for the turnover duel or restart.

## Feedback & Algorithm Evaluation Principles

1. **Analyze First:** When reviewing flagged clips, always inspect the raw underlying XML/JSON events first. An apparent classification or timing discrepancy may be a human tagging error (e.g., late button press, omitted event, mislabeled duel) rather than an algorithmic flaw.
2. **Generalize Over Overfitting:** Any tuning of possession windows, counter thresholds, or seek offsets must be generalized to hold up across any match dataset. Never hardcode or warp heuristics to satisfy a single edge-case clip if it degrades global accuracy.
3. **Accepting Real-World Boundaries:** Event-stream coding captures discrete moments, not continuous player tracking. We accept that deterministic tag heuristics will have edge cases where 100% classification accuracy is physically impossible without optical tracking.

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

A saved match keeps each event's `timeMs`. A Sportscode export uses the clip midpoint, so an entry near the 10-second counter window or 15-second gap can shift.

Rules:

- Only attacking entries (`A25E` and `CE`) are emitted in the report; isolated turnovers, restarts, cards, substitutions, and quarter markers do not produce standalone rows.
- A same-team possession window stays open while same-team tags are within 15 seconds and the other team has not logged a possession tag or scored a goal.
- **Counter:** An `A25E` or `CE` reached within 10 seconds of a same-team Ball Won (`BW`, `BW1`–`BW4`) in the active possession window.
- **Build-Up:** An `A25E` or `CE` reached from a restart (`BS1`–`BS4`, `OH`), a Ball Won taking more than 10 seconds, or settled possession without a prior tag in 15 seconds.

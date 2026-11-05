# Sequence spike

Groups a coded match into chains. The trial page is served with the site at `/spike/sequences/`. Capture and match review do not use it.

On the deployed site, open **Sequence trial** from Matches, or go directly to `spike/sequences/`. Pick a match saved in that browser, upload an export, or open the sample.

The command-line check reads the same rules:

```bash
node spikes/sequences/check.js
node spikes/sequences/run.js src/spike/sequences/fixture.json --out spikes/sequences/out
node spikes/sequences/run.js path/to/saved-game.json --out spikes/sequences/out
node spikes/sequences/run.js path/to/sportscode.xml --out spikes/sequences/out
```

A saved match keeps each event's `timeMs`. A Sportscode export uses the clip midpoint, so a chain near the 15 second gap can move.

Rules:

- One chain is one team. A gap over 15 seconds starts a new chain.
- Ball Won reaching an attacking tag within 10 seconds is a counter. The same Ball Won arriving later is build-up.
- Outcome is Goal, then PC, then Shot. The other team winning the ball before any of those is a turnover. A circle entry with neither is "No shot". A 25 entry that never reaches the circle is "No circle".
- Channel is copied from a Left, Center, or Right label already on the circle entry or 25 entry.
- Cards, substitutions, and quarter markers stay out of the chain and are listed under Left out.

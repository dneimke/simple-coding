---
name: board-config-generator
description: >-
  Designs and validates JSON button board configurations for the Field Hockey
  Event Tracker based on coaching analysis requirements, coder persona, or
  external coding schemes (MyVA / Hudl Sportscode). Use when the user wants to
  create, adapt, or simplify a coding board, map lead/lag clip timings, or
  solve a tracking requirement via configuration rather than code.
---

# Board Configuration Generator

Turn analysis requirements or external highlight schemes into a validated JSON board configuration for `src/components/config.js` or `#configure`.

## References

- Validation & schema: `src/components/config.js` (`validateConfig`, `HOCKEY_ONE_ZONED_CONFIG`)
- MyVA lead/lag timings: `docs/myva-lead-lag-times.md`
- Sticky zones & team rows spec: `docs/feat/sticky-zones/spec.md`
- Product gate: `docs/core-friction-points.md`. A board must shorten fixture setup (Friction 1), collapse a second labeling pass into the first tag (Friction 2), or carry `lead`/`lag` so clips are sized when the event is tagged (Friction 3). If it does none of those, do not add it.
- Personas & sideline constraints: `AGENTS.md`

## Step 1: Match the board to the Coder Persona

If the target coder or analysis scope is underspecified, ask at most 2 questions:

1. **Coder Persona** (from `AGENTS.md`):
   - **Drafted Helper / Casual Coder**: Avoid sticky zones and shared-row toggles. Use explicit per-team rows (`"team": 1`, `"team": 2`) with 4–6 self-explanatory essentials (`A25E`, `CE`, `SHOT`, `PC`, `GOAL`, `CARD`) and `START`/`END`.
   - **Dedicated Analyst / Bench Coach**: Use sticky zones (`zones: { values: ["1", "2", "3", "4"], default: "1", perspective: "mirrored" }`) for zoned buttons (`"zoned": true` on `BS`, `BW`) to prevent button explosion, dedicated team rows (`"team": 1`, `"team": 2`) for high-frequency actions, and a shared `"team": "selected"` row for lower-frequency scoring/cards (`APS`, `PS`, `GOAL`, `SO`, `GREEN`, `YELLOW`, `RED`).
2. **Downstream Tool**:
   - **MyVA / Sportscode**: Match exact code names and `lead`/`lag` seconds from `docs/myva-lead-lag-times.md`.

## Step 2: Schema & Ergonomic Rules

Every board JSON must pass `validateConfig(config)` in `src/components/config.js`:

```json
{
  "zones": { "values": ["1", "2", "3", "4"], "default": "1", "perspective": "mirrored" },
  "rowDefs": [
    {
      "gridCols": "grid-cols-3",
      "buttons": [
        { "event": "START", "text": "START", "color": "btn-gray", "lead": 1, "lag": 1 },
        { "event": "END", "text": "END", "color": "btn-gray", "lead": 1, "lag": 1 },
        { "event": "UMP", "text": "UMP", "color": "btn-gray", "lead": 7, "lag": 7 }
      ]
    },
    {
      "team": 1,
      "grids": [
        {
          "gridCols": "grid-cols-6",
          "buttons": [
            { "event": "BS", "text": "BS", "zoned": true, "lead": 10, "lag": 10 },
            { "event": "CE", "text": "CE", "lead": 10, "lag": 10 }
          ]
        }
      ]
    }
  ]
}
```

- **Colours**: Non-team buttons must use one of `btn-blue`, `btn-red`, `btn-green`, `btn-yellow`, `btn-orange`, `btn-gray`. Team rows (`"team": 1`, `2`, or `"selected"`) take their colour and code prefix at game start from `teamSetupDialog`.
- **Zones**: Any button with `"zoned": true` requires a top-level `zones` object (`values`: non-empty string array, `default`: member of `values`, `perspective`: `"mirrored"` or `"pitch"`).
- **Clip timings**: `lead` and `lag` must be numbers $\ge 0$ (seconds before and after the button press in exported Sportscode XML; default is `5` when omitted). Reference `docs/myva-lead-lag-times.md` for standard timings (`SHOT` 15/5, `GOAL` 15/5, `PC` 2/10, `GREEN` 20/130, `YELLOW` 20/360).
- **Phone width check (`390px`)**: Use `grid-cols-3` or `grid-cols-4` for readable labels on phones; only use `grid-cols-8` for 2–4 character codes (`BS`, `BW`, `OH`, `CE`, `PC`).

## Step 3: Deliver & Verify

1. Validate the generated JSON by running `validateConfig` against it (via Jest or `node -e`).
2. Output the formatted JSON ready for **Configure → Replace from clipboard**, or if the user asked for a built-in preset, register it in `BUILT_IN_NAMED_CONFIGS` in `src/components/config.js` and run `npm test`.

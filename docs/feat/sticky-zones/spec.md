# Sticky Zone Board

**Status:** Prototype, awaiting feedback
**Prototype:** [prototype.html](prototype.html)

## Problem

The coding board is getting crowded. The `hockey-one` configuration has 33 buttons, and zone-specific events need one button per zone per team: Ball Starts alone take 8 buttons (`FIRE BS1`-`BS4`, `TIGERS BS1`-`BS4`). Adding Ball Wins the same way would add another 8, and every future zone-based event makes it worse.

Team names are also hard-coded into each configuration, so a new opponent means editing the config.

## Proposal

### Sticky zone

Add a **sticky zone bar** (Zone 1 to Zone 4) to the board. The coder selects a zone once, it stays active, and zone-aware action buttons infer the zone when clicked. Zone-agnostic buttons (`OH`, `CE`, `SHOT`, ...) are unaffected.

### Zone perspective

Zones are relative to a team's direction of play, so the same patch of pitch is a different zone for each team: Team 1's Zone 2 is Team 2's Zone 3. With 4 zones the mapping is always `5 - zone` (1↔4, 2↔3).

The zone bar is therefore always selected **from Team 1's perspective**, and Team 2's zoned events are mirrored automatically:

| Zone selected | Team 1 button logs | Team 2 button logs |
| --- | --- | --- |
| Zone 1 | `MELB BS1` | `PERTH BS4` |
| Zone 2 | `MELB BS2` | `PERTH BS3` |
| Zone 3 | `MELB BS3` | `PERTH BS2` |
| Zone 4 | `MELB BS4` | `PERTH BS1` |

To make this visible while coding:

- The banner shows both teams' zones, e.g. `MELB ZONE 2 · PERTH ZONE 3`, with a caption explaining that zones are from Team 1's perspective.
- Each zone button shows Team 2's equivalent zone underneath (`Zone 2` / `PERTH 3`).
- Each team's zoned buttons show that team's own zone: in Zone 2, Team 1's row shows `BS·2` and Team 2's row shows `BS·3`.
- Mirrored events get a "zone mirrored" badge in the event log.

The prototype also has a "Same as Team 1 (fixed pitch zones)" variant, where both teams log the selected zone unchanged, for comparison.

Because zones are always Team 1's perspective, the Team 1 slot needs to be filled consistently (for example, always the team being analysed). Swapping ends at half time doesn't matter, because zones follow each team's direction of play rather than the physical pitch.

### Team setup at game start

Pressing **Start** asks for a code and a colour for Team 1 and Team 2 (for example `MELB` in navy and `PERTH` in teal):

- Codes are upper-cased, spaces are stripped, both are required and they must differ.
- Each team picks from a palette of 10 colours: red, maroon, orange, yellow, green, teal, sky blue, navy, purple and black. A colour chosen by one team is disabled for the other.
- The last-used codes and colours are pre-filled next time.

The colours apply to that team's buttons, row labels and the "MELB vs PERTH" header.

Every team event is then coded from the entered codes, so one configuration works for any matchup:

| Button | Pattern | Example |
| --- | --- | --- |
| Zoned team event | `{TEAM} {EVENT}{ZONE}` | `MELB BS3` |
| Team event | `{TEAM} {EVENT}` | `PERTH SO` |
| Match event | `{EVENT}` | `START` |

The space between team and event matches today's names (`FIRE BS1`), so existing saved games, XML exports, the timeline and statistics are unaffected for the events that already exist.

### Board layout

```
+-----------------------------------------------------------------+
| [00:06]  [Pause]  [Complete]  [Discard]                         | Global controls
|                     MELB vs PERTH                               |
+-----------------------------------------------------------------+
| MELB ZONE 2 · PERTH ZONE 3                                      |
| [ Zone 1  ]  [ Zone 2  ]  [ Zone 3  ]  [ Zone 4  ]              | Sticky zone bar
| [ PERTH 4 ]  [ PERTH 3 ]  [ PERTH 2 ]  [ PERTH 1 ]              |
+-----------------------------------------------------------------+
| [START] [END] [UMP]                                             | Match control
+-----------------------------------------------------------------+
| MELB:   [BS·2] [BW·2] [OH] [A25E] [CE] [SHOT] [ASC] [PC]        | Team 1 actions
+-----------------------------------------------------------------+
| PERTH:  [BS·3] [BW·3] [OH] [A25E] [CE] [SHOT] [ASC] [PC]        | Team 2 actions
+-----------------------------------------------------------------+
| MELB:   [APS] [PS] [GOAL] [SO]                                  | Team 1 scoring
|         [GREEN] [YELLOW] [RED]                                  | Team 1 cards
+-----------------------------------------------------------------+
| PERTH:  [APS] [PS] [GOAL] [SO]                                  | Team 2 scoring
|         [GREEN] [YELLOW] [RED]                                  | Team 2 cards
+-----------------------------------------------------------------+
```

### Guarding against miscoding

The main risk is a coder forgetting to change zone after a quick transition. The prototype tries these mitigations:

- The active zone is solid-filled with a thick ring, and a banner above the bar reads `ZONE n ACTIVE`. The banner flashes when the zone changes.
- Zoned buttons show the active zone on the button itself (`BS·3`), so the zone is visible exactly where the coder is pressing.
- Keys `1`-`4` switch zones, which makes correcting the zone almost free.
- Optionally, each zone change can be logged as a `ZONE n` event, giving an audit trail when reviewing a sequence.

## Proposed config shape

The feature is opt-in per configuration. A config with a `zones` block gets a zone bar; `perspective: "mirrored"` converts Team 2's zones. Team buttons hold only the event code and a `team` slot (`1` or `2`); the team codes and colours entered at game start are applied at runtime. Each row can hold more than one button grid so that, for example, scoring and cards share one labelled group.

```js
{
    zones: { values: ["1", "2", "3", "4"], default: "1", perspective: "mirrored" },
    rowDefs: [
        { gridCols: "grid-cols-3", buttons: [/* START, END, UMP */] },
        {
            team: 1,
            grids: [{
                gridCols: "grid-cols-8",
                buttons: [
                    { event: "BS", zoned: true },
                    { event: "BW", zoned: true },
                    { event: "OH" },
                    // A25E, CE, SHOT, ASC, PC
                ]
            }]
        },
        // team 2 actions ...
        {
            team: 1,
            grids: [
                { gridCols: "grid-cols-4", buttons: [{ event: "APS" }, { event: "PS" }, { event: "GOAL" }, { event: "SO" }] },
                { gridCols: "grid-cols-3", buttons: [{ event: "GREEN" }, { event: "YELLOW" }, { event: "RED" }] }
            ]
        },
        // team 2 scoring and cards ...
    ]
}
```

The prototype generates the equivalent config with the codes already substituted; the "Config shape" panel shows it for whichever variant is selected. Configs without `zones` or `team` (including the current `default` and `hockey-one`) render exactly as they do today.

### Where it would hook in

| Area | File | Change |
| --- | --- | --- |
| Config | [src/components/config.js](../../../src/components/config.js) | New built-in named config; `validateConfig` accepts `zones`, `team`, `zoned` and `grids` |
| Rendering | [src/components/eventButtons.js](../../../src/components/eventButtons.js) | Render the zone bar, team labels and multi-grid rows; substitute team codes and colours |
| Buttons | [src/components/ui/grid.js](../../../src/components/ui/grid.js) | Pass `zoned` and the team slot through as data attributes, like `lead`/`lag` today |
| Styles | [src/styles.css](../../../src/styles.css) | Add button classes for the 10 team colours (today there are 6 `btn-*` colours) |
| Logging | [src/main.js](../../../src/main.js) (click handler, around line 402) | Append the active zone, mirrored for Team 2, to the event name for zoned buttons |
| New game | [src/main.js](../../../src/main.js) (`newGameButton`) and [src/components/gameState.js](../../../src/components/gameState.js) (`newGame`) | Prompt for team codes and colours before starting; store them on the game |
| State | `stateService` / capture draft | Store the active zone, team codes and colours so they survive a reload |

Zone buttons should not carry `data-event`, so the existing click handler and `EventButtons.setState()` ignore them. That keeps them usable while the timer is paused.

Storing the team codes on the saved game would also let the saved games list and match review show the matchup, but that is optional for a first version.

## Open questions

1. **Per-team or shared scoring and cards?** Per-team rows are shown above. The prototype also offers a shared variant: one `[APS] [PS] [GOAL] [SO]` row and one `[GREEN] [YELLOW] [RED]` row, plus a sticky team toggle (`T` key) that recolours the rows to the active team. It saves two rows but adds a second piece of sticky state to keep track of.
2. **Show the zone on zoned buttons?** On (`BS·3`) or off (`BS`).
3. **Log zone changes as events?** Useful as an audit trail, but adds noise to the event list and XML.
4. **Shootout naming changes.** Today's buttons log `SO FIRE` / `SO TASSIE` (event before team). Under the new pattern they become `FIRE SO` / `TIGERS SO`. Any stats or reports that look for `SO ...` would need updating, or old games would need translating on import.
5. **Should START, END and UMP stay team-less?** They're match events, so the prototype leaves them uncoded by team.
6. **Can team codes be changed mid-game?** The prototype only asks at Start. Fixing a typo after events are coded would mean renaming those events too.
7. **Mirrored or fixed-pitch zones for Team 2?** Mirrored (the default) means `PERTH BS1` always means Perth's own Zone 1, so each team's stats are directly comparable. Fixed-pitch means both teams log the selected zone as-is, and anyone reading Team 2's stats has to mirror them mentally.
8. **Is the colour palette right?** The 10 colours are a first guess at common kit colours. White was left out because it disappears on the white board background.

## Viewing the prototype

Open [prototype.html](prototype.html) directly in a browser (double-click it, or drag it into a browser window). No build or server is needed. It loads `src/styles.css` so the buttons match the real app, and Tailwind from the CDN.

Things to try:

- Press **Start**, enter two team codes and pick their colours, then pick a zone and code a sequence. The event log on the right shows exactly what would be recorded, with a badge on events whose zone or team came from the sticky state.
- Code a Ball Start for each team in the same zone to see Team 2's zone mirrored. Switch **Team 2 zones** to "Same as Team 1" to compare.
- Switch **Layout** to "Current (hockey-one)" to compare against today's board (it uses your entered team codes and colours too).
- Switch **Width preview** to "Phone (390px)" to check how the 8-button rows wrap on a phone.

Variant settings and the last team codes and colours are remembered between reloads.

## Feedback

_Record feedback from trying the prototype here._

- Only 4 zones are needed.
- SO should be team-specific.
- Cards on their own row, with APS, PS, GOAL and SO on the row above.
- Ask for Team 1 and Team 2 codes at the start of the game and code events as `{TEAM}{EVENT}` or `{TEAM}{EVENT}{ZONE}`.
- Pick each team's colour from a list of up to 10 colours.
- Zone 2 for Team 1 is Zone 3 for Team 2; zones should be selected from Team 1's perspective.

## Decisions

| Question | Decision |
| --- | --- |
| 4 or 5 zones | 4 zones; BS and BW both use Zones 1-4 |
| Shootouts | Team-specific (`{TEAM} SO`), in the scoring row |
| Scoring and cards layout | `APS PS GOAL SO` row above a `GREEN YELLOW RED` row |
| Team names | Entered as codes when a game starts |
| Team colours | Picked per team from a 10-colour palette when a game starts |
| Zone perspective | Zone bar is selected from Team 1's perspective |
| Per-team or shared scoring and cards | |
| Show zone on zoned buttons | |
| Log zone changes | |

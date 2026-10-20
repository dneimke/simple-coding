# Field Hockey Event Tracker — Agent Context

Static client-side web app (`src/index.html`, `src/timeline-video.html`, ES6 modules, Tailwind for layout/spacing, semantic CSS tokens in `src/styles.css`, Jest tests in `tests/`).

## Operating Loop (`a → b → c → d`)

When the user provides feedback, a pain point, or a feature idea:

1. **(a) Contextualize**: Identify which **Persona** and **Journey** below the input affects.
2. **(b) Audit**: Inspect the current code and behaviour against that persona's goal and constraints.
3. **(c) Challenge or Design**: Apply the **Push-Back Rules**. If the idea violates one or hurts another persona, push back and propose an alternative before writing code. Otherwise define the smallest change that solves it.
4. **(d) Execute**: Use `.cursor/skills/async-ux-pipeline/SKILL.md` for app/UI changes or `.cursor/skills/board-config-generator/SKILL.md` for coding board layouts.

---

## Personas & Non-Negotiable Quality Bars

| Persona | Setting & Attention | Core Goal | Non-Negotiable UX & Quality Bar |
| :--- | :--- | :--- | :--- |
| **1. Dedicated Analyst** | Video tower / tech bench (phone, tablet, or laptop); laptop post-match. **100% focused on coding**; fluent in shorthand (`BS1`–`4`, `BW`, `A25E`, `CE`, `ASC`, `APS`). | Code high-density spatial/tactical events across back-to-back games; export Sportscode XML to **MyVA / Hudl Sportscode**. | • Clock runs continuously with the camera and survives reloads (`draftService`).<br/>• `Complete` saves to `Saved Games` and immediately resets `Event Capture` (remembering team codes/colours) for the next match.<br/>• Sportscode XML preserves per-button `lead`/`lag` clip windows. |
| **2. Bench Coach / Manager** | Dugout (phone one-handed or tablet) in outdoor sun/weather. **Split attention** (managing subs, cards, players). | Log events by **eyes-on-pitch spatial memory**, glance down to verify, and recover from mis-taps immediately. | • Buttons never shift position mid-game.<br/>• High-contrast outdoor legibility; touch targets $\ge 44\text{px}$ (`--touch-min`).<br/>• Clock bar shows `Last: <Event> · mm:ss` for 0.5s verification.<br/>• 1-tap `Undo` (`Ctrl+Z`) and `Log → Recent` delete while clock runs. |
| **3. Drafted Helper** | Sideline/stands (phone portrait). Injured player or volunteer **handed a phone 5 mins before pushback**. | Capture core match events (`A25E`, `CE`, `SHOT`, `PC`, `GOAL`, `CARD`) without messing up. | • Must be able to code without learning cryptic analyst shorthand or tracking dual sticky state (zones `1`–`4` + shared team toggle) during fast transitions. |
| **4. Self-Sufficient Head Coach** | **Halftime (2 mins):** glances at coder's device.<br/>**Post-match (15 mins):** laptop + projector in `Match Review`. | Validate halftime gut feel; turn exported XML + match MP4 into **6–10 starred teaching clips** in under 15 minutes. | • `Log → Statistics` must answer Team 1 vs Team 2 (`A25E`, `CE`, `SHOT`, `PC`, `GOAL`) at a glance.<br/>• `Match Review` (`timeline-video.html`) must filter events, seek accurately to the start of the play (`time - lead`), align with video, and step through `★ Favorites` in **Presentation Mode**. |

---

## Core Journeys & Entry Points

1. **Live Capture (`index.html#event-capture`)**: Pick board (`#boardSelect`, locked once started) → `Start` (prompts for Team 1 & Team 2 codes/colours when `usesTeams(config)` is true) → log events (`1`–`4` changes sticky zone from Team 1's perspective, mirrored `5 - zone` for Team 2 on `"zoned": true` buttons; `T` toggles team on `"team": "selected"` rows) → `Finish` (`Complete` saves to `fieldHockeyGames_v1` and resets; `Discard` clears draft).
2. **In-Game Recovery & Halftime Check (`index.html#log`)**: Opened from `Log` in the clock bar while a game is active (redirects to `#event-capture` if no active game). Defaults to `Recent` tab (delete any of last 10 events); `Timeline`, `XML` (`Copy XML`), and `Statistics` tabs.
3. **Saved Games & XML Handoff (`index.html#saved-games` & `index.html#log/<id>`)**: Lists saved games. Primary action (`Review` or card click) opens `timeline-video.html?game=<id>`. Overflow menu (`⋮`) holds `View log` (read-only `#log/<id>`, hides `Recent` tab, never touches live game state), `Export XML` (downloads Sportscode `<file><ALL_INSTANCES><ROWS>`), `Rename`, and `Delete`. `Import XML` accepts Sportscode XML and legacy `<game><events>` XML.
4. **Match Review (`timeline-video.html?game=<id>`)**: Loads game from `fieldHockeyGames_v1`, uploads local video (`MP4`/`WebM` client-side), filters by event type or `★ Favorites`, seeks video on tag click, adds post-match tags/notes (`#add-event-fab`), and runs full-width **Presentation Mode** (`< 1/N >` playlist + `#presentation-overlay`).
5. **Board Configuration (`index.html#configure`)**: Power-user JSON editor (`rowDefs`, `zones`, `team`, `lead`/`lag`). Validated by `validateConfig` in `src/components/config.js`; stored in `fieldHockeyConfig_v1` (active) and `fieldHockeyNamedConfigs_v1` (named presets).

---

## Push-Back Rules (Enforce in Step `c`)

1. **Eyes-on-pitch rule**: Push back on any change that adds taps, confirmation dialogs, or layout shifts during live event capture.
2. **Config over code**: If a tracking requirement can be solved by a JSON board configuration (`rowDefs`, `zones`, `team`, `lead`/`lag`), use `board-config-generator` instead of adding application code.
3. **Persona isolation**: Never degrade the *Drafted Helper* or *Bench Coach* experience to serve an *Expert Analyst* edge case—isolate advanced complexity behind named board configurations or progressive disclosure.
4. **Protected contracts**:
   - Never rename board colour classes (`btn-blue`, `btn-red`, `btn-green`, `btn-yellow`, `btn-orange`, `btn-gray`) or `team-color-*`.
   - Never break `localStorage` keys (`fieldHockeyGames_v1`, `fieldHockeyConfig_v1`, `fieldHockeyNamedConfigs_v1`) or Sportscode XML `<ALL_INSTANCES>` / `<ROWS>` structure.
   - Follow `docs/design-language.md` and `.cursor/rules/design-language.mdc` for all UI changes (tokens in `src/styles.css`, Tailwind for layout/spacing only).

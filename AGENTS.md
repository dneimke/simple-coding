# Field Hockey Event Tracker — Agent Context

Static client-side web app (`src/index.html`, `src/timeline-video.html`, ES6 modules, Tailwind for layout/spacing, semantic CSS tokens in `src/styles.css`, Jest tests in `tests/`, Playwright visual verification in `scripts/visual-snapshot.js`).

---

## Operating Philosophy: Eliminating "Glue Toil" via Asynchronous Dispatch

The hidden tax of AI-assisted engineering is **"glue toil"**: the human spending 45 minutes acting as middleware—typing long problem descriptions, debating layout in chat, refreshing dev servers, clicking through 4 screens to reproduce state, and manually testing edge cases.

Our goal is **Asynchronous Dispatch**:
1. Spot friction on a phone or laptop.
2. Provide a 2-second screenshot or brief note.
3. Dispatch the agent and step away (to the garden or garage).
4. Return to an open Pull Request with **green deterministic tests** and **automated visual snapshots** ready for a 5-second review and 1-tap merge.

### Zero-Toil Measurement: Cycle Latency via Git Branches
Do not track time manually. Measure **Cycle Latency** via Git branches:
- Always branch from `main` using: `feature/<short-name>`.
- The delta between first commit/dispatch and merged PR represents end-to-end cycle time. The objective is collapsing hours of hovering down to a fast, asynchronous handoff.

---

## The 4-Step Optimization Blueprint

1. **Step 1: Input Optimization (The "Screenshot Drop")**
   - Skip three-paragraph layout essays. A visual snippet, circled screenshot, or raw bullet list feeds directly into triage (`a → b → c`).
2. **Step 2: Leverage Design Tokens (Zero UI Debate)**
   - Strict design tokens in `src/styles.css` and `docs/design-language.md`. Semantic classes (`btn-blue`, `team-color-*`, `--touch-min`) are protected. Agents never invent styling abstractions.
3. **Step 3: Test-First Handoff (Prevent Code Drift)**
   - Logic, state, and DOM changes begin with a failing Jest test in `tests/`. The task is finished when the test suite is green.
4. **Step 4: Verification Optimization (Seeded URLs & Automated Visual Demos)**
   - **Direct Seeded URLs**: Query parameters (`?mock=active`, `?mock=sample`, `?seed=sample`) instantly initialize application state without clicking through setup modals or menus.
   - **Automated Visual Snapshots**: `npm run test:visual` executes headless Chromium via Playwright, generating high-fidelity mobile (390px) and desktop (1280px) screenshots into `.visual-proof/`.

---

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

## Core Journeys, Deep Links & Seeded URLs

| Journey | Direct View URL | Instant Mock / Seed URL | Behavior |
| :--- | :--- | :--- | :--- |
| **1. Live Capture** | `index.html#event-capture` | `index.html#event-capture?mock=active` | Boots with 4 logged events, timer at 07:05, FIRE vs TIGERS teams loaded. |
| **2. In-Game Log** | `index.html#log` | `index.html#log?mock=active` | Shows live recent events, undo/delete tabs without needing to click Start. |
| **3. Saved Games** | `index.html#saved-games` | `index.html#saved-games?mock=sample` | Seeds sample game into storage so cards and export/review actions are live. |
| **4. Saved Game Log** | `index.html#log/<id>` | `index.html#log/sample-game` | Read-only match log for `sample-game` (auto-seeded if missing). |
| **5. Match Review** | `timeline-video.html?game=<id>` | `timeline-video.html?game=sample-game` | Loads timeline with 8 tactical events, favorites, and video player UI. |
| **6. Configuration** | `index.html#configure` | `index.html#configure` | Power-user JSON editor for button board schemas. |

---

## Push-Back Rules (Enforce in Step `c`)

1. **Eyes-on-pitch rule**: Push back on any change that adds taps, confirmation dialogs, or layout shifts during live event capture.
2. **Config over code**: If a tracking requirement can be solved by a JSON board configuration (`rowDefs`, `zones`, `team`, `lead`/`lag`), use `board-config-generator` instead of adding application code.
3. **Persona isolation**: Never degrade the *Drafted Helper* or *Bench Coach* experience to serve an *Expert Analyst* edge case—isolate advanced complexity behind named board configurations or progressive disclosure.
4. **Protected contracts**:
   - Never rename board colour classes (`btn-blue`, `btn-red`, `btn-green`, `btn-yellow`, `btn-orange`, `btn-gray`) or `team-color-*`.
   - Never break `localStorage` keys (`fieldHockeyGames_v1`, `fieldHockeyConfig_v1`, `fieldHockeyNamedConfigs_v1`, `fieldHockeyCaptureDraft_v1`) or Sportscode XML `<ALL_INSTANCES>` / `<ROWS>` structure.
   - Follow `docs/design-language.md` and `.cursor/rules/design-language.mdc` for all UI changes (tokens in `src/styles.css`, Tailwind for layout/spacing only).

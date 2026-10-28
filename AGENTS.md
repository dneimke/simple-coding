# Field Hockey Event Tracker — Agent Context

Static client-side web app (`src/index.html`, `src/timeline-video.html`, ES6 modules, Tailwind for layout/spacing, semantic CSS tokens in `src/styles.css`, Jest tests in `tests/`, Playwright visual verification in `scripts/visual-snapshot.js`).

---

## Product gate (binding)

simple-coding exists to remove three operational frictions. The full statement is [`docs/core-friction-points.md`](docs/core-friction-points.md). Cursor always loads [`.cursor/rules/core-friction-points.mdc`](.cursor/rules/core-friction-points.mdc). Antigravity always loads [`.agents/rules/core-friction-points.md`](.agents/rules/core-friction-points.md), which inlines that document.

**If a change does not reduce one of these three frictions, do not implement it.** Name the friction before writing code, a board configuration, or a dispatch contract.

| Friction | Bottleneck to remove | Target |
| :--- | :--- | :--- |
| **1. Game setup divergence** | New teams and separate paths for live sideline coding vs. MP4 coding | Teams defined once, quick selectors, one clock engine for live time and video time |
| **2. Two-pass coding slog** | A required second pass for zones, ball origins, and tactical modifiers | Single-pass compound tags (chorded keys, a short modifier overlay, inferred state) |
| **3. Post-match assembly** | Manual in/out points, clip sizing, and rendered exports (~45 min) | Lead/lag sized at tag time; presentation mode seeks a filtered playlist in the browser |

Four invariants in that document are not optional: client-side state with Sportscode XML fidelity, zero-render presentation, critical tags in ≤ 3 taps or keystrokes without modal lockup, and separation of video scrubber time from the quarter match clock.

A bugfix or refactor is in scope when it restores one of those invariants or repairs a regression in an existing solution to one of the three frictions. A new capability that leaves all three bottlenecks untouched is out of scope.

`Continue coding` stays available to finish an unfinished quarter or add a targeted coach tag. That does not justify keeping a mandatory second labeling pass (Friction 2).

---

## Operating Philosophy: Eliminating "Glue Toil" via Asynchronous Dispatch

The hidden tax of AI-assisted engineering is **"glue toil"**: the human spending 45 minutes acting as middleware—typing long problem descriptions, debating layout in chat, refreshing dev servers, clicking through 4 screens to reproduce state, and manually testing edge cases.

Our goal is **Two-Phase Asynchronous Dispatch**:
1. **Phase 1: Interactive UX Authority (`/ux-design`)**: Drop a 2-second screenshot, question, or rough idea. The agent inspects current visual snapshots, challenges the idea against personas and push-back rules, grills you on edge cases via low-friction multiple-choice options (`ask_question`), and locks a **5-Part Dispatch Contract** without touching production code.
2. **Phase 2: Autonomous Execution (`/async-ux-pipeline`)**: Once the contract is locked, dispatch `/async-ux-pipeline` and step away (to the garden or garage). Return to an open Pull Request with **green deterministic tests** and **automated visual snapshots** ready for a 5-second review and 1-tap merge.

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

1. **(a) Contextualize** *(Phase 1: `.cursor/skills/ux-design/SKILL.md`)*: Identify which **Persona** and **Journey** below the input affects.
2. **(b) Audit** *(Phase 1: `.cursor/skills/ux-design/SKILL.md`)*: Inspect the current visual snapshots (`.visual-proof/*.png`) and code behaviour against that persona's goal and constraints.
3. **(c) Challenge or Design** *(Phase 1: `.cursor/skills/ux-design/SKILL.md`)*: Apply the **Push-Back Rules**. If the idea violates one or hurts another persona, push back and propose an alternative before writing code. Grill the user on blind spots via `ask_question` and lock the **5-Part Dispatch Contract**.
4. **(d) Execute** *(Phase 2: `.cursor/skills/async-ux-pipeline/SKILL.md` or `.cursor/skills/board-config-generator/SKILL.md`)*: Once the contract is approved, execute test-first implementation, multi-state visual proof, vision self-audit, and PR creation autonomously.

---

## Personas & Non-Negotiable Quality Bars

| Persona | Setting & Attention | Core Goal | Non-Negotiable UX & Quality Bar |
| :--- | :--- | :--- | :--- |
| **1. Dedicated Analyst** | Video tower / tech bench (phone, tablet, or laptop); laptop post-match. **100% focused on coding**; fluent in shorthand (`BS1`–`4`, `BW`, `A25E`, `CE`, `ASC`, `APS`). | Code high-density spatial/tactical events across back-to-back games; export Sportscode XML to **MyVA / Hudl Sportscode**. | • Clock runs continuously with the camera and survives reloads (`draftService`).<br/>• `Complete` saves to `Saved Games` and immediately resets `Event Capture` (remembering team codes/colours) for the next match.<br/>• Sportscode XML preserves per-button `lead`/`lag` clip windows.<br/>• Multi-pass & ad-hoc coding: `Continue coding` resumes games in video tagging at `1x`/`1.5x`/`2x` to finish quarters or add targeted coach tags without losing prior events or team metadata. |
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
| **6. Configuration** | `index.html#configure` | `index.html#configure` | Visual button board customizer with protected templates and optional JSON view. |
| **7. Video Coding / Continue Coding** | `timeline-video.html?game=<id>&mode=tag` | `timeline-video.html?game=sample-game&mode=tag` | Boots into Focus Tagging Mode with video player, 1-tap quick tags, speed controls, and auto-save enabled. |

---

## Push-Back Rules (Enforce in Step `c`)

1. **Eyes-on-pitch rule**: Push back on any change that adds taps, confirmation dialogs, or layout shifts during live event capture.
2. **Config over code**: If a tracking requirement can be solved by a JSON board configuration (`rowDefs`, `zones`, `team`, `lead`/`lag`), use `board-config-generator` instead of adding application code.
3. **Persona isolation**: Never degrade the *Drafted Helper* or *Bench Coach* experience to serve an *Expert Analyst* edge case—isolate advanced complexity behind named board configurations or progressive disclosure.
4. **Protected contracts**:
   - Never rename board colour classes (`btn-blue`, `btn-red`, `btn-green`, `btn-yellow`, `btn-orange`, `btn-gray`) or `team-color-*`.
   - Never break `localStorage` keys (`fieldHockeyGames_v1`, `fieldHockeyConfig_v1`, `fieldHockeyNamedConfigs_v1`, `fieldHockeyCaptureDraft_v1`) or Sportscode XML `<ALL_INSTANCES>` / `<ROWS>` structure.
   - Follow `docs/design-language.md` and `.cursor/rules/design-language.mdc` for all UI changes (tokens in `src/styles.css`, Tailwind for layout/spacing only).

---

## Execution Protocol (Non-Negotiable)

1. **Trace `Tap 1 → Tap 2 → Tap 3` First**: Never implement an entry button without implementing the complete interactive flow behind it. The target user must never hit a technical dead-end or raw JSON fallback mid-journey.
2. **Zero Developer Jargon in UI**: User copy must never mention `localStorage`, `JSON`, `factory default`, or internal state mechanics.
3. **Test-First State Logic**: Pure state helpers and storage contracts must be verified via unit tests (`npm test`) before UI handoff.
4. **Multi-State Visual Proof**: `npm run test:visual` must capture every interactive state of a new flow in `.visual-proof/*.png` (desktop + `390px` mobile)—never just the static initial route.
5. **Mandatory Vision Self-Audit**: Passing `npm run test:visual` with exit code `0` is NOT completion. You must open and inspect every generated `.visual-proof/*.png` with `read_file` before replying. If primary actions are buried below the mobile fold, classes are unstyled, banners duplicate badges, or developer jargon is visible, fix it yourself before handing the turn back.

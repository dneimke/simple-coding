---
name: async-ux-pipeline
description: >-
  Evaluates user feedback, pain points, or feature ideas against AGENTS.md
  personas and journeys, pushes back or writes a short spec, implements it
  against the design language, proves the result in the browser without asking
  the user to click through, and ships a pull request. Use when the user
  reports UI friction, shares user feedback, requests a feature or layout
  change, or mentions the async UX pipeline.
---

# Async UX-to-Code Pipeline

Take raw user feedback, a pain point, or a feature request, evaluate it against `AGENTS.md`, implement the smallest valid change while the user is away, verify it in the browser, and open a pull request. Do not ask the user to open the app, refresh, or click through states.

## Repository binding

Read `AGENTS.md` (personas, journeys, push-back rules) and `docs/design-language.md` (`.cursor/rules/design-language.mdc`) before changing markup, CSS, or JavaScript.

## Stage 1: Product triage & spec (`a → b → c`)

Before writing code, evaluate the request against `AGENTS.md`:

1. **Persona & Journey (`a`)**: Name the target persona (*Dedicated Analyst*, *Bench Coach*, *Drafted Helper*, or *Head Coach*) and journey.
2. **Audit & Push-Back Check (`b → c`)**: Inspect current code against the persona's quality bar and the **Push-Back Rules** in `AGENTS.md`:
   - Does it add taps, dialogs, or shifting buttons during live capture?
   - Can it be solved purely with a board JSON configuration (use `board-config-generator` instead)?
   - Does it help an expert persona while overloading a casual coder or halftime coach?
   - **If a rule is violated**: Stop and push back with the concrete tradeoff and a better alternative.
3. **Three-line spec (`c`)**: When the change is sound, state:
   - **Problem**: which persona/journey is blocked or high-effort, and why.
   - **Target state**: what the screen/code does after the change.
   - **Verification**: the automated test and browser check that prove it.

Use the full pipeline for a screen or interaction change. For a copy or token tweak, skip the failing-test step and still do the browser check.

## Stage 2: Design language

Follow `docs/design-language.md`: CSS tokens and semantic classes in `src/styles.css`, Tailwind utilities for layout and spacing only, $\ge 44\text{px}$ touch targets.

## Stage 3: Tests

Behaviour (what a click does, what gets saved, what the DOM shows): add or update a Jest test under `tests/` that mirrors `src/`. Run it and confirm it fails for the current behaviour, then write the smallest change that makes it pass. Run `npm test`.

Look and layout (spacing, contrast, tap size, breakpoint): do not add a Jest test. The browser check is the proof.

## Stage 4: Visual proof

Serve `src/` (`npx -y http-server src -p 8080 -c-1`; `-c-1` turns off caching so the page loads current code) and open the view directly:

| View | URL |
| --- | --- |
| Event Capture | `index.html#event-capture` |
| Configure | `index.html#configure` |
| Saved Games | `index.html#saved-games` |
| Log for a saved game | `index.html#log/<id>` |
| Match Review | `timeline-video.html?game=<id>` |

`#log` with no id opens only while a game is in progress. Otherwise the app returns to Event Capture.

A fresh browser has no saved games. Log, a Saved Games row, and Match Review read `localStorage` key `fieldHockeyGames_v1`, a JSON array of `{ id, timestamp, events }`. Import `src/assets/sample-game.xml` from Saved Games, or write that array in the page, then open `#log/<id>` or `timeline-video.html?game=<id>` for the id you stored. Copy the object shape from `tests/js/timeline-video.test.js` when writing it by hand.

Exercise the changed flow, including empty or error states the change touches. When layout changed, check about 390px, 768px, and 1280px. Capture a screenshot. Remove any games you added to storage for the check.

## Stage 5: Pull request

Every change ships through a pull request. Never commit or push to `main`.

1. Start from an up-to-date `main` and create `feature/<short-name>`.
2. Commit with a message that says what the user gets, push the branch, and open a PR against `main` with `gh pr create`.
3. In the PR body, cover the persona/problem, what changed, behaviour that stays the same, and testing (the `npm test` count and the widths and flows checked in the browser).
4. Leave merging to the user.

## Done when

- Behaviour changes have a green `npm test`
- `AGENTS.md` persona quality bars and `docs/design-language.md` rules hold
- The browser check used the direct URL, with a saved game when the view needs one
- A pull request is open against `main`, and nothing was pushed to `main` directly
- The reply leads with what changed, the test result, what the screen showed, and the PR link

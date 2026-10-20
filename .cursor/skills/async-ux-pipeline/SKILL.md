---
name: async-ux-pipeline
description: >-
  Turns a UI friction report into a short spec, implements it against this
  repo's design language, proves the result in the browser without asking
  the user to click through, and ships it as a pull request. Use when the user reports UI friction, requests
  a component or layout change, dispatches a feature to finish while they are
  away, or mentions the async UX pipeline.
---

# Async UX-to-Code Pipeline

Finish the UI change while the user is away. Take a raw friction report (screenshot, note, or bullets), write a short spec, implement the smallest change, leave proof, and open a pull request. Do not ask them to open the app, refresh, log in, or click through states.

## Repository binding

This app is the Field Hockey Event Tracker: static HTML, vanilla JavaScript, and Jest. UI rules live in `.cursor/rules/design-language.mdc` and `docs/design-language.md`. Follow those for colour, components, touch size, and breakpoints. This skill does not restate them.

## Stage 1: Friction intake

Before writing code, state three lines:

- **Problem**: what is clunky or high-effort.
- **Target state**: what the screen does after the change.
- **Verification**: the check that proves it.

Use the full pipeline for a screen or interaction change. For a copy or token tweak, skip the failing-test step and still do the browser check.

## Stage 2: Design language

Read `docs/design-language.md` before changing markup, CSS, or JavaScript that builds UI.

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
3. In the PR body, cover the problem, what changed, behaviour that stays the same, and testing (the `npm test` count and the widths and flows checked in the browser).
4. Leave merging to the user.

## Done when

- Behaviour changes have a green `npm test`
- The design-language rule still holds
- The browser check used the direct URL, with a saved game when the view needs one
- A pull request is open against `main`, and nothing was pushed to `main` directly
- The reply leads with what changed, the test result, what the screen showed, and the PR link

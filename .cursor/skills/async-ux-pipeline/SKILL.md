---
name: async-ux-pipeline
description: >-
  Turns a UI friction report into a short spec, implements it test-first
  against this repo's design language, and proves the result in the browser
  without asking the user to click through. Use when the user reports UI
  friction, requests a component or layout change, dispatches a feature to
  finish while they are away, or mentions the async UX pipeline.
---

# Async UX-to-Code Pipeline

Finish the UI change while the user is away. Take a raw friction report (screenshot, note, or bullets), write a short spec, implement it test-first, and leave proof. Do not ask them to open the app, refresh, log in, or click through states.

## Repository binding

This app is the Field Hockey Event Tracker: static HTML, vanilla JavaScript, Jest, and the design language in `docs/design-language.md`. The rule `.cursor/rules/design-language.mdc` applies to UI edits. When this skill and that design language disagree, follow the design language.

- Reuse `createButton({ type })` and `createCard()` from `src/components/ui/`, plus semantic classes (`page`, `surface`, `btn`, `tabs`, `modal`, `banner`). Tailwind is layout and spacing only.
- Do not add Radix, shadcn, a new component library, Tailwind colour utilities, or hex colours.
- Tests are Jest under `tests/`. Run them with `npm test`. There is no Vitest and no Playwright suite.
- Do not break board colour class names (`btn-blue`, `btn-red`, `btn-green`, `btn-yellow`, `btn-orange`, `btn-gray`), `team-color-*`, saved-game JSON, 44px touch targets, offline local storage, or `#tracker-view` bottom padding.
- The capture screen is used one-handed on a phone during a match. Keep controls high contrast and at least `--touch-min`.

## Stage 1: Friction intake

Before writing code, state three lines:

- **Problem**: what is clunky or high-effort.
- **Target state**: what the screen does after the change.
- **Verification**: the assertion that proves it.

## Stage 2: Design language

Read `docs/design-language.md` before changing markup, CSS, or JavaScript that builds UI. Reuse existing classes. Prefer a dense, scannable layout over a new modal. If no token fits, add one to `:root` in `src/styles.css` and list it in the design-language doc.

## Stage 3: Test first

1. Add or update a Jest test for the verification line. Mirror the existing file layout (`tests/` matches `src/`).
2. Run that test and confirm it fails for the current behaviour.
3. Write the smallest change that makes it pass. Do not add speculative features.
4. Run `npm test` and keep the suite green.

## Stage 4: Visual proof

Do this yourself. Serve `src/` (`python -m http.server --directory src 8080`), open it in the browser tools, and exercise the changed flow: main path, empty or error states the change touches, and about 390px, 768px, and 1280px when layout changed. Capture a screenshot.

## Done when

- [ ] `npm test` is green
- [ ] Design-language invariants still hold
- [ ] No new hex colours or Tailwind colour utilities
- [ ] The browser check was done by the agent
- [ ] The reply is under 10 lines: what changed, test result, what the screen showed

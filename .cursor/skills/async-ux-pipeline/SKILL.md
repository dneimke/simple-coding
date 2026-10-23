---
name: async-ux-pipeline
description: >-
  Enforces the autonomous UX & test-first development pipeline. Evaluates user feedback
  against AGENTS.md personas and push-back rules, traces Tap 1 -> Tap 2 -> Tap 3,
  implements changes test-first, proves multi-state flows with automated Playwright
  visual snapshots and mandatory vision self-audit, and ships a pull request.
---

# Autonomous UX & Verification Pipeline

Never optimize merely for "making the static screen pass tests." Optimize for the target persona completing their actual job from Tap 1 to completion without human QA intervention.

## Repository Binding

Read `AGENTS.md` (personas, journeys, push-back rules, execution protocol) and `docs/design-language.md` (`.cursor/rules/design-language.mdc`) before changing markup, CSS, or JavaScript.

## Stage 1: Autonomous Spec & 3-Tap Journey Trace

When given raw user friction, image comments, or a 5-part brief, do not write production code until you have:
1. **Investigated Current State**: Inspect the relevant UI components, routes, and state helpers first.
2. **Traced the Full User Journey (`Tap 1 → Tap 2 → Tap 3`)**: Never design only the entry state. Explicitly map:
   - **Tap 1 (Entry Trigger)**: What the user clicks/taps to start (e.g., *Duplicate to edit*).
   - **Tap 2 (Active Manipulation)**: How the user performs the core edit/action (e.g., *Tap button on visual board → edit in modal*). Ensure the persona never hits a technical dead-end (such as raw JSON or developer instructions) on Tap 2.
   - **Tap 3 (Persisted Outcome)**: How the change saves and reflects immediately in the UI.
3. **Output the 5-Part Contract**: State the **Goal**, **Decisions & 3-Tap Journey**, **Invariants**, **Specific Next Step**, and **Traps to Avoid** before touching code.
4. **Resolve Forks or Execute**: If `Tap 2` has a genuine product fork (e.g., single-item vs. mirrored behaviour), ask 1–2 concise questions alongside the 5-Part Contract. Otherwise, proceed straight through Stages 2–5 autonomously.

## Stage 2: Design Tokens, Ergonomics & Copy Hygiene

Follow `docs/design-language.md`:
1. **Primary Actions Above the Fold**: Primary workflow CTAs must be immediately accessible without scrolling past dense boards or long lists on a `390px` mobile viewport. Touch targets $\ge 44\text{px}$ (`--touch-min`).
2. **Verified Styling**: Only use CSS classes/tokens that exist in `src/styles.css` (e.g. `btn-blue`, `team-color-*`, `--touch-min`) and Tailwind for layout/spacing only. Never leave raw unstyled text or duplicate status messages (e.g., a badge and a banner repeating the same sentence).
3. **Zero Implementation Leakage**: Never expose developer jargon (`localStorage`, `JSON`, `factory default`, `schema`, `state`) in user-facing copy. Speak strictly in the user's domain language.

## Stage 3: Test-First State Verification

1. Write or update deterministic unit/state tests in `tests/` (with fake timers where applicable) covering the full state transition before or alongside UI changes.
2. Run `npm test` — all unit tests must pass with exit code `0` before running visual verification.

## Stage 4: Multi-State Visual Proof & Mandatory Vision Self-Audit

Never ask the user to manually click through localhost in a browser, and never treat `npm run test:visual` exit code `0` as the finish line.

Use **Direct Seeded URLs** to load state instantly without modal clicks or setup:

| View | Direct Seeded URL | State Loaded |
| :--- | :--- | :--- |
| **Event Capture (Active)** | `index.html#event-capture?mock=active` | In-progress timer at 07:05, FIRE vs TIGERS, 4 logged events |
| **In-Game Log (Active)** | `index.html#log?mock=active` | Live recent log with delete/undo enabled |
| **Saved Games** | `index.html#saved-games?mock=sample` | Saved games list pre-populated with sample game |
| **Saved Game Log** | `index.html#log/sample-game` | Read-only match timeline & statistics |
| **Match Review** | `timeline-video.html?game=sample-game` | Synchronized timeline, video UI, and favorites |
| **Video Coding / Continue Coding** | `timeline-video.html?game=sample-game&mode=tag` | Focus Tagging Mode with 1-tap quick tags & speed controls |
| **Configure** | `index.html#configure` | Visual button board customizer & templates |

1. **Snapshot Interactive States, Not Just Landing URLs**: Run `npm run test:visual`. When a feature involves a multi-step flow (e.g., duplicating, opening an edit modal, saving), drive through and capture each active state in `.visual-proof/` (e.g., `step-1-readonly.png`, `step-2-duplicated.png`, `step-3-edit-modal.png`).
2. **Mandatory Multimodal Self-Audit (`read_file`)**: After running `npm run test:visual`, you **MUST** inspect every generated `.visual-proof/*.png` using `read_file` / vision tools before replying to the user.
3. **Self-Reject & Fix Before Handoff**: If your visual inspection reveals any of the following, fix the code and re-run `npm run test:visual` before yielding your turn:
   - Primary actions buried below the fold on `390px` mobile.
   - Unstyled classes, broken layouts, or overlapping elements.
   - Redundant chrome (badges and banners repeating the same message).
   - Developer/implementation jargon in user-facing labels or helper text.
4. **Concise Handoff**: Present your `<10-line` summary only after all unit tests and your visual self-audit pass.

## Stage 5: Pull Request & Zero-Toil Review

Every change ships through a pull request. Never commit or push to `main`.
1. Branch from `main` using `feature/<short-name>`.
2. Commit with a concise message describing the user benefit.
3. Push the branch and open a PR against `main` using `gh pr create` (Persona & Journey, What Changed, Behaviour Preserved, Verification).

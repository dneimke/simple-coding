# simple-coding: Core Friction Points & Product Intent

Durable agent context and architectural guidelines. This is the product test for every feature and code change.

If a change does not reduce one of the three friction points below, do not implement it.

## 1. Executive purpose and product invariants

**simple-coding** is a lightweight, client-side match event tracker and video review tool custom-built for field hockey. Its core architectural thesis is to eliminate the analog-to-digital translation tax and multi-tool fragmentation (Sportscode, NLEs, spreadsheets, manual scrubbing) by keeping logging, video playback, lead/lag envelopes, and presentation filtering inside a single client-side web application.

Target operational state: zero external NLE dependencies, zero cloud rendering overhead, and single-pass match review.

## 2. The 3 primary operational friction points

| Operational friction | Current bottleneck | Target product goal |
| :--- | :--- | :--- |
| **Friction 1: Game setup divergence** | Setting up a new fixture with two unconfigured teams creates cognitive drag. Branching logic between coding live sideline games vs. video MP4 files forces disparate user paths. | **Unified setup schema:** Teams are defined once in local storage and chosen via quick selectors. The clock engine must be input-agnostic, treating system time (`Date.now()`) and HTML5 video elapsed time (`video.currentTime`) as interchangeable sources. |
| **Friction 2: Two-pass coding slog** | Coding at 2x speed cuts an 80-min game to 40 mins, but a required second pass to add spatial zones, ball origins, and tactical modifiers adds 15+ mins, stalling review momentum. | **Single-pass compound tagging:** Triggered via modal hotkeys and chorded inputs (e.g., tap `C` for Circle Entry → a 1.5s transient sub-key overlay for Left/Center/Right). Automatic state memory infers defensive possession after tags. |
| **Friction 3: Post-match assembly overhead** | Manually scrubbing in/out points, sizing clips, and rendering video slices to share with players/coaches consumes 45 minutes of manual labor after events are coded. | **Pre-baked envelopes and zero-render playback:** Lead/lag envelopes per event code auto-size clips upon tagging. Presentation mode acts as a dynamic browser-native playlist auto-seeking between filtered events without re-rendering. |

## 3. Detailed friction point analysis

### Friction 1: Game setup divergence (live vs. video and new teams)

- **The bottleneck:** Setting up a new fixture with two unconfigured teams creates setup cognitive drag. Branching logic between coding live sideline games vs. coding from video MP4 files forces disparate user paths.
- **Product goal:** A unified setup schema where teams are defined once in local storage and chosen via quick selectors. The clock engine must be input-agnostic, treating system time (`Date.now()`) and HTML5 video elapsed time (`video.currentTime`) as interchangeable clock sources without altering UI or workflow.

### Friction 2: The two-pass coding slog (event logging plus secondary labeling)

- **The bottleneck:** Coding at 2x speed cuts an 80-minute game down to 40 minutes, but a required second pass to add spatial zones, ball origins, and tactical modifiers adds another 15+ minutes, stalling review momentum.
- **Product goal:** Single-pass compound tagging via modal hotkeys and chorded keyboard inputs (e.g., tap `C` for Circle Entry, triggering a 1.5s transient sub-key overlay for Left/Center/Right). Automatic state memory (e.g., inferring defensive half possession after a BS2 tag) to eliminate redundant modifier tagging.

### Friction 3: Post-match clip sizing and assembly overhead (the 45-minute bottleneck)

- **The bottleneck:** Manually scrubbing in/out points, sizing clips, and rendering video slices to share with players/coaches consumes 45 minutes of manual labor after events are already coded.
- **Product goal:** Pre-baked lead/lag envelopes per event code so clips are sized upon initial tagging. Presentation mode must act as a dynamic, continuous playlist that automatically seeks and jumps between starred/filtered event windows in the native browser player, completely eliminating video re-rendering.

## 4. Engineering and UX rules for autonomous agents

When implementing features or refactoring codebase logic (Cursor / Antigravity), strictly adhere to these four invariants:

- **Invariant 1: Client-side first.** Keep all core state, event streams, and settings local (`localStorage` / `IndexedDB`) with direct Sportscode XML import/export fidelity.
- **Invariant 2: Zero-render presentation.** Never force an external video export when in-browser playback seeking can achieve the exact same coaching review outcome.
- **Invariant 3: Single-tap sideline usability.** All critical tagging actions must be executable in ≤ 3 taps or keystrokes without modal lockup.
- **Invariant 4: Dual-clock grounding.** Maintain rigorous, explicit separation between cumulative video scrubber time and quarter match clock.

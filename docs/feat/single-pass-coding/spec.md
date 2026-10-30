# Single-Pass Compound Tagging (Friction 2 Spike)

**Status:** Prototype ready for ergonomic testing.  
**Prototype:** [prototype.html](prototype.html)  
**Target:** Eliminate the post-match secondary labeling slog (Friction 2).

---

## 1. Problem Statement

Coding match video at $1.5\times$ or $2\times$ cuts a 60–80 minute game down to 30–40 minutes. However, a **mandatory second pass** to label sub-attributes (Circle Entry flank, Shot outcome, origin) adds another 15+ minutes, stalling review momentum before the coach meeting.

Post-match sweep docks (like `Sweep (N)` in Match Review) speed up this second pass, but it **remains a second pass**. The true objective is **single-pass compound tagging** where modifiers are captured at the moment of tagging without modal lockup or cognitive overload.

---

## 2. Interaction Contract

### 2.1 The Transient Sub-Key Overlay
1. **Primary Trigger:** The user triggers a base event via keyboard hotkey (e.g., `C` for Circle Entry, `S` for Shot) or touch tap.
2. **Immediate Event Logging:** The base event is **immediately logged** at the current match time ($t$) with default lead/lag envelopes. The coder never risks losing the event if they get distracted.
3. **Transient Modifier Overlay:** A non-blocking, transient modifier HUD appears for a configurable window ($\tau$, default $1.5\text{s}$):
   - **Circle Entry (`CE`):**
     - Sub-key `1` or Touch Pill: **Left**
     - Sub-key `2` or Touch Pill: **Center**
     - Sub-key `3` or Touch Pill: **Right**
   - **Shot (`SHOT`):**
     - Sub-key `1` or Touch Pill: **Goal**
     - Sub-key `2` or Touch Pill: **Save**
     - Sub-key `3` or Touch Pill: **Wide / Post**
     - Sub-key `4` or Touch Pill: **Penalty Corner Won**
4. **Resolution Mechanics:**
   - **Modifier Pressed ($<\tau$):** The modifier attaches to the event immediately as a label (`label_flank: Left` or `label_outcome: Goal`). The HUD dismisses with subtle positive feedback.
   - **Timeout Reached ($=\tau$):** The HUD decays gracefully. The event remains logged as an unlabelled base event.
   - **Next Event Tagged ($<\tau$):** If another primary event key is pressed before $\tau$ expires, the active overlay auto-commits the prior event as base and immediately pivots to the new event's modifier HUD.
   - **Cancellation:** Pressing `Escape` or `Space` (pause/play) dismisses the modifier HUD without altering the logged base event. `Ctrl+Z` un-logs the base event.

### 2.2 Ergonomics: Dual Input Bar
* **Desktop / Laptop:** 1-hand hotkeys. The left hand rests on `C` / `S`, fingers can flick `1`, `2`, `3` effortlessly without looking away from the video.
* **Mobile / Sideline:** When a primary touch button is tapped, the modifier dock sprouts directly within comfortable thumb sweep radius ($\ge 44\text{px}$ touch targets).

---

## 3. Sportscode XML Fidelity
Compound tags map directly into Sportscode XML `<ALL_INSTANCES>` with nested `<label>` tags:

```xml
<instance>
  <ID>12</ID>
  <start>412.50</start>
  <end>427.50</end>
  <code>FIRE Circle Entry</code>
  <label>
    <group>Flank</group>
    <text>Left</text>
  </label>
</instance>
```

---

## 4. Spike Questions for User Validation

1. **Decay Window ($\tau$):** Does $1.5\text{s}$ provide enough time at $1.5\times$ or $2\times$ video speed, or does $1.2\text{s}$ feel snappier?
2. **Visual Noise:** Does a countdown ring or progress line distract from the pitch action?
3. **Touch Layout:** On mobile, should the modifier chips pop directly over the clicked button or dock to the bottom thumb bar?

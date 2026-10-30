# Single-Pass Compound Tagging (Friction 2 Spike)

**Status:** Prototype ready for ergonomic testing.  
**Prototype:** [prototype.html](prototype.html)  
**Target:** Eliminate the post-match secondary labeling slog (Friction 2) across **both 1x live sideline coding and 1.5x/2x video coding**.

---

## 1. Problem Statement & Dual Contexts

The "two-pass coding slog" exists in two distinct coaching environments:

1. **Live Sideline Coding ($1\times$ Real Time):**
   * **Persona:** Bench Coach / Manager (one-handed phone or tablet in outdoor weather) or Sideline Volunteer / Helper.
   * **Constraint:** Attention is split between managing subs/cards and watching live play on the pitch. The coder taps by spatial memory, glances down for $\le 0.5\text{s}$ to verify, and looks back up.
   * **Friction:** If adding modifiers requires opening a modal, navigating screens, or doing a second pass after the match, the helper skips modifiers completely or the coach falls behind live play.

2. **Video Replay Coding ($1\times$, $1.5\times$, $2\times$ Video Time):**
   * **Persona:** Dedicated Analyst or Coach tagging from match MP4.
   * **Constraint:** Tagging at $1.5\times$ or $2\times$ speed cuts game footage down to 30–40 mins, but having to re-watch or sweep every clip for flank/outcome adds another 15+ minutes.
   * **Friction:** A required second pass breaks momentum.

---

## 2. Interaction Contract

### 2.1 The Transient Sub-Key Overlay
1. **Primary Trigger:** The user triggers a base event via keyboard hotkey (e.g., `C` for Circle Entry, `S` for Shot) or touch tap.
2. **Immediate Event Logging:** The base event is **immediately logged** at the current match time ($t$) with default lead/lag envelopes. The coder never risks losing the event if distracted by live pitch action.
3. **Transient Modifier Overlay:** A non-blocking, transient modifier HUD appears for a configurable window ($\tau$):
   * **Live Sideline ($1\times$):** Recommended $\tau \approx 3.5\text{s}$ (allows an eyes-on-pitch coder to track the play, glance down, and tap the flank without rushing).
   * **Video Tagging ($1.5\times$ / $2\times$):** Recommended $\tau \approx 1.2\text{s}$–$1.5\text{s}$ (allows rapid keyboard flicking without waiting).
4. **Sub-Attributes Covered in Spike:**
   * **Circle Entry (`CE`):**
     * Sub-key `1` or Touch Pill: **Left**
     * Sub-key `2` or Touch Pill: **Center**
     * Sub-key `3` or Touch Pill: **Right**
   * **Shot (`SHOT`):**
     * Sub-key `1` or Touch Pill: **Goal**
     * Sub-key `2` or Touch Pill: **Save**
     * Sub-key `3` or Touch Pill: **Wide / Post**
     * Sub-key `4` or Touch Pill: **Penalty Corner Won**
5. **Resolution Mechanics:**
   * **Modifier Pressed ($<\tau$):** The modifier attaches to the event immediately as a label (`label_flank: Left` or `label_outcome: Goal`). The HUD dismisses with subtle positive feedback.
   * **Timeout Reached ($=\tau$):** The HUD decays gracefully. The event remains logged as an unlabelled base event.
   * **Next Event Tagged ($<\tau$):** If another primary event key is pressed before $\tau$ expires, the active overlay auto-commits the prior event as base and immediately pivots to the new event's modifier HUD.
   * **Cancellation:** Pressing `Escape` or `Space` (pause/play) dismisses the modifier HUD without altering the logged base event. `Ctrl+Z` un-logs the base event.

### 2.2 Live Sideline Glance Verification Bar
* In alignment with the Bench Coach invariant, the header displays:
  `Last: <Team> <Event> [Modifier] · mm:ss`
* Tapping the base event immediately updates the bar. Tapping the modifier immediately appends the label badge, giving the coder $0.5\text{s}$ visual confirmation before they return eyes to the pitch.

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

## 4. Key Questions for Testing

1. **Live $1\times$ Feel:** When running at $1\times$ live stopwatch time, does a $2.0\text{s}$ window give you enough breathing room to tap Circle Entry on the pitch, glance down to select Left/Center/Right, and look back up?
2. **Stress-Testing at $1.5\times$ and $2\times$:** When reviewing video at high speeds, does the decay feel natural or does $1.0\text{s}$–$1.2\text{s}$ feel better?
3. **Auto-Adaptive Decay:** Should the decay window automatically scale with the playback speed (e.g. $\tau = 2.0\text{s} / \text{speed}$)?

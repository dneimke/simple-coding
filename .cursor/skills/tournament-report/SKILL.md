---
name: tournament-report
description: >-
  Builds a coach-facing HTML tournament pack for one team from raw Sportscode
  XML: team summary, opposition, and match-ups, plus per-game sequence reports.
  Use when the user asks for a tournament report, a team summary across matches,
  collated match data, or the same pack produced for NSW Pride Men.
---

# Tournament report

One self-contained HTML pack for a head coach, plus one sequence report per match. The pack is a collation of the codes supplied. It is not a predictive model and not an AI summary.

Friction 3 (post-match assembly). The reader is the head coach.

## Inputs

- A folder of raw Sportscode XML for one competition block. Prefer the raw export when a `-converted.xml` sits beside it. Converted files already store an earned corner and the corner taken as two `PC` events.
- The focus team name, and a `--map` when a file uses another token (`NSW:PRIDE,QLD:BLAZE,PTX:THUNDER`).
- Decode UTF-16 before reading codes. The counter does this.

## Count before writing

Run the counter on the **raw** files. Publish its numbers. Do not re-sum `PC` or `SHOT` out of converted JSON.

```bash
node .cursor/skills/tournament-report/count-tournament.mjs --team PRIDE --map NSW:PRIDE,QLD:BLAZE,PTX:THUNDER a.xml b.xml
```

Sequence classification still comes from the converter and `buildSequences` in `src/spike/sequences/engine.js`. Those reports classify entries. They do not supply the tournament shot or corner totals.

### Counting rules

| Stat | Count | Do not count |
| --- | --- | --- |
| Field goals `(GOAL)` | `GOAL` / `Goal`, including a penalty-corner goal. | A shootout. That is a `Shootout-Goal` code, or a `SHOOTOUT` row whose label says goal. List those once, outside the score. |
| Shots `(SHOT)` | `SHOT`, `SHOTS`, `Shot` | `GSO`. `Shootout-Shot`. A `GSO` on the same timestamp as a shot is one moment, not a second shot. |
| Circle entries `(CE, AC Entry)` | `CE`, `CIRCLE ENTRY`, `AC Entry` | Direction-only rows (`Circle Entry Left`). A bare `AC` box. |
| 25m entries `(A25E)` | `A25E`, `A25 ENTRY`, `25yd Entry` | A bare `A25` zone box. |
| Penalty corners `(PC, ASC)` | One corner. Award (`ASC`, `PC Won`) and taken (`PC`, `PCA`) within 90 seconds are the same corner. | Do not add the award to the corner. The converter's 3-second dedupe does not see this pair. |
| Ball won `(BW1)`, `(BW3, BW4)` | Zone tags after conversion | Files with no ball-won codes. Say so. Do not classify their entries as build-up. |

`GSO` is reported beside shots and is the subject of a question. It is not added into the shot total.

A repeated circle tag inside one possession is two tags and one attack. Say so next to the counter list. That is a coding note. Earned versus taken is not. It is the corner count.

Omit cards. A file can carry an implausible card volume that is not a coaching result.

Rates are ratios of the rows above them. Do not give a rate its own code.

When a code is absent, show the count that exists and leave origin blank. A grey number is a count with no origin. A tie is left out of an alignment fraction: four of five, not four of six, when one match is level.

## Sequence reports

For each raw file:

```bash
node scripts/convert-sportscode-xml.js "<raw.xml>" --name "<match-slug>" --out-dir "<out>" --map-team "FROM:TO,..."
node spikes/sequences/run.js "<out>/<match-slug>-converted.json" --id "<match-slug>"
```

Keep the per-game `*-sequences.md`. The tournament page links to them. Do not quote the converter's corner or shot totals in the pack. Those totals still merge codes the counter keeps apart.

Origin rules, stated once beside that table: a counter is an entry within 10 seconds of a ball won; the possession window is 25 seconds; a circle entry replaces the 25m entry from the same possession.

## Page

One HTML file, `sequences/<team-slug>-tournament.html`, next to the games. Copy it to `spikes/sequences/out/<team-slug>/`.

Order, and nothing else above the fold:

1. **Lead.** Three figures, focus team then opponents: field goals, goals per shot, goals per circle entry. A fourth line: how often the team with more shots, circle entries, or penalty corners also scored more field goals.
2. **Questions.** See below.
3. **Coding notes.** Only file gaps and double tags that are still in the count. Missing turnover codes use this sentence: "The coded files supplied for these games did not contain turnover codes."
4. **Team.** The focus team's totals against the opponents combined. Codes in parentheses on the name, muted.
5. **Opponents.** One row per match. Cells are focus–opponent. Caption: each opponent is this match, not that team's tournament.
6. **Match-ups.** For shots, circle entries, and penalty corners: in how many matches the side with more also scored more field goals. Name the miss.
7. **Where 25m and ball-won exist.** Only those matches. 25m entries, circle entries, circle entries per 25m entry, field goals, goals per circle entry, `BW1`, `BW3`–`BW4`.
8. **Origin.** Counter and build-up for the matches that have ball-won tags. Then the per-match split, linking each sequence report. Then the focus team's counter list. Highlight a second circle tag in the same possession.

No charts. No second copy of a total. No dashboard. The lead figures are the only large type.

Scores are field goals, focus–opponent.

### Questions

At most five. Each one sits under the figure it would change. Skip a question when its premise is absent (no `GSO`, no `A25E`, no ball-won tags).

Voice: one sentence of fact, one question. No "we", no survey, no invitation to "share feedback".

| After | Question |
| --- | --- |
| Lead figures | More circle entries and more corners, fewer field goals. Is the review about the chance, or about the finish? |
| Shot total | If a GSO is not a shot, {team} are {shot total} and the opponents are {opponent shot total}. Which count belongs here? |
| Match-ups | More shots went with more field goals in {a} of {b} matches. Is that an indicator you would teach, or a feature of this block? |
| 25m chain | {Team} turned more 25m entries into circle entries, then scored from fewer of them. Where in that chain would you coach? |
| Counter rule | Ten seconds is the cut used here. What interval would you use? |

Adapt the lead and chain questions when the direction is reversed. Do not ask them if the two sides are level.

Style the question with `.ask`: a pale blue ground (`#f3f6fb`), ink `#1e3a5f`, and a `::before` circled `?` on `#d9e6f5` / `#1d4e89`. Coding notes stay on the orange bar. Do not use that orange for a question.

### Stat names

```html
<th>Field goals <span class="code">(GOAL)</span></th>
<th>Shots <span class="code">(SHOT)</span></th>
<th>Circle entries <span class="code">(CE, AC Entry)</span></th>
<th>Penalty corners <span class="code">(PC, ASC)</span></th>
<th>25m entries <span class="code">(A25E)</span></th>
<th>Ball won <span class="code">(BW1)</span></th>
```

`.code` is muted and lighter than the name. Caption on corners: "A penalty corner is counted once: earned and taken are the same corner."

## Check before handing the file over

- Lead field goals equal the sum of the match column, and neither includes a shootout goal.
- Shot total equals the counter's `shots`, not `shots + gso`.
- Corner total equals the counter's `penaltyCorners`, and no match is about double the awards or the corners taken.
- A match with no ball-won codes is not in the counter share.
- Every question's numbers match the table under it.
- Open the HTML. The lead is the first thing on the page. Questions are visibly quieter than the figures and distinct from the orange notes.

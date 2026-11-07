# Attacking entries — Circle entry fixture

Standalone spike. Classifies 25m entries (A25E) and circle entries (CE) as Counter or Build-Up without modifying the coded match.

| Rule | Value |
| --- | --- |
| Gap that ends a possession window | 25s |
| Counter window after Ball Won | 10s |
| Event time | timeMs on the coded event |
| Source events modified | no |
| Built in | 2.07ms |

- Circle entries (CE): 8 total — 2 Counter, 6 Build-Up.
- 25m entries (A25E): 1 total — 0 Counter, 1 Build-Up.

| Entry type | Total | Counter | Build-Up |
| --- | ---: | ---: | ---: |
| Circle entries (CE) | 8 | 2 | 6 |
| 25m entries (A25E) | 1 | 0 | 1 |

## FIRE

### Circle entries (CE) — 7 (2 Counter, 5 Build-Up)

**Counter · Q1 01:08 (video 01:08)**

01:00 BW1 → 01:04 A25E → 01:08 CE

8s after BW1 · Seek 00:50. Events a1, a2, a3.

**Build-Up · Q1 02:10 (video 02:10)**

02:10 CE

No prior same-team tag in 25s · Seek 02:00. Events b2.

**Build-Up · Q1 03:28 (video 03:28)**

03:20 BS3 → 03:28 CE

8s after BS3 · Seek 03:10. Events c1, c2.

**Build-Up · Q1 05:12 (video 05:12)**

05:00 BW2 → 05:12 CE

12s after BW2 (over 10s counter window) · Seek 04:50. Events d1, d2.

**Build-Up · Q1 06:46 (video 06:46)**

06:40 A25E → 06:46 CE

6s after A25E · Seek 06:30. Events e1, e2.

**Build-Up · Q1 10:04 (video 10:04)**

10:00 A25E → 10:04 CE

4s after A25E · Seek 09:50. Events g1, g2.

**Counter · Q2 01:04 (video 16:04)**

16:00 BW1 → 16:04 CE

4s after BW1 · Seek 15:50. Events h1, h2.

### 25m entries (A25E) — 1 (0 Counter, 1 Build-Up)

**Build-Up · Q1 01:40 (video 01:40)**

01:40 A25E

No prior same-team tag in 25s · Seek 01:30. Events b1.

## TIGERS

### Circle entries (CE) — 1 (0 Counter, 1 Build-Up)

**Build-Up · Q1 08:30 (video 08:30)**

08:20 OH → 08:26 A25E → 08:30 CE

10s after OH · Seek 08:10. Events f1, f2, f3.

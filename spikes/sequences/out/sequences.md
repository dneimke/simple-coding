# Attacking entries — Circle entry fixture

Standalone spike. Classifies 25m entries (A25E) and circle entries (CE) as Counter or Build-Up without modifying the coded match.

| Rule | Value |
| --- | --- |
| Gap that ends a possession window | 15s |
| Counter window after Ball Won | 10s |
| Event time | timeMs on the coded event |
| Source events modified | no |
| Built in | 1.82ms |

- Circle entries (CE): 8 total — 2 Counter, 6 Build-Up.
- 25m entries (A25E): 5 total — 1 Counter, 4 Build-Up.

| Entry type | Total | Counter | Build-Up |
| --- | ---: | ---: | ---: |
| Circle entries (CE) | 8 | 2 | 6 |
| 25m entries (A25E) | 5 | 1 | 4 |

## FIRE

### Circle entries (CE) — 7 (2 Counter, 5 Build-Up)

**Counter · Q1 01:08 (video 01:08)**

01:00 BW1 → 01:04 A25E → 01:08 CE

8s after BW1 · Seek 00:55. Events a1, a2, a3.

**Build-Up · Q1 01:56 (video 01:56)**

01:56 CE

No prior same-team tag in 15s · Seek 01:56. Events b2.

**Build-Up · Q1 03:28 (video 03:28)**

03:20 BS3 → 03:28 CE

8s after BS3 · Seek 03:20. Events c1, c2.

**Build-Up · Q1 05:12 (video 05:12)**

05:00 BW2 → 05:12 CE

12s after BW2 (over 10s counter window) · Seek 05:00. Events d1, d2.

**Build-Up · Q1 06:46 (video 06:46)**

06:40 A25E → 06:46 CE

6s after A25E · Seek 06:40. Events e1, e2.

**Build-Up · Q1 10:04 (video 10:04)**

10:00 A25E → 10:04 CE

4s after A25E · Seek 10:00. Events g1, g2.

**Counter · Q2 01:04 (video 16:04)**

16:00 BW1 → 16:04 CE

4s after BW1 · Seek 16:00. Events h1, h2.

### 25m entries (A25E) — 4 (1 Counter, 3 Build-Up)

**Counter · Q1 01:04 (video 01:04)**

01:00 BW1 → 01:04 A25E

4s after BW1 · Seek 00:55. Events a1, a2.

**Build-Up · Q1 01:40 (video 01:40)**

01:40 A25E

No prior same-team tag in 15s · Seek 01:40. Events b1.

**Build-Up · Q1 06:40 (video 06:40)**

06:40 A25E

No prior same-team tag in 15s · Seek 06:40. Events e1.

**Build-Up · Q1 10:00 (video 10:00)**

10:00 A25E

No prior same-team tag in 15s · Seek 10:00. Events g1.

## TIGERS

### Circle entries (CE) — 1 (0 Counter, 1 Build-Up)

**Build-Up · Q1 08:30 (video 08:30)**

08:20 OH → 08:26 A25E → 08:30 CE

10s after OH · Seek 08:20. Events f1, f2, f3.

### 25m entries (A25E) — 1 (0 Counter, 1 Build-Up)

**Build-Up · Q1 08:26 (video 08:26)**

08:20 OH → 08:26 A25E

6s after OH · Seek 08:20. Events f1, f2.

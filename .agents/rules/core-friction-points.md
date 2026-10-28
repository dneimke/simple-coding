---
trigger: always_on
description: "Product gate for every change. simple-coding exists to remove three frictions: game setup divergence, the two-pass coding slog, and post-match clip assembly. If a change reduces none of them, do not implement it."
---

# Product gate

Before implementing, refactoring, or locking a dispatch contract, name which friction the change reduces. If it reduces none of them, stop and say so. Do not add scope that leaves all three bottlenecks untouched.

A bugfix or refactor is in scope only when it restores an invariant in the document below, or repairs a regression in an existing solution to one of the three frictions. Name that friction or invariant.

The canonical statement follows.

@[Core Friction Points & Product Intent](../../docs/core-friction-points.md)

# Sim performance baseline

Recorded: 2026-06-15  
Commit: `ceb9d87`  
Runners: `packages/sim/perf/aiDecision.bench.ts`, `packages/sim/perf/intelStore.bench.ts`, `packages/sim/perf/diplomacy.bench.ts`

## Methodology

| Parameter | Value |
|-----------|-------|
| Decision micro-bench | warmup 25, 100 samples, median + p95 |
| `advanceTo` macro-bench | warmup 25, 5 timed runs, median + p95 |
| Fixed clock | `BENCH_START_MS = 1700000000000` |
| Decision world | synthetic ring (`buildBenchWorld`) |
| Skip world | `createSprint4World` |
| Legibility sample | 24h sprint4 event batch (30 events) |

Determinism: worlds use fixed seeds and timestamps. Wall-clock times vary by machine — compare against **this** file on the same hardware, not across unrelated environments.

## AI decision cost (`collectAiOrders`)

One 6h decision tick, all AI factions.

| AI factions | Territories | Median | p95 |
|-------------|-------------|--------|-----|
| 2 | 3 | 90.2 µs | 291.9 µs |
| 4 | 5 | 236.3 µs | 460.0 µs |
| 8 | 9 | 1.39 ms | 1.69 ms |

**Scaling read:** cost should grow roughly linearly with AI faction count (each faction runs the same scorer pipeline once).

## Time engine (`advanceTo` on `createSprint4World`)

Full catch-up simulation including AI ticks, movement, combat, economy.

| Skip | Events emitted | Median | p95 |
|------|----------------|--------|-----|
| 6h skip | 8 | 204.4 µs | 377.6 µs |
| 24h skip | 30 | 859.2 µs | 1.00 ms |
| 72h skip | 96 | 3.66 ms | 4.07 ms |

**Cadence note:** mobile foreground catch-up runs this path when the app resumes; sub-100ms at 24h is comfortable on dev hardware; 72h is the stress case.

## Legibility observer overhead (24h sprint4)

Pure read/render work on the emitted event list — not on the hot simulation path unless the UI renders dispatches.

| Operation | Median | p95 |
|-----------|--------|-----|
| renderDigestText (uncompacted) | 23.0 µs | 33.8 µs |
| renderDigestText (player-filtered) | 70.9 µs | 167.0 µs |
| renderCompactDigestText (24h) | 14.3 µs | 52.2 µs |
| compactDispatchFeed (24h) | 11.6 µs | 21.3 µs |
| computeStance ×3 factions | 6.8 µs | 10.3 µs |

**Stack total (median):** 126.6 µs  
**Share of 24h `advanceTo` median:** 14.73%

At current sprint4 scale both sim and observers are sub-millisecond. The share ratio is useful for regression drift; absolute microseconds matter more for mobile UX until skips grow much larger.

Sprint 5.5 intel store and player-filtered dispatch reads are observer-only; overhead should stay a small fraction of simulation cost.

## Intel store (`createSprint4World`)

Merge, observation recording, and prune cost after 24h/72h simulation skips.

| Operation | Median | p95 |
|-----------|--------|-----|
| mergeAllTerritoryVisibility ×4 (24h world) | 12.0 µs | 18.9 µs |
| recordIntelObservations (24h world) | 9.9 µs | 14.9 µs |
| pruneExpiredRecords all factions (24h world) | 0.4 µs | 0.8 µs |
| mergeAllTerritoryVisibility ×4 (72h world) | 15.6 µs | 21.5 µs |
| recordIntelObservations (72h world) | 13.6 µs | 36.8 µs |
| pruneExpiredRecords all factions (72h world) | 0.5 µs | 0.7 µs |

**Record counts (all factions, post-skip):**

| Skip | Records |
|------|---------|
| 24h | 27 |
| 72h | 30 |

If merge or record counts grow superlinearly with skip length, treat as a Sprint 6 optimization candidate — do not tune in sprint close.

## Diplomacy (Sprint 6 — `createSprint4World`)

Alliance formation, breaking, AI diplomatic pass, and allied/treaty emission on a 24h allied world.

| Operation | Median | p95 |
|-----------|--------|-----|
| applyAiDiplomaticDecisions (sprint4) | 12.3 µs | 26.6 µs |
| formAlliance | 0.3 µs | 0.5 µs |
| breakAlliance | 1.3 µs | 1.7 µs |
| recordAlliedObservations (24h allied world) | 0.6 µs | 1.2 µs |
| recordTreatyObservations (24h allied world) | 0.2 µs | 0.3 µs |
| diplomacy intel pipeline per tick | 10.8 µs | 14.8 µs |

**Allied/treaty record counts (24h skip, steppe–britain alliance):** 7 allied, 0 treaty.

At four-faction sprint4 scale, diplomacy overhead per tick is negligible. Watch allied record growth if faction/alliance count scales in future sprints.

## Review thresholds (guidance)

| Check | Target | Rationale |
|-------|--------|-----------|
| `collectAiOrders` @ 4 AI | < 2 ms median | 6h AI cadence; plenty of headroom per tick |
| `advanceTo` 24h | < 150 ms median | imperceptible mobile catch-up on resume |
| Legibility stack / 24h sim | < 10% | observers must not dominate sim time |
| p95 / median ratio | < 3× | flags allocation spikes or GC noise |

## How to re-run

```bash
pnpm --filter sim bench:ai
pnpm --filter sim bench:intel
pnpm --filter sim bench:diplomacy
pnpm --filter sim bench:ai -- --write-baseline
```

Update this file when AI, clock, intel, or legibility paths change materially.

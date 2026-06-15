# Sim performance baseline

Recorded: 2026-06-15  
Commit: `6d774dc`  
Runners: `packages/sim/perf/aiDecision.bench.ts`, `packages/sim/perf/intelStore.bench.ts`

## Methodology

| Parameter | Value |
|-----------|-------|
| Decision micro-bench | warmup 25, 100 samples, median + p95 |
| `advanceTo` macro-bench | warmup 25, 5 timed runs, median + p95 |
| Fixed clock | `BENCH_START_MS = 1700000000000` |
| Decision world | synthetic ring (`buildBenchWorld`) |
| Skip world | `createSprint4World` |
| Legibility sample | 24h sprint4 event batch (15 events) |

Determinism: worlds use fixed seeds and timestamps. Wall-clock times vary by machine — compare against **this** file on the same hardware, not across unrelated environments.

## AI decision cost (`collectAiOrders`)

One 6h decision tick, all AI factions.

| AI factions | Territories | Median | p95 |
|-------------|-------------|--------|-----|
| 2 | 3 | 84.4 µs | 240.0 µs |
| 4 | 5 | 216.8 µs | 366.4 µs |
| 8 | 9 | 1.39 ms | 1.84 ms |

**Scaling read:** cost should grow roughly linearly with AI faction count (each faction runs the same scorer pipeline once).

## Time engine (`advanceTo` on `createSprint4World`)

Full catch-up simulation including AI ticks, movement, combat, economy.

| Skip | Events emitted | Median | p95 |
|------|----------------|--------|-----|
| 6h skip | 4 | 140.5 µs | 149.3 µs |
| 24h skip | 15 | 682.3 µs | 872.2 µs |
| 72h skip | 49 | 3.90 ms | 4.00 ms |

**Cadence note:** mobile foreground catch-up runs this path when the app resumes; sub-100ms at 24h is comfortable on dev hardware; 72h is the stress case.

## Legibility observer overhead (24h sprint4)

Pure read/render work on the emitted event list — not on the hot simulation path unless the UI renders dispatches.

| Operation | Median | p95 |
|-----------|--------|-----|
| renderDigestText (uncompacted) | 12.2 µs | 15.8 µs |
| renderDigestText (player-filtered) | 67.9 µs | 122.2 µs |
| renderCompactDigestText (24h) | 10.3 µs | 13.6 µs |
| compactDispatchFeed (24h) | 9.1 µs | 24.0 µs |
| computeStance ×3 factions | 4.3 µs | 4.7 µs |

**Stack total (median):** 103.8 µs  
**Share of 24h `advanceTo` median:** 15.21%

At current sprint4 scale both sim and observers are sub-millisecond. The share ratio is useful for regression drift; absolute microseconds matter more for mobile UX until skips grow much larger.

Sprint 5.5 intel store and player-filtered dispatch reads are observer-only; overhead should stay a small fraction of simulation cost.

## Intel store (`createSprint4World`)

Merge, observation recording, and prune cost after 24h/72h simulation skips.

| Operation | Median | p95 |
|-----------|--------|-----|
| mergeAllTerritoryVisibility ×4 (24h world) | 13.8 µs | 30.0 µs |
| recordIntelObservations (24h world) | 10.2 µs | 13.3 µs |
| pruneExpiredRecords all factions (24h world) | 0.4 µs | 0.7 µs |
| mergeAllTerritoryVisibility ×4 (72h world) | 15.2 µs | 20.7 µs |
| recordIntelObservations (72h world) | 13.2 µs | 16.6 µs |
| pruneExpiredRecords all factions (72h world) | 0.4 µs | 0.7 µs |

**Record counts (all factions, post-skip):**

| Skip | Records |
|------|---------|
| 24h | 20 |
| 72h | 20 |

If merge or record counts grow superlinearly with skip length, treat as a Sprint 6 optimization candidate — do not tune in sprint close.

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
pnpm --filter sim bench:ai -- --write-baseline
```

Update this file when AI, clock, intel, or legibility paths change materially.

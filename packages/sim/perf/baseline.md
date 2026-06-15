# Sim performance baseline

Recorded: 2026-06-15  
Commit: `cea0af2`  
Runner: `packages/sim/perf/aiDecision.bench.ts`

## Methodology

| Parameter | Value |
|-----------|-------|
| Decision micro-bench | warmup 25, 100 samples, median + p95 |
| `advanceTo` macro-bench | warmup 25, 5 timed runs, median + p95 |
| Fixed clock | `BENCH_START_MS = 1700000000000` |
| Decision world | synthetic ring (`buildBenchWorld`) |
| Skip world | `createSprint4World` |
| Legibility sample | 24h sprint4 event batch (14 events) |

Determinism: worlds use fixed seeds and timestamps. Wall-clock times vary by machine — compare against **this** file on the same hardware, not across unrelated environments.

## AI decision cost (`collectAiOrders`)

One 6h decision tick, all AI factions.

| AI factions | Territories | Median | p95 |
|-------------|-------------|--------|-----|
| 2 | 3 | 32.0 µs | 83.4 µs |
| 4 | 5 | 102.0 µs | 265.1 µs |
| 8 | 9 | 145.1 µs | 318.4 µs |

**Scaling read:** cost should grow roughly linearly with AI faction count (each faction runs the same scorer pipeline once).

## Time engine (`advanceTo` on `createSprint4World`)

Full catch-up simulation including AI ticks, movement, combat, economy.

| Skip | Events emitted | Median | p95 |
|------|----------------|--------|-----|
| 6h skip | 4 | 99.6 µs | 105.0 µs |
| 24h skip | 14 | 349.7 µs | 619.2 µs |
| 72h skip | 40 | 697.8 µs | 834.2 µs |

**Cadence note:** mobile foreground catch-up runs this path when the app resumes; sub-100ms at 24h is comfortable on dev hardware; 72h is the stress case.

## Legibility observer overhead (24h sprint4)

Pure read/render work on the emitted event list — not on the hot simulation path unless the UI renders dispatches.

| Operation | Median | p95 |
|-----------|--------|-----|
| renderDigestText (uncompacted) | 10.7 µs | 11.9 µs |
| renderCompactDigestText (24h) | 10.4 µs | 15.6 µs |
| compactDispatchFeed (24h) | 8.9 µs | 18.2 µs |
| computeStance ×3 factions | 4.1 µs | 5.6 µs |

**Stack total (median):** 34.1 µs  
**Share of 24h `advanceTo` median:** 9.75%

At current sprint4 scale both sim and observers are sub-millisecond. The share ratio is useful for regression drift; absolute microseconds matter more for mobile UX until skips grow much larger.

Sprint 5 dispatch/compaction/stance is observer-only; overhead should stay a small fraction of simulation cost.

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
pnpm --filter sim bench:ai -- --write-baseline
```

Update this file when AI, clock, or legibility paths change materially.

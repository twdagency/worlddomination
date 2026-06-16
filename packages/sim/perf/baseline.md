# Sim performance baseline

Recorded: 2026-06-16  
Commit: `5652e07`  
Runners: `packages/sim/perf/aiDecision.bench.ts`, `packages/sim/perf/intelStore.bench.ts`, `packages/sim/perf/diplomacy.bench.ts`

## Methodology

| Parameter | Value |
|-----------|-------|
| Decision micro-bench | warmup 25, 100 samples, median + p95 |
| `advanceTo` macro-bench | warmup 25, 5 timed runs, median + p95 |
| Fixed clock | `BENCH_START_MS = 1700000000000` |
| Decision world | synthetic ring (`buildBenchWorld`) |
| Skip world | `createSprint4World` |
| Legibility sample | 24h sprint4 event batch (28 events) |

Determinism: worlds use fixed seeds and timestamps. Wall-clock times vary by machine — compare against **this** file on the same hardware, not across unrelated environments.

## AI decision cost (`collectAiOrders`)

One 6h decision tick, all AI factions.

| AI factions | Territories | Median | p95 |
|-------------|-------------|--------|-----|
| 2 | 3 | 85.7 µs | 223.4 µs |
| 4 | 5 | 228.0 µs | 432.4 µs |
| 8 | 9 | 1.34 ms | 1.66 ms |

**Scaling read:** cost should grow roughly linearly with AI faction count (each faction runs the same scorer pipeline once).

## Time engine (`advanceTo` on `createSprint4World`)

Full catch-up simulation including AI ticks, movement, combat, economy.

| Skip | Events emitted | Median | p95 |
|------|----------------|--------|-----|
| 6h skip | 8 | 161.3 µs | 191.4 µs |
| 24h skip | 28 | 930.3 µs | 1.12 ms |
| 72h skip | 95 | 4.13 ms | 4.35 ms |

**Cadence note:** mobile foreground catch-up runs this path when the app resumes; sub-100ms at 24h is comfortable on dev hardware; 72h is the stress case.

## Legibility observer overhead (24h sprint4)

Pure read/render work on the emitted event list — not on the hot simulation path unless the UI renders dispatches.

| Operation | Median | p95 |
|-----------|--------|-----|
| renderDigestText (uncompacted) | 22.7 µs | 35.0 µs |
| renderDigestText (player-filtered) | 65.2 µs | 111.4 µs |
| renderCompactDigestText (24h) | 14.2 µs | 21.5 µs |
| compactDispatchFeed (24h) | 11.4 µs | 27.3 µs |
| computeStance ×3 factions | 6.4 µs | 9.7 µs |

**Stack total (median):** 119.9 µs  
**Share of 24h `advanceTo` median:** 12.89%

At current sprint4 scale both sim and observers are sub-millisecond. The share ratio is useful for regression drift; absolute microseconds matter more for mobile UX until skips grow much larger.

Sprint 5.5 intel store and player-filtered dispatch reads are observer-only; overhead should stay a small fraction of simulation cost.

## Intel store (`createSprint4World`)

Merge, observation recording, and prune cost after 24h/72h simulation skips.

| Operation | Median | p95 |
|-----------|--------|-----|
| mergeAllTerritoryVisibility ×4 (24h world) | 12.1 µs | 21.0 µs |
| recordIntelObservations (24h world) | 9.9 µs | 12.2 µs |
| pruneExpiredRecords all factions (24h world) | 0.4 µs | 0.5 µs |
| mergeAllTerritoryVisibility ×4 (72h world) | 17.7 µs | 22.7 µs |
| recordIntelObservations (72h world) | 13.9 µs | 18.5 µs |
| pruneExpiredRecords all factions (72h world) | 0.5 µs | 0.9 µs |

**Record counts (all factions, post-skip):**

| Skip | Records |
|------|---------|
| 24h | 25 |
| 72h | 28 |

If merge or record counts grow superlinearly with skip length, treat as a Sprint 6 optimization candidate — do not tune in sprint close.

## Diplomacy (Sprint 6 — `createSprint4World`)

Alliance formation, breaking, AI diplomatic pass, and allied/treaty emission on a 24h allied world.

| Operation | Median | p95 |
|-----------|--------|-----|
| applyAiDiplomaticDecisions (sprint4) | 12.4 µs | 18.7 µs |
| formAlliance | 0.2 µs | 0.4 µs |
| breakAlliance | 1.2 µs | 1.3 µs |
| recordAlliedObservations (24h allied world) | 0.4 µs | 0.6 µs |
| recordTreatyObservations (24h allied world) | 0.1 µs | 0.2 µs |
| diplomacy intel pipeline per tick | 10.6 µs | 13.4 µs |

**Allied/treaty record counts (24h skip, steppe–britain alliance):** 6 allied, 0 treaty.

At four-faction sprint4 scale, diplomacy overhead per tick is negligible. Watch allied record growth if faction/alliance count scales in future sprints.

## Save migration (`ensureWorldMigrations` — Sprint 7a)

Additive merge on load — not on the `advanceTo` hot path.

| Operation | Median | p95 |
|-----------|--------|-----|
| ensureWorldMigrations (legacy save) | 3.5 µs | 4.7 µs |
| ensureWorldMigrations (fresh save) | 6.8 µs | 9.2 µs |

Legacy save fixture strips `scout-t1`, `leader-philip`, and pre-Sprint-6 diplomacy fields.

## Mobile dashboard selectors (Sprint 7a)

Pure-logic selector stack on 24h-advanced `createSprint4World` — measured in `apps/mobile/src/game/sprint7a.coldPlay.test.ts` (budget < 15 ms each, dev hardware).

| Selector | Budget |
|----------|--------|
| getDashboardCatchUpSummary | < 15 ms |
| getDashboardUrgentItems | < 15 ms |
| getDashboardEmpireSummary | < 15 ms |
| getDashboardNavCards | < 15 ms |
| getDashboardUrgentCount | < 15 ms |

Component render cost is not instrumented in Sprint 7a; selector cost is the proxy for Dashboard data prep.

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

# Sprint 10 — Risk Register

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R1 | **Cycle untangling** surfaces import errors during Phase 1 refactor | Medium | Medium | Break 6 cycles only; madge after each sub-phase; ~10 contract tests; stop-and-report |
| R2 | **Faction → Country rename** large diff; high test fixture impact | High | Medium | IDs stay opaque; type alias only in Phase 3; no dispatch payload rename; ~8 migration tests |
| R3 | **AI accelerator usage** creates more dispatch events; perf and digest noise | Medium | Medium | Cap 1 AI influence order per actor per day; digest filter patterns from Sprint 9.5 income work |
| R4 | **AI Coup against player cities** is high-stakes; cold-play feedback intense | Medium | High | Posture + score thresholds conservative in Phase 5; tutorial suppression; balance pass Phase 8 |
| R5 | **Intelligence** new intel pathway competes with scout intel | Low | Medium | Enriched-only fields for intelligence source; scout stays basic; distinct dispatch line |
| R6 | **Annexation** peaceful transfer surfaces defeat cascade edge cases | Medium | High | Reuse `captureCityForCoup` pipeline; explicit Phase 7 tests for capital/last-city; reputation cascade |
| R7 | **Multi-signal AI scoring** tuning is open-ended | High | Medium | Max-score pattern; conservative defaults; cold-play iteration in Phase 9 not blocking ship |
| R8 | **Tutorial regression** if AI uses new behaviors in tutorial scenario | Medium | High | `scenarioId.startsWith('tutorial')` guard on AI influence; existing playthrough test + contract todo |
| R9 | **Scope creep** — 9 content/cleanup phases ambitious | Medium | High | Locked out-of-scope list; backlog to `deferred-backlog.md`; stop-and-report per phase |

## Phase estimate adjustments (post Phase 0 audit)

| Phase | Original est. | Adjusted | Notes |
|-------|---------------|----------|-------|
| 0 | minimal | minimal | Complete — audit only |
| 1 | ~10 | **~12** | +2 for `territoryOwnership` extraction tests |
| 2 | ~12 | ~12 | Passive influence in `scoreDefend`/`scoreAttack` — straightforward |
| 3 | ~8 | ~8 | No dispatch field rename — scope contained |
| 4 | ~18 | **~20** | +2 for per-accelerator AI caps + tutorial guard |
| 5 | ~18 | ~18 | Coup vs player needs careful threshold tests |
| 6 | ~14 | **~16** | +2 for enriched intel snapshot contracts |
| 7 | ~16 | **~18** | +2 for annexation defeat cascade edge cases |
| 8 | ~8 | ~10 | +2 for influence dispatch surfacing in mobile |
| 9 | manual | manual | Real-device cold-play |
| **Total new** | **~104** | **~116** | Target **~958+**; **~130** with snapshot churn buffer → **~970+** |

## Unexpected findings (Phase 0)

1. **Madge reports 12 chains + diplomaticAi pair** — Sprint 9.5 backlog listed 12; inventory matches. Shared package adds 2 more cycles outside sim Phase 1.
2. **Faction string refs grew ~47%** since Sprint 8 (2,642 vs ~1,800) — influence layer; rename is larger than Sprint 8 planned but ID-stable approach still valid.
3. **No unified AI scoring** — Sprint 10 must introduce `aiInfluenceScoring.ts`; cannot extend a single framework that does not exist.
4. **`collectAiOrders` has zero influence** — AI agency is entirely new tick path, not extension of military `decideOrders`.
5. **Sprint 9.5 audit item: AI-initiated treaty proposals** — explicitly out of scope Sprint 10; do not conflate with influence agency work.

# Sprint 9 — Risk Register

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R1 | **Influence storage shape** (`city × actor`) touches many test fixtures and snapshots | High | Medium | `ensureWorldInfluence` defaults `{}`; add factory helper `withInfluence(world, patches)`; run snapshot review only in phases that change dispatch text; keep `intel.forwardcompat.test.ts` untouched |
| R2 | **Passive accumulation every tick** — O(cities × actors) if naive | Medium | Medium | Accrue on day boundary with `lastAccrualAt`; only iterate cities with nonzero influence + adjacent foreign ownership; perf bench in Phase 1 if >1ms/tick on tutorial world |
| R3 | **Threshold action UI overlaps** Sprint 7c order/deep-link patterns | Medium | Low | Reuse `presetDestinationId` / `navigateTo`; single `influenceActionEligibility` module; extend `orderScreenPreset.test.tsx` |
| R4 | **Tooltip system is new infrastructure** — tutorial regression | Medium | Medium | Tooltip IDs isolated from tutorial beats; test dismiss + persistence; manual cold-play checklist item in Phase 10 |
| R5 | **Defeated country × influence** — stale influence on conquered/defeated cities | Medium | High | `clearInfluenceForCountry` in defeat cascade; block actions vs `country.defeated`; World screen defeated filter already separate |
| R6 | **Visibility / fog** — other-player influence magnitudes | Medium | Medium | Separate influence fog bands from intel tristate; only show bands when `intel.state !== 'unknown'`; own values always exact |
| R7 | **`covertOp.subvert` name collision** with Subversion accelerator | Low | Medium | New order kind or `influenceAccelerator` enum — do not overload covert op |
| R8 | **Phase scope creep** — Set B has 11 actions; only 4 in Sprint 9 | Medium | High | Phase plan locked; defer 7 actions + AI agency to Sprint 10 in backlog; stop-and-report after each phase |
| R9 | **`world.nowMs` vs wall clock** for influence timestamps | Low | High | Canon rules in `design-canon.md` Event ordering & time — all accrual/decay/read-state uses `world.nowMs` |
| R10 | **Tutorial `tutorial.ts` import isolation** | Low | Medium | Influence in `influence.ts` + scenario seed only; beat copy in `shared`; CI grep optional |

## Phase estimate adjustments (post-audit)

| Phase | Original est. | Adjusted | Notes |
|-------|---------------|----------|-------|
| 0 | minimal | minimal | — |
| 1 | ~18 | ~20 | +2 for migration + defeat clear contract tests |
| 2 | ~15 | ~15 | Order kind naming decision in Phase 2 start |
| 3 | ~8 | ~8 | — |
| 4–7 | ~51 | ~51 | — |
| 8 | ~12 | ~14 | +2 for deep link param tests |
| 9 | ~10 | ~12 | +2 for tooltip persistence tests |
| 10 | manual | manual | — |
| **Total new** | **~120** | **~125** | Target **~773+** tests (646 baseline) |

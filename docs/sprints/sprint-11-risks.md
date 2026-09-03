# Sprint 11 — Risk register

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R1 | **Phase 1 aimed at stale "6 sim chains"** | High if ignored | Medium | Re-measure first; current madge is 3 cycles (1 new sim + 2 shared) |
| R2 | **Shared↔sim barrel break** forces scenario factory moves | Medium | Medium | Types-only export path; keep `createSprintNWorld` signatures stable |
| R3 | **`factionId` → `countryId`** breaks saved games and snapshots | High | High | Additive migration; dual-read one release; Phase 2 isolated from Annexation |
| R4 | **Annexation** reuses coup capture and trips defeat/alliance edges | Medium | High | Reuse `territoryOwnership`; tests for capital, last city, tribute cancel, influence clear (Sprint 10 audit §6) |
| R5 | **Cadence re-opened** mid-sprint undoes P0-2 | Medium | High | Confirm locked channel; Annexation on spend side; only retune if playtest shows stall |
| R6 | **Tutorial isolation** if Annexation AI fires in tutorial | Medium | High | Existing `isInfluenceAgencyDisabled` / tutorial scenario guard; playthrough unchanged |
| R7 | **Set B "eleven actions"** has no in-repo list | High | Low | Phase 3 ships **Annexation** only; do not invent five unnamed actions |
| R8 | **Scope creep** (notifications, Territory→City, slugs) | Medium | High | Locked Sprint 12 / optional; stop-and-report |

## Phase estimate

| Phase | Est. new tests | Notes |
|-------|----------------|-------|
| 0 | placeholders | This pass |
| 1 | ~10 | 3 cycles + optional barrel / madge guard |
| 2 | ~12 | Event field migration + snapshot churn |
| 3 | ~18 | Annexation + AI spend-channel + reputation cascade (Sprint 10 Phase 7 leftover) |
| 4 | manual | Cold-play + tag |
| **Total new** | **~40** | Target **~1,030+** |

## Unexpected findings (Phase 0)

1. **Sprint 10 deferred 6 sim chains are gone.** Phase 1 of Sprint 10 exceeded its target (12 → 0 sim). Planning from `sprint-10.md` out-of-scope without re-running madge would have been busywork.
2. **One new sim cycle landed after Phase 1** — tutorial action-cap in `movement.ts` closed a loop through `tutorial` → `dispatch.playerFactionId`. Classic hub relapse.
3. **P0-2 cadence is already implemented** (`influenceChannel.ts`, `influence.playerCadence.test.ts`). Phase 3 is confirmation + Annexation on the spend side, not a greenfield pacing debate.
4. **Original Set B eleven** is not enumerated in docs. Shipped threshold actions: Pressure, Tribute, Coup, Defection, Intelligence. Named unshipped: **Annexation**. Canon still defers unrest / fund factions at 30+.

# Sprint 10 — Require-cycle audit

**Branch:** `sprint-10/ai-agency` from `sprint-9-final` @ `571d909`  
**Tool:** `madge --circular packages/sim/src/index.ts`

## Phase 1 results (complete)

| Metric | Before | After |
|--------|--------|-------|
| Sim cycles | **15** (12 chains + 3 direct edges in madge output) | **0** |
| Shared-package cycles | 2 | 2 (unchanged — Sprint 11) |
| Files processed | 58 | 68 |

**All 12 sim require cycles resolved** (exceeded Phase 1 target of 6). Collateral extractions (`beatId.ts`, `diplomaticPair.ts`, `dispatchFormatHelpers.ts`, `tributeLifecycle.ts`) broke remaining hub edges without additional scope.

### Resolved extractions (P1–P6)

| ID | Status | Module(s) |
|----|--------|-----------|
| P1 | **Resolved** | `diplomaticScoring.ts` — breaks `diplomaticAi` ↔ `playerDiplomacy` |
| P2 | **Resolved** | `diplomaticEvents.ts`, `diplomaticPair.ts`, `beatId.ts` — breaks `diplomacy` ↔ `diplomaticDispatch` |
| P3 | **Resolved** | `diplomaticDispatchLines.ts`, `dispatchFormatHelpers.ts` — breaks `diplomaticDispatch` ↔ `dispatch` |
| P4 | **Resolved** | `territoryOwnership.ts`, `tributeLifecycle.ts` — breaks `country` ↔ `influenceActions` |
| P5 | **Resolved** | Verified — no `influenceActions` → `country` import after P4 |
| P6 | **Resolved** | `influenceOrderMessages.ts`, `influenceOrderValidation.ts` — breaks `dispatch` → `influenceAccelerators` |

`diplomaticDispatch.ts` is now a re-export barrel over `diplomaticEvents.ts` (backward compat).

### Sprint 11 defer

No sim cycles remain. Sprint 11 hygiene is optional hardening only:

- Shared package dilemmas cycles (#14–15): `beatController` ↔ `dilemmas` ↔ `foreignRule`
- Consider folding `dispatchFormatHelpers` into a broader dispatch layering pass if new formatters accumulate

---

## Phase 0 baseline (pre-Phase 1)

**Tool:** `madge --circular packages/sim/src/index.ts` (58 files processed)

## Summary

| Metric | Value |
|--------|--------|
| Sim cycles (from `index.ts`) | **12 chains** (+ 1 direct pair = 13 sim concerns) |
| Shared-package cycles | **2** (dilemmas — out of Sprint 10 Phase 1 scope) |
| **Phase 1 target** | **6 cycles broken** (moderate scope) — **exceeded: all 12** |
| **Sprint 11 defer** | **shared dilemmas only** |

## Hub modules (files in multiple cycles)

| Module | Cycle appearances | Role |
|--------|-------------------|------|
| `dispatch.ts` | 10 | Formatting + feed construction; imports influence rejection formatters |
| `diplomaticDispatch.ts` | 9 | Event draft builders + imports dispatch formatters |
| `diplomacy.ts` | 8 | State mutations; imports dispatch for alliance recall events |
| `influenceAccelerators.ts` | 9 | Order validation + `applyInfluenceOrders`; imports movement + influenceActions |
| `country.ts` | 3 | Country sync; imports diplomacy for defeat cascade |
| `influenceActions.ts` | 3 | Threshold actions; imports diplomacy + country |
| `movement.ts` / `arrivalCombat.ts` / `intelDispatch.ts` | 4 each | Combat → intel report emission chain |

**Root cause:** Sprint 9 influence layer routed validation and formatting through existing diplomacy/dispatch hubs instead of extracted leaf modules. `dispatch.ts` became a formatting god-object.

---

## Full inventory (12 sim chains)

| # | Chain | Direct pair? |
|---|--------|--------------|
| 1 | `diplomacy.ts` → `diplomaticDispatch.ts` | **Yes** |
| 2 | `country.ts` → `diplomacy.ts` → `diplomaticDispatch.ts` → `dispatch.ts` | |
| 3 | `diplomaticDispatch.ts` → `dispatch.ts` | **Yes** |
| 4 | `diplomacy.ts` → `diplomaticDispatch.ts` → `dispatch.ts` → `influenceAccelerators.ts` | |
| 5 | `diplomacy.ts` → … → `influenceAccelerators.ts` → `influence.ts` | |
| 6 | `country.ts` → … → `influenceAccelerators.ts` → `influenceActions.ts` | |
| 7 | `diplomacy.ts` → … → `influenceAccelerators.ts` → `influenceActions.ts` | |
| 8 | `diplomaticDispatch.ts` → … → `influenceAccelerators.ts` → `influenceActions.ts` | |
| 9 | `country.ts` → … → `movement.ts` → `arrivalCombat.ts` | |
| 10 | `diplomacy.ts` → … → `movement.ts` → `arrivalCombat.ts` | |
| 11 | `diplomaticDispatch.ts` → … → `arrivalCombat.ts` → `intelDispatch.ts` | |
| 12 | `dispatch.ts` → `influenceAccelerators.ts` → `movement.ts` → `arrivalCombat.ts` → `intelDispatch.ts` | |
| 13 | `diplomaticAi.ts` → `playerDiplomacy.ts` | **Yes** (counted separately in backlog) |

Shared (defer):

| # | Chain |
|---|--------|
| 14–15 | `shared/index` → `leaders` → `beatController` → `dilemmas` → `foreignRule` |

---

## Phase 1 breakage plan (6 cycles)

### P1 — `diplomaticAi` ↔ `playerDiplomacy` (#13)

| | |
|---|---|
| **Strategy** | Extract `diplomaticScoring.ts`: thresholds (`ALLIANCE_ACCEPT_THRESHOLD`, `scoreTreatyAcceptance`, posture modifiers), shared enemy helpers. Both modules import scoring only. |
| **Files** | New `packages/sim/src/diplomaticScoring.ts`; trim `diplomaticAi.ts`, `playerDiplomacy.ts` |
| **Est.** | ~45 min |

### P2 — `diplomacy` ↔ `diplomaticDispatch` (#1)

| | |
|---|---|
| **Strategy** | Split **event draft builders** (`allianceFormedEvent`, `treatyFormedEvent`, …) into `diplomaticEvents.ts` (no dispatch imports). `diplomaticDispatch.ts` keeps only thin wrappers if needed. `diplomacy.ts` imports events, not formatters. |
| **Files** | New `diplomaticEvents.ts`; `diplomacy.ts`, `diplomaticDispatch.ts` |
| **Est.** | ~1 h |

### P3 — `diplomaticDispatch` ↔ `dispatch` (#3)

| | |
|---|---|
| **Strategy** | Move diplomatic **line formatters** (`formatAllianceFormedLine`, treaty lines) to `diplomaticDispatchLines.ts`. `dispatch.ts` imports lines module; `diplomaticDispatch.ts` does not import `dispatch.ts`. Invert: event builders never call `dispatchLineForEvent`. |
| **Files** | `diplomaticDispatchLines.ts`, `dispatch.ts`, `diplomaticDispatch.ts` |
| **Est.** | ~1 h |

### P4 — `country` → `influenceActions` (#6)

| | |
|---|---|
| **Strategy** | Extract `territoryOwnership.ts`: `captureTerritoryOwnership`, `transferCityOwnership` (generalize `captureCityForCoup`). `country.ts` and `influenceActions.ts` import ownership primitives; `influenceActions` does not import `country.ts` for capture. |
| **Files** | New `territoryOwnership.ts`; `influenceActions.ts`, `country.ts` |
| **Est.** | ~1.5 h |

### P5 — `diplomacy` → `influenceActions` (#7)

| | |
|---|---|
| **Strategy** | Mostly resolved by P4 + P2. Remaining: `influenceActions` imports `areAllied` / treaty helpers from `diplomacy.ts` only (acyclic). Verify no `influenceActions` → `diplomaticDispatch` path after P4. |
| **Files** | `influenceActions.ts` import audit |
| **Est.** | ~30 min (verification + small import fixes) |

### P6 — `dispatch` → `influenceAccelerators` (#4 partial)

| | |
|---|---|
| **Strategy** | Extract `influenceOrderValidation.ts` + `formatInfluenceOrderRejectedMessage` to `influenceOrderMessages.ts`. `influenceAccelerators.ts` imports validation/messages; `dispatch.ts` imports messages only (not accelerators). Breaks dispatch ↔ accelerators edge. |
| **Files** | `influenceOrderValidation.ts`, `influenceOrderMessages.ts`; `dispatch.ts`, `influenceAccelerators.ts` |
| **Est.** | ~1.5 h |

**Phase 1 total estimate:** ~6 h focused refactor + ~10 regression tests.

---

## Sprint 11 defer (6 chains)

| Chains | Rationale |
|--------|-----------|
| #5 `influence.ts` in diplomacy/dispatch chain | Collapses once P6 lands; may need `influence.ts` to stop importing diplomacy for passive checks via injected helper |
| #8 `diplomaticDispatch` → `influenceActions` | Long chain; breaks when P2–P6 complete |
| #9–12 `movement` / `arrivalCombat` / `intelDispatch` | Requires combat layer to emit intel reports without importing `dispatch.ts` formatters — larger architectural pass |
| #2 full `country` → `dispatch` | Partially addressed by P4; full break needs defeat cascade event emission decoupled from dispatch formatting |
| Shared #14–15 dilemmas | `beatController` ↔ `dilemmas` in `shared` package — separate sprint or Phase 11 shared hygiene |

---

## Verification

After Phase 1:

```bash
cd packages/sim && npx madge --circular src/index.ts
```

Target: ≤6 remaining sim cycles (down from 12), zero direct pairs among P1–P6 targets.

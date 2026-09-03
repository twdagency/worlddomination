# Sprint 11 Phase 0 — Require-cycle audit

**Branch:** `sprint-11/architecture-cleanup` from `sprint-10-final` @ `5e27dff`  
**Tool:** `npx madge --circular src/index.ts` from `packages/sim`  
**Date:** 2026-09-03

## Headline

Do **not** execute Sprint 10's deferred "remaining 6 sim chains." Those chains collapsed in Sprint 10 Phase 1. Sprint 11 Phase 1 is a **re-measure + break what's left**.

## Current madge (80 files)

```
× Found 3 circular dependencies!

1) dispatch.ts > influenceOrderMessages.ts > movement.ts > tutorial.ts
2) ../../shared/src/index.ts > ../../shared/src/leaders.ts > index.ts > beatController.ts > dilemmas.ts
3) ../../shared/src/index.ts > ../../shared/src/leaders.ts > index.ts > beatController.ts > dilemmas.ts > dilemmas/foreignRule.ts
```

| Metric | Sprint 10 Phase 1 end | Sprint 11 start |
|--------|----------------------|-----------------|
| Sim cycles | **0** | **1** (new) |
| Shared-barrel cycles | 2 | **2** (unchanged shape) |
| Files processed | 68 | **80** |

## Cycle 1 — sim (new since Sprint 10 Phase 1)

| | |
|---|---|
| **Chain** | `dispatch.ts` → `influenceOrderMessages.ts` → `movement.ts` → `tutorial.ts` → `dispatch.ts` |
| **Edges** | `influenceOrderMessages` imports `formatOrderRejectedMessage` from `movement`; `movement` imports `capTutorialPlayerActionGameMs` from `tutorial`; `tutorial` imports `playerFactionId` from `dispatch` |
| **Why it appeared** | Tutorial 2s action cap (playtest) pulled `tutorial` into `movement`; `tutorial` still uses the dispatch hub for `playerFactionId` |
| **Strategy** | Extract `playerFactionId` (and any other identity helpers) from `dispatch.ts` to a leaf (`playerIdentity.ts` or existing country helpers). Extract `formatOrderRejectedMessage` from `movement.ts` to a message leaf so influence formatters never import movement/combat. `tutorial.ts` must not import `dispatch.ts`. |
| **Est.** | ~1.5 h + 2–3 regression tests |

## Cycles 2–3 — shared barrel (Sprint 10 defer)

| | |
|---|---|
| **Chain** | `shared/index` → `leaders.ts` → `sim/index` → `beatController.ts` → `dilemmas.ts` (`→ foreignRule.ts`) |
| **Root cause** | `shared` imports the **sim package barrel** (`import type { Leader } from 'sim'`, plus **runtime** `from 'sim'` in scenarios: `diplomacyDefaults`, `createInitialTutorialState`). Madge then walks `sim/index.ts` into tutorial/dilemma hubs. |
| **Strategy** | (1) Point shared type imports at a types-only path (or move `Leader`/`UnitType` types into `shared` / a leaf `sim/types` export). (2) Move `diplomacyDefaults` / tutorial bootstrap constants to a sim leaf that does not import dilemmas or the barrel. (3) Keep `FOREIGN_RULE_DILEMMA` as data in shared or a dilemma-data module with no beatController import. |
| **Est.** | ~3 h + 4–6 tests (scenario factories still construct valid worlds) |

## Optional hardening (same phase if cycles go to 0 early)

| Item | Source |
|------|--------|
| Deprecate `diplomaticDispatch.ts` re-export barrel → import `diplomaticEvents` directly | `docs/deferred-backlog.md` Sprint 11+ |
| Guard: `cycleHygiene` test or madge script fails CI if sim cycles > 0 | Prevents another silent reintroduction |

## Stale inventory (do not treat as Phase 1 work)

Sprint 10 cycle audit "Sprint 11 defer (6 chains)" (#5, #8, #9–12, #2, shared #14–15): sim items **resolved** in Sprint 10 Phase 1. Shared #14–15 **remain** as cycles 2–3 above.

## Verification

```bash
cd packages/sim && npx madge --circular src/index.ts
```

**Phase 1 target:** **0** cycles (sim + shared graph from `sim/src/index.ts`).

## Phase 1 results (complete)

| Metric | Before | After |
|--------|--------|-------|
| Cycles from `sim/src/index.ts` | **3** | **0** |
| Files processed | 80 | 70 |

### Extractions

| Cycle | Status | Modules |
|-------|--------|---------|
| 1 | **Resolved** | `playerIdentity.ts`, `orderRejectedMessage.ts` |
| 2–3 | **Resolved** | `shared/dilemmas` + `sim/types` exports; type imports no longer hit barrels |

`diplomaticDispatch.ts` re-export barrel left in place (optional hardening; not required for 0 cycles).

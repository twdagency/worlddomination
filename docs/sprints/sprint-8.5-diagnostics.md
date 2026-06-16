# Sprint 8.5 — Phase 0 Diagnostic Report

Recorded: 2026-06-15  
Branch: `sprint-8.5/hotfix` (from `sprint-8/country-city` @ `812d963`)  
Scope: Issues #14, #15, #16, #18, #21 — diagnostic only, no production fixes.

## Baseline

| Metric | Value |
|--------|-------|
| Sim tests | 396 passed (+11 diagnostic), 4 skipped placeholders |
| Mobile tests | 204 passed (+3 diagnostic) |
| **Total** | **600** (596 active + 4 skipped) |
| vs Sprint 8 exit | +14 tests |
| Mobile typecheck | Clean |
| Production code changed | **No** — tests + docs only |

## Branch setup

- `sprint-8/country-city` at `812d963` verified
- `sprint-8.5/hotfix` created from that commit
- Sprint 8 **not** merged to main (hotfix stacks on feature branch, same pattern as 7c on 7b)

---

## Issue #14 — Beat 4/5 sequencing (Foreign Rule skipped)

### Hypothesis result: **D + C (combined)** — not A, not B

| Hypothesis | Verdict | Evidence |
|------------|---------|----------|
| **A** — Dilemma never enqueues on Beat 4 | **Partial** — true only for non-conquest pinch paths | Conquest path enqueues correctly |
| **B** — Mobile selector doesn't surface dilemma | **Rejected** | `pendingDilemmas` empty on food/treaty paths; modal has nothing to show |
| **C** — Handoff fires too eagerly | **Confirmed** | Same tick as pinch completion on non-conquest paths |
| **D** — Only conquest path enqueues dilemma | **Confirmed** | Treaty + food-infra skip enqueue |

### Root cause (file:line)

```24:31:packages/sim/src/beatController.ts
  if (beat === 'pinch') {
    if (isPinchConquestEvent(event)) {
      return enqueuePendingDilemma(world, 'foreign-rule', PLAYER_TUTORIAL_FACTION_ID, event.at);
    }
    if (world.tutorial) {
      const skipped = markBeatComplete(world.tutorial, 'governance', event.at);
      return { ...world, tutorial: skipped };
    }
  }
```

When Beat 4 (`pinch`) completes via **treaty** or **home food-infra** (`tutorialBeats.ts` `isPinchResolved` lines 55–68), the side-effect **auto-completes Beat 5 (`governance`)** without enqueuing `foreign-rule`. `markBeatComplete` advances `currentBeat` to `handoff`, and `maybeEmitTutorialHandoff` fires `tutorialHandoffReady` in the same progression pass — player sees tutorial end immediately.

Conquest path (Burgundy/Calais capture) correctly enqueues dilemma and stops at `currentBeat === 'governance'`.

### Diagnostic tests

`packages/sim/tests/tutorial.beatSequence.diagnostic.test.ts` — all 5 green, reproducing cold-play path.

### Prior art

- Sprint 7b cold-play: "Treaty/infra pinch paths skip governance dilemma (deferred Sprint 9)"
- `docs/deferred-backlog.md` — dilemma triggers for treaty/infra paths
- Sprint 8 Option β changed semantics: France already defeated in Beat 2; **all pinch paths should reach Foreign Rule**

### Fix scope (Phase 1)

- Remove governance skip in `applyBeatSideEffects`; enqueue `foreign-rule` on **all** pinch completions
- Optional: path-specific dilemma copy later (Sprint 9); Phase 1 uses single Foreign Rule dilemma
- Update `tutorial.playthrough.test.ts` + add treaty/infra path playthrough cases
- Convert 2 skipped placeholders in `tutorial.beatSequence.test.ts`

**Complexity: M** (sim beat controller + tests; mobile modal should work once dilemma enqueues)

---

## Issue #15 — Self-assault

### Finding: **Both UI and sim gap**

| Layer | Behavior | Reference |
|-------|----------|-----------|
| **UI** | Destination picker includes other player-owned territories | `playerOrderDestinations` filters only `!== fromTerritoryId`, not hostile/friendly (`playerView.ts` ~210–217) |
| **Sim** | Accepts assault orders to friendly-owned territories; only blocks same-territory zero-distance moves | `movement.ts` `applyMoveOrders` line 107 |
| **Arrival** | Friendly arrival does not assault garrison; no battle | `arrivalCombat.ts` `!isEnemyTerritory` branch ~227–251 |

### Diagnostic tests

- `packages/sim/tests/selfAssault.diagnostic.test.ts`
- `apps/mobile/tests/orderDestinations.diagnostic.test.ts`

### Fix scope (Phase 2)

- **Sim:** Reject `assault` stance when destination `ownerId === unit.ownerId` (or downgrade to `hold` with dispatch note)
- **Mobile:** Filter assault-ineligible destinations in `playerOrderDestinations` or OrderScreen stance gating; hide/disable assault for friendly destinations
- Skipped placeholder: sim rejection + UI filter

**Complexity: S** — localized validation in movement + destination filter

---

## Issue #16 — Stale income after capture

### Finding: **Tick ordering gap confirmed**

`tick.ts` runs `accrueEconomy` **before** `resolveArrivals`:

1. `applyMoveOrders`
2. `applyBuildOrders`
3. **`accrueEconomy`** ← uses tick-**start** ownership
4. `resolveProductionCompletions`
5. **`resolveArrivals`** ← captures happen here
6. diplomacy / intel / `syncCountriesFromFactions` / `evaluateBeatProgression`

### Diagnostic proof

`packages/sim/tests/incomeTickOrder.diagnostic.test.ts` — player receives full tick-start income even when London is captured by Rome in the same tick's arrival phase.

### Fix scope (Phase 3)

Options (pick one in Phase 1 planning):

1. **Move `accrueEconomy` after `resolveArrivals`** (simplest; verify no regressions on production/manpower)
2. **Split income:** accrue only for territories still owned at income time
3. **Defer lost-territory income:** track captures in-tick and exclude from accrual

**Complexity: M** — tick reorder touches core loop; needs regression suite + cold-play income spot-check

---

## Issue #18 — Infrastructure cost calculation

### Finding: **Per-territory formula correct in sim and mobile**

| Location | Formula | Reads |
|----------|---------|-------|
| Sim | `production.ts` ~317 | `INFRA_UPGRADE_BASE_COST * territory.infraLevel` for `order.territoryId` |
| Mobile | `costPreview.ts` ~55 | Same, for route `territoryId` |

Diagnostic confirms Paris (infra 3) costs 15k vs London (infra 1) 5k independently.

### Cold-play discrepancy note

If device showed "wrong" cost, likely causes to verify in Phase 4:

- Player viewed Territory screen for city A but mental model expected city B's level
- Funding shortfall after prior upgrade (affordable flag) vs displayed required amount
- **Not** a global/faction-wide infra level bug in code

**Complexity: S** if display bug found on device; **none** if audit-only confirms code correct (add regression test tying TerritoryScreen `territoryId` to preview)

---

## Issue #21 — Forces screen → Move integration

### Finding: **Phase 7 infra present; Forces screen not wired**

| Component | Status |
|-----------|--------|
| `Order` route params | `presetForceId` read in `OrderScreen.tsx` |
| `deepLinks.ts` | Navigates to Order with `presetForceId` |
| `ForcesScreen.tsx` | **No** `useNavigation`, **no** `presetForceId`, rows not pressable for move |

### Wire-up estimate (Phase 4)

- Add `useNavigation` + press handler on stationed force rows → `navigate('Actions', { screen: 'Order', params: { presetForceId: unit.id } })`
- Optional: in-transit rows disabled or deep-link to destination view only
- ~30–50 lines + 2 tests

**Complexity: S**

---

## Cold-play backlog items (from device session)

### Treaty UX feedback (user-reported)

Treaty offer/decline flow lacks sufficient feedback when pinch resolves via diplomacy path — player may not realize Beat 4 completed or what changed. Log for Sprint 9 content/UX polish alongside structured dispatch formatters.

---

## Skipped invariant placeholders

`packages/sim/tests/tutorial.beatSequence.test.ts` — 4 `it.skip` tests documenting Phase 1–3 targets.

---

## Recommended phase ordering

| Phase | Issues | Rationale |
|-------|--------|-----------|
| **1** | #14 Beat 4/5 | P0 tutorial blocker; cold-play root cause |
| **2** | #15 Self-assault | P0 gameplay integrity; small surface |
| **3** | #16 Income ordering | P0 economic fairness; tick touch |
| **4** | #18 Infra cost + #21 Forces→Move | P1 polish; quick wins |
| **5** | Device cold-play | Sprint 8.5 + Sprint 8 combined tag `sprint-8-final` |

---

## Unexpected findings

1. **Issue #14 is not a modal bug** — dilemma modal and `dilemmaModalController` are fine; sim never enqueues on 2/3 pinch paths.
2. **Handoff completes same tick** as governance skip — explains "immediately went to tutorial end" wording precisely.
3. **Income bug is structural tick order**, not a stale intel/display issue.
4. **Test count 600** already exceeds Phase 0 target of 605 when skipped tests flip green in Phase 1–3.

---

## Phase 0 acceptance

- [x] Branch `sprint-8.5/hotfix` from `812d963`
- [x] 600 tests green (596 active + 4 skipped), typecheck clean
- [x] Diagnostic tests for all five issues
- [x] This document
- [x] No production code changes

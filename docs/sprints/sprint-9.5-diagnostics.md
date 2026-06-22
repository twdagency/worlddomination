# Sprint 9.5 — Phase 0 Diagnostic Report

Recorded: 2026-06-15  
Branch: `sprint-9.5/treaty-income-polish` (from `sprint-9/influence` @ `90fa314`)  
Scope: Issues #25, #26a, #26b — diagnostic only, no production fixes.

## Baseline

| Metric | Value |
|--------|-------|
| Sim tests | 545 passed, 2 todo (influence contracts) |
| Mobile tests | 267 passed |
| **Total** | **812** |
| Mobile typecheck | Clean (verified at Sprint 9 exit) |
| Production code changed | **No** — tests + docs only |

## Branch setup

- `sprint-9/influence` at `90fa314` verified
- `sprint-9.5/treaty-income-polish` created from that commit

---

## Stash inventory — income display WIP

| Stash | Branch | Label |
|-------|--------|-------|
| `stash@{0}` | `sprint-8.5b/badge-fix` | `income display WIP - not for 8.5b` |
| `stash@{1}` | `sprint-7b/tutorial` | `sprint-7b device hotfix WIP` (unrelated) |

**Verdict: partially usable — apply with review, do not drop-in blindly.**

`stash@{0}` touches 13 files and directly addresses **#26a** and **part of #26b**:

| Area | Stash change | Issue |
|------|--------------|-------|
| `packages/sim/src/dispatch.ts` | Adds `formatIncomeDispatchLine`, `hasDisplayableIncome`; replaces raw `funding ${event.funding}` | **#26a** |
| `packages/sim/src/compaction.ts` | Uses shared formatter for compact income line | **#26a** |
| `apps/mobile/src/game/actions.ts` | Removes duplicate `formatIncomeLine`; delegates to sim | **#26a** DRY |
| `apps/mobile/src/game/playerView.ts` | Filters digest with `hasDisplayableIncome` | **#26b** display |
| `apps/mobile/.../dashboard.dispatchesDigest.test.ts` | Sub-dollar income omitted from digest | **#26b** test |
| Snapshots | Updated income line formatting | regression |

**Gaps in stash (still needed for full #26b):**

- Does **not** change `clock.ts` emission — events still created for any `funding > 0` per `advanceTo`
- Does **not** wire `playerView.ts` digest lines through `formatIncomeDispatchLine` (still uses `dispatchLineForEvent` for label text when income *is* shown)
- Stale relative to Sprint 9 (`actions.ts` influence-order paths, dispatch formatters)

**Recommendation:** Cherry-pick concepts (`formatIncomeDispatchLine`, `hasDisplayableIncome`) into Phase 2; re-implement on current HEAD rather than `git stash apply` wholesale.

---

## Issue #25 — Treaty UX (accidental submit on tap)

### Diagnosis: **immediate submit — no selection, no confirm**

| Question | Finding |
|----------|---------|
| Component rendering offer rows | `CostBlock` inside `Pressable` styled as `territoryRow` |
| Row type | Full-row `Pressable` — entire card is tappable |
| Tap handler | `onPress` calls `proposeTreaty` immediately |
| Separate Send button | **None** |
| Selection state | **None** — no highlight, checkmark, or staged territory |
| Flow | Tap territory row → `setTreatyTarget(null)` + `void proposeTreaty(...)` in same handler |

### Code evidence

Picker opens when `treatyTarget === item.id` after "Propose treaty" toggles local state:

```335:342:apps/mobile/src/screens/DiplomacyScreen.tsx
                  {!areAllied(world, playerId, item.id) && (
                    <Pressable
                      style={styles.actionButton}
                      onPress={() => setTreatyTarget(treatyTarget === item.id ? null : item.id)}
                    >
                      <Text style={styles.buttonText}>Propose treaty</Text>
                    </Pressable>
                  )}
```

Each territory row submits on first tap (no confirm step):

```349:363:apps/mobile/src/screens/DiplomacyScreen.tsx
                    {treatyTerritories.map((territory) => (
                      <Pressable
                        key={territory.id}
                        style={styles.territoryRow}
                        onPress={() => {
                          setTreatyTarget(null);
                          void proposeTreaty(item.id, territory.id);
                        }}
                      >
                        <CostBlock
                          preview={evaluateCostLines([treatyOfferLine(territory.name)])}
                          title="Treaty offer"
                        />
                      </Pressable>
                    ))}
```

`CostBlock` title `"Treaty offer"` + `treatyOfferLine` label `Access offered: {name}` is the cold-play "TREATY OFFER" surface. Rows are not buttons visually — they read as informational cost preview, but the wrapping `Pressable` submits.

`proposeTreaty` → `playerProposeTreaty` in sim (`playerDiplomacy.ts`) — no UI gate.

### Recommended fix (Phase 1)

1. Tap territory row → set `selectedTreatyTerritoryId` (visible highlight/checkmark on row)
2. Show explicit **Send treaty offer** button (disabled until selection)
3. Submit only on Send; cancel/back clears selection
4. Mirror alliance pattern discipline (explicit action buttons, not whole-card submit)

**Complexity: S** (~40–60 lines UI + 2–3 mobile tests)

---

## Issue #26a — Income raw float display

### Diagnosis: **formatter fault — dual code paths, sim path is raw**

| Path | Formatter | Example output |
|------|-----------|----------------|
| `dispatchLineForEvent` (sim) | Raw template | `INCOME — funding 1.073611111111111` |
| `formatDispatchLine` → `formatIncomeLine` (mobile `actions.ts`) | `Math.floor` + locale | `INCOME — +$1 funding, ...` |
| `playerView` dashboard digest | **`dispatchLineForEvent`** | Raw floats in digest |
| `actionFeedback` toast | **`dispatchLineForEvent`** for some paths | Raw floats possible |

### Code evidence — sim (broken path)

```410:411:packages/sim/src/dispatch.ts
    case 'income':
      return `INCOME — funding ${event.funding}`;
```

### Code evidence — mobile (correct but duplicated)

```174:187:apps/mobile/src/game/actions.ts
function formatIncomeLine(
  event: Extract<SimEvent, { kind: 'income' }>,
  world: WorldState,
): string {
  const parts = [`+$${Math.floor(event.funding).toLocaleString()} funding`];
  // ... resource floors ...
  return `INCOME — ${parts.join(', ')} accrued while away`;
}
```

### Calculation vs display

`accrueEconomy` correctly accumulates fractional funding (`economy.ts` — `scaleByElapsed` over `elapsedMs`). Values like `1.07` or `0.000493...` are **valid accrual**, not calculation bugs.

**Complexity: S** — centralize `formatIncomeDispatchLine` in sim (stash ready), route all surfaces through it.

---

## Issue #26b — Sub-tick income emission cadence

### Diagnosis: **one income event per `advanceTo` call, any positive funding; mobile polls frequently**

#### Emission site

Income events are **not** emitted inside `tick()`. `tick()` returns `accrued` silently. Emission happens only in `advanceTo`:

```91:104:packages/sim/src/clock.ts
  if (
    incomeAccrued.funding > 0 ||
    hasTerritoryResourceAccrual(incomeAccrued.resourcesByTerritory)
  ) {
    const income = emit(current, {
      kind: 'income',
      at: current.nowMs,
      funding: incomeAccrued.funding,
      resourcesByTerritory: incomeAccrued.resourcesByTerritory,
      importance: 'low',
    });
```

No minimum threshold — `funding: 0.0003` still emits.

#### Trigger frequency (mobile)

```383:399:apps/mobile/src/game/GameContext.tsx
    const onTick = () => {
      const now = Date.now();
      // ...
      const next = nextEventMs(current);
      if (next === null || next > now) return;

      const { world: advanced, events } = catchUp(current, now);
      // ...
    };

    onTick();
    const id = setInterval(onTick, hasPendingEvents ? 1000 : 60_000);
```

When `hasPendingEvents` and `next <= now`, `catchUp` → `advanceTo(world, Date.now())` runs every **1s**. Each call that accrues wall-clock elapsed game time emits a separate income event. Short windows → tiny funding deltas → spam in dispatch feed.

`advanceTo` **does** merge income across internal tick steps within one call (`mergeAccruedIncome` in the while loop). The spam is **between** `advanceTo` invocations, not within one.

#### Why 1.07 and 0.0003 in quick succession

Not per-millisecond emission. Two (or more) `advanceTo` calls in quick succession, each with small positive `elapsedMs` accrual. Display shows raw floats (#26a), making micro-amounts visible.

#### Recommended fix approach

| Option | Description | Verdict |
|--------|-------------|---------|
| **(a) Threshold at emit** | `clock.ts`: skip emit when `Math.floor(funding) === 0` and no floor-able resources | **Recommended** — fixes feed spam at source |
| **(b) Batch per game-day** | Heavier; changes event semantics | Defer |
| **(c) Display-only filter** | `hasDisplayableIncome` (stash) | **Partial** — good digest hygiene, events still stored |

Combine **(a) + centralized formatter + digest filter** for defense in depth.

**Complexity: M** — sim emission guard + formatter unification + 4–6 tests (clock, digest, dispatch snapshots)

---

## Cross-cutting — Sprint 8.5 Phase 3 (capture-before-income)

**Not the root cause of #26b cadence.**

Sprint 8.5 Phase 3 reordered `tick()` so `accrueEconomy` runs **after** `resolveArrivals` (capture-before-income). That fixed **who earns** income on capture ticks (#16), documented in `incomeTickOrder.diagnostic.test.ts`.

It did **not** add income event emission to `tick()` or change `advanceTo` emission policy. Emission model predates Sprint 8.5; Phase 3 only moved accrual timing within the tick pipeline.

The cadence issue is the combination of:

1. `advanceTo` emitting on any positive accrual (pre-existing)
2. Mobile 1s polling when pending events (pre-existing)
3. Raw float display making micro-events visible (#26a, exacerbator)

---

## Placeholder contracts (Phase 1+)

| File | Contracts |
|------|-----------|
| `apps/mobile/tests/treatyUx.contract.test.tsx` | Confirm before submit; visible selection |
| `packages/sim/tests/sprint-9.5.contract.test.ts` | Rounded display; emission cadence |

---

## Fix complexity & phase order

| Phase | Scope | Complexity | Est. new tests |
|-------|--------|------------|----------------|
| **1** | Treaty UX (#25) | **S** | ~3–4 |
| **2** | Income display (#26a) + emission (#26b) | **M** | ~8–12 |
| **3** | Device verification + merge/tag | Manual | — |

**Recommended order:** Phase 1 → Phase 2 → Phase 3 (treaty is isolated mobile; income touches sim + mobile surfaces).

**Target:** ≥830 tests (812 + ~18).

---

## Phase 0 acceptance

- [x] Branch `sprint-9.5/treaty-income-polish` from `90fa314`
- [x] Baseline 812 tests green
- [x] Stash status reported
- [x] Issue #25 diagnostic with code evidence
- [x] Issue #26a diagnostic with formatter identified
- [x] Issue #26b diagnostic with emission pattern + fix approach
- [x] Sprint 8.5 Phase 3 cross-check (not root cause)
- [x] 4 placeholder tests added
- [x] No production code changed

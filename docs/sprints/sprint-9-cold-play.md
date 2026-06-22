# Sprint 9 — device cold-play findings

**Date:** _operator fills on completion_  
**Branch:** `sprint-9/influence` @ `90fa314`  
**Scope:** Influence layer end-to-end + Sprint 7c/8/8.5 regression sweep

## Build setup

1. Pull `sprint-9/influence` at `90fa314`
2. Build for device; production-flavored if practical (`__DEV__ === false`)
3. **Fresh install** — clear app data / uninstall so tutorial-first default fires
4. Optional: clear `@worlddomination/*` AsyncStorage keys if hot-reloading over old state

```bash
git checkout sprint-9/influence
git pull
cd apps/mobile && npx expo start
# or: eas build / dev client per team norm
```

## Execution model

~2h hands-on device session. **Operator work, not Cursor.** No `sprint-9-final`
tag, no merge to main, no Sprint 10 kickoff until this doc is filled and P0-clear.

Combine manual tap-through with automated proxies below. Diagnostic-first for any
sim/code misalignment (see `deferred-backlog.md` — Process diagnostic-first).

## Automated validation (pre-device — passed at Phase 9)

| Area | Evidence |
|------|----------|
| Influence passive + decay + accelerators | `influence.*.test.ts` (sim) |
| Threshold actions (pressure, tribute, coup, defection) | sim phase 4–7 suites |
| Mobile selectors + deep links | `influenceSelector`, `influenceDeepLinks`, screen tests |
| Tooltip system + persistence | `tooltipSystem`, `tooltipDismissal`, `influenceCardOnboarding` |
| Beat 6 influence copy | `tutorialBeat6Influence.test.ts` |
| Tutorial playthrough | `tutorial.playthrough.test.ts` |
| Tutorial isolation | no influence imports in tutorial game modules |
| Intel forward-compat canary | `intel.forwardcompat.test.ts` unchanged |
| **Total** | **812 tests** (545 sim + 267 mobile), mobile typecheck clean |

## Checklist — manual device (operator)

### Tutorial + graduation (Sprint 7c/8/8.5 regression)

| # | Check | Auto proxy | Manual status |
|---|-------|------------|---------------|
| 1 | Fresh install → tutorial loads | first-open → `tutorial` scenario | **Pending** |
| 2 | Beats 1–5 unchanged (movement → governance dilemma) | `tutorial.playthrough.test.ts` | **Pending** |
| 3 | Crisis dilemma modal blocks nav; tooltip auto-dismisses if one was open | `RootTabs` `dismissActiveTooltip` on crisis | **Pending** |
| 4 | Graduate → sandbox, 1× time, banner behavior | `graduateTutorial` + banner tests | **Pending** |
| 5 | Beat 6 handoff banner — expand Why? — influence hint readable | `TUTORIAL_BEAT_COPY.handoff.hint` | **Pending** |

### Influence — post-graduation / sandbox

| # | Check | Auto proxy | Manual status |
|---|-------|------------|---------------|
| 6 | Dashboard Influence card visible; empty vs active copy | `dashboardInfluenceCard`, `InfluenceCard` | **Pending** |
| 7 | First view with influence > 0 → tooltip after ~500ms settle | `influenceCardOnboarding.test.tsx` | **Pending** |
| 8 | Dismiss influence tooltip → does not re-show (persistent) | `tooltipDismissal` + onboarding tests | **Pending** |
| 9 | World screen — influence indicators / deep link to territory | `worldScreenInfluence` | **Pending** |
| 10 | Diplomacy screen — country influence rollup | `diplomacyScreen` influence tests | **Pending** |
| 11 | Order → Influence panel — action cards, (i) tooltips, execute flow | `orderScreenInfluence`, `actionTooltips` | **Pending** |
| 12 | Build mode on Territory (not duplicated on Order segmented control) | Phase 8 IA decision | **Pending** |
| 13 | Foreign city Territory — influence detail (Sources, Net rate, Threshold) + info tooltips | Phase 8 #17 bundled; `territoryScreenInfluence` | **Pending** |
| 14 | Passive accumulation legible over several game-days @ 1× or fast-forward | sim passive tests | **Pending** |
| 15 | At least one threshold action attempted (pressure / tribute / coup / defection per save state) | sim validators → selectors | **Pending** |

### Hygiene regression

| # | Check | Auto proxy | Manual status |
|---|-------|------------|---------------|
| 16 | Dispatches read-state / digest unchanged | Sprint 8.5 tests | **Pending** |
| 17 | Defeated country badges / diplomacy filters | Sprint 8 tests | **Pending** |
| 18 | No P0 crashes, scroll jank, or header/banner overlap with tooltips | — | **Pending** |

## Findings

### P0 blockers

_None — operator fills._

### P1 (Sprint 10 candidates)

_None — operator fills. Balance tuning, AI agency, remaining Set B actions already deferred._

### P2 (polish)

_None — operator fills._

## Exit recommendation

- [ ] All checklist rows confirmed or waived with rationale
- [ ] No open P0
- [ ] Findings reviewed → tag `sprint-9-final` → merge per team norm

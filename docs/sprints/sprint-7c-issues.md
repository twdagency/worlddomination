# Sprint 7c — Issue inventory

**Branch:** `sprint-7c/hotfix` from `sprint-7b-final` @ `4dde847`  
**Updated:** Phase 0 diagnostic pass

## Summary

| # | Issue | Severity | Diagnosis (Phase 0) | Fix phase |
|---|-------|----------|----------------------|-----------|
| 1 | Dispatch feed duplicate React keys | P2 | Not exercised in Phase 0 | 3 |
| 2 | Alliance contract violation (assault vs ally) | **P0** | **A + C confirmed; B structural** | 1 |
| 3a | Tab bar / safe-area under system navigation | **P0** | Device-reported; code uses fixed padding in `RootTabs.tsx` | 3 |
| 3b | Persistent header date string too long | P2 | Not exercised in Phase 0 | 3 |
| 3c | Dev-only UI not gated behind `__DEV__` | P2 | Not exercised in Phase 0 | 3 |
| 4a | Diplomacy screen lists non-player-relevant factions | P1 | Not exercised in Phase 0 | 1 |
| 4b | Sprint 5 duplicate `leader-elizabeth` | P1 | **Confirmed** | 1 |
| 5a | Tutorial banner dismiss with no recovery affordance | P1 | Not exercised in Phase 0 | 2 |
| 6a | Tutorial banner should default collapsed-thin | P2 | Not exercised in Phase 0 | 2 |
| 6b | Tutorial “no troops” / $0 funding on device | **P0** | **Possibility (3) UI selector** | 2 |
| 6c | Order screen empty-state copy | P2 | Not exercised in Phase 0 | 2 |
| 5b | Scroll affordance on long task screens | P2 | Not exercised in Phase 0 | 3 |
| 5c | Handoff banner discoverability after dismiss | P1 | Related to 5a | 2 |

---

## Issue #1 — Dispatch feed React keys

- **Severity:** P2  
- **Status:** Open — no Phase 0 diagnostic  
- **Planned fix:** Add `eventId` (or stable composite key) on `SimEvent`; update feed renderer  
- **Tests planned:** Dispatch list key uniqueness regression (~2)  
- **Open questions:** Backfill IDs on load vs generate at emit time?

## Issue #2 — Alliance contract violation

- **Severity:** P0  
- **Status:** Diagnosed — **compounding A + C; B structural gap**  
- **Evidence:**
  - **(A)** `diplomacy.allianceContract.diagnostic.test.ts` — Genghis assault in flight, alliance at `t=travel/2`, combat still fires on arrival  
  - **(B)** `ai.ts` `scoreAttack` (lines ~391–439) — no `areAllied` check before scoring assault moves  
  - **(C)** `arrivalCombat.ts` `resolveHostileArrival` (lines ~62–214) — no `areAllied` import or guard; allied assault at London still emits `battle`  
- **Planned fix (Phase 1):** Combat guard + in-flight order recall/cancel + AI `scoreAttack` ally filter  
- **Tests planned:** ~6–8 invariant tests replacing diagnostics  
- **Open questions:** Should in-flight assaults convert to `hold` or cancel entirely on alliance?

## Issue #3a — Safe area / tab bar

- **Severity:** P0 (device UX)  
- **Status:** Open — `RootTabs.tsx` uses fixed `height`/`paddingBottom` (iOS 84 / Android 64) without `useSafeAreaInsets()`  
- **Planned fix:** Phase 3 safe-area audit (tab bar + task screens)  
- **Tests planned:** Navigation style unit test or snapshot; device verify  
- **Open questions:** `react-navigation` `safeAreaInsets` option vs manual insets?

## Issue #3b — Header date abbreviation

- **Severity:** P2  
- **Status:** Open  
- **Planned fix:** Abbreviate `formatDateTime` output in `PersistentHeader`  
- **Tests planned:** `persistentHeader.test.ts` extension (~1)

## Issue #3c — DEV UI gate

- **Severity:** P2  
- **Status:** Open  
- **Planned fix:** Wrap dev cards / copy in `__DEV__`  
- **Tests planned:** Static import scan or component test (~1)

## Issue #4a — Diplomacy player filter

- **Severity:** P1  
- **Status:** Open — `DiplomacyScreen` uses `playerFactionId(world)` for actions but may list all factions  
- **Planned fix:** Filter roster to player-visible diplomatic targets  
- **Tests planned:** Selector test (~2)

## Issue #4b — Two Elizabeth in Sprint 5

- **Severity:** P1  
- **Status:** **Confirmed regression**  
- **Evidence:** `packages/shared/src/scenario-sprint5.ts`  
  - `faction-player` → `leaderId: 'leader-elizabeth'` (line 60)  
  - `faction-britain` → `leaderId: 'leader-elizabeth'` (line 84)  
- **Planned fix:** Rename AI Britain to Suleiman (`leader-suleiman` or existing leader id)  
- **Tests planned:** Scenario invariant — no duplicate `leaderId` per scenario (~2)

## Issue #5a — Banner dismiss without recovery

- **Severity:** P1  
- **Status:** Open  
- **Planned fix:** Header “Tutorial” restore control when `isBannerDismissed`  
- **Tests planned:** Selector + banner test (~2)

## Issue #6a — Banner collapsed-thin default

- **Severity:** P2  
- **Status:** Open  
- **Planned fix:** Thin strip default; auto-expand on beat advance  
- **Tests planned:** Banner state tests (~2)

## Issue #6b — Tutorial starting state / no troops

- **Severity:** P0  
- **Status:** Diagnosed — **possibility (3) UI selector broken**  
- **Evidence:**
  - **Sim OK:** `scenario.tutorial.invariants.test.ts` — funding `8000`, `unit-britain-infantry` stationed London, Paris march ETA > 0 (matches Phase 5 playthrough fixture)  
  - **Not (1):** Scenario is correctly configured  
  - **Not (2):** At `createTutorialWorld` time no drain has occurred  
  - **(3):** Mobile `playerView.ts` hardcodes `PLAYER_FACTION_ID = 'faction-player'` while tutorial uses `faction-britain-tutorial` — `playerMovableUnits` returns `[]`, header funding reads wrong faction (device report: $0, no forces)  
- **Planned fix:** Phase 2 — `resolvePlayerFactionId(world)` across mobile player view (stash WIP on `sprint-7b/tutorial`)  
- **Tests planned:** `playerView.tutorial.test.ts` (~3) + sim invariant promotion  
- **Open questions:** None — scope is mobile wiring, not scenario tuning

## Issue #6c — Order empty-state copy

- **Severity:** P2  
- **Status:** Open — copy does not mention tutorial faction mismatch  
- **Planned fix:** Context-aware empty state after #6b fix  
- **Tests planned:** Order screen test (~1)

## Issue #5b / #5c — Scroll + handoff discoverability

- **Severity:** P2 / P1  
- **Status:** Open  
- **Planned fix:** Phase 3 scroll padding; Phase 2 handoff tied to #5a  
- **Tests planned:** ~1–2

---

## Phase 0 fix-scope estimates (post-diagnostic)

### Phase 1 — Diplomacy (~10–12 tests)

- **#2:** Three-file change — `arrivalCombat.ts` ally guard, `movement.ts` or order recall for in-flight assaults, `ai.ts` `scoreAttack` ally filter  
- **#4a:** DiplomacyScreen filter  
- **#4b:** Sprint 5 leader rename + cross-scenario leader uniqueness test  

### Phase 2 — Tutorial (~8–10 tests)

- **#6b:** Mobile `resolvePlayerFactionId` (primary); sim invariant already passes  
- **#5a, #6a, #6c:** Banner UX + order copy  
- No scenario funding/unit changes required  

### Phase 3 — UI hygiene (~4–6 tests)

- **#1, #3a–#3c, #5b:** Keys, safe area, header, DEV gate, scroll  

### Phase 4

- Mandatory real-device cold-play; tag `sprint-7c-final` only after P0-clear playthrough  

---

## Unexpected findings

- Device P0 for #6b is **mobile-only**; sim scenario and playthrough tests were already green on `sprint-7b-final`.  
- WIP fix exists in git stash (`sprint-7b device hotfix WIP`) — Phase 2 should apply that pattern, not re-tune scenario.  
- Alliance bug is **compounding** (in-flight + arrival + AI scoring), not a single guard omission.

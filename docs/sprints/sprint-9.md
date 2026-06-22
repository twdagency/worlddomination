# Sprint 9 — Influence Layer Foundations

**Branch:** `sprint-9/influence` from `sprint-8-final` @ `dd6c48d`

**Baseline:** 646 tests (419 sim + 227 mobile) — verified Phase 0

**Target end of sprint:** ~773+ (~125 new tests)

**Sprint exit:** Real-device cold-play + `sprint-9-final` tag

## Design decisions (locked)

| # | Decision |
|---|----------|
| Q1 | Theme = Influence layer (canon spine continuation) |
| Q2 | Model Z — passive baseline + active accelerators, weighted toward active |
| Q3 | Set B — eleven actions across four tiers, multi-sprint |
| Q3.5 | Sprint 9 ships four canonical actions; Sprint 10 adds remaining seven + AI agency |
| Q4 | Pressure 30+, Tribute 50+, Coup 70+, Defection 100 — all Q4a–f sub-decisions locked |
| Q5 | Passive baseline + three accelerators (Diplomatic Mission, Cultural Campaign, Subversion); decay 1/day in inactive cities; honest visibility with fog for other-player magnitudes |
| Q6 | Light-touch tutorial — Beat 6 graduation copy, Dashboard surface, tooltip system |

## Theme

Add the influence layer as a strategic depth axis on top of Sprint 8's country/city foundation. After Sprint 9, influence accumulates passively from world state and actively from player accelerators; four threshold actions allow players to translate influence into strategic effect. Tutorial introduces the concept light-touch at graduation.

## Phase plan

| Phase | Theme | Est. new tests |
|-------|--------|----------------|
| 0 | Design pass + audit + branch setup | minimal (placeholders) |
| 1 | Influence state schema + passive accumulation | ~20 |
| 2 | Active accelerators (Diplomatic Mission, Cultural Campaign, Subversion) | ~15 |
| 3 | Influence decay + maintenance mechanics | ~8 |
| 4 | Threshold action 1: Diplomatic Pressure (30+) | ~12 |
| 5 | Threshold action 2: Tribute Extraction (50+) + Resentment | ~15 |
| 6 | Threshold action 3: Coup Attempt (70+) | ~14 |
| 7 | Threshold action 4: Defection (100) | ~10 |
| 8 | Mobile UI — Influence display + action surfaces | ~14 |
| 9 | Tooltip system + Beat 6 copy + Dashboard influence card | ~12 |
| 10 | Real-device cold-play + sprint-9-final tag | manual |

## Phase 9 complete

**Commit:** `90fa314` — tooltip system, Beat 6 influence hint, Dashboard first-tap
onboarding, Order/Territory info tooltips. **812 tests** (545 sim + 267 mobile).

## Phase 10 — cold-play (operator gate)

See `docs/sprints/sprint-9-cold-play.md`. No merge/tag until device session
complete and findings reported.

## Phase scope rules

- Stop-and-report after each phase
- Diagnostic-first for any cold-play findings
- No scope creep mid-sprint; backlog accumulating items
- Forward-compat canary (`intel.forwardcompat.test.ts`) unchanged throughout
- Tutorial isolation: `tutorial.ts` does not import from influence modules

## Phase 0 artifacts

- `docs/sprints/sprint-9-diplomatic-audit.md` — diplomatic state, city storage, AI split
- `docs/sprints/sprint-9-ui-audit.md` — mobile surfaces + tutorial touchpoints
- `docs/sprints/sprint-9-risks.md` — risk register + adjusted estimates
- `packages/sim/tests/influence.contract.test.ts` — 5 `it.todo` contracts
- `apps/mobile/tests/influenceTooltip.contract.test.tsx` — 1 `it.todo` contract

## Phase 0 acceptance criteria

- [x] Branch `sprint-9/influence` created from `sprint-8-final`
- [x] Baseline 646 tests green, mobile typecheck clean
- [x] Diplomatic audit complete
- [x] City-state audit + storage proposal
- [x] AI behavior audit + Sprint 9/10 split
- [x] Mobile UI surface audit with proposed layouts
- [x] Tutorial integration touchpoints inventoried
- [x] Risk register created
- [x] 6 placeholder tests added
- [x] No production code changed — audit docs and placeholders only

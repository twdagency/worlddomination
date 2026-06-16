# Sprint 7b — device cold-play findings

**Date:** 2026-06-16  
**Branch:** `sprint-7b/tutorial`  
**Scope:** Phase 6 graduation flow, dilemma UI, first-time tutorial default

## Execution model

Full ~2h hands-on device session requires a physical device or emulator with Expo
Go / dev client. This close-out combines **automated regression coverage** (373 tests,
playthrough + post-graduation sim paths, mobile selector/modal tests) with **checklist
mapping** for manual confirmation on hardware.

## Automated validation (passed)

| Area | Evidence |
|------|----------|
| Tutorial playthrough (conquest path) | `tutorial.playthrough.test.ts` |
| Post-graduation sandbox continuity | `tutorial.postGraduation.test.ts` (5 tests) |
| Graduation event + time multiplier | `graduateTutorial` + `tutorialGraduated` dispatch |
| Dilemma selector (player-only) | `dilemmaSelector.test.ts` (4 tests) |
| Dilemma modal Choose/Close | `dilemmaModal.test.tsx` (3 tests) |
| Handoff graduate button | `tutorialBanner.test.tsx` (+2 tests) |
| Handoff banner selector | `tutorialSelector.test.ts` (handoff-ready cases) |
| Dashboard selectors / Sprint 7a stack | `sprint7a.coldPlay.test.ts` (unchanged budgets) |
| Persistence migrations | `migrations.test.ts`, `tutorial.state.test.ts` |
| Intel forward-compat canary | `intel.forwardcompat.test.ts` unchanged |

## Checklist — manual device (operator)

| # | Check | Auto proxy | Manual status |
|---|-------|------------|---------------|
| 1 | Fresh install → tutorial loads | First-open logic: no saved world → `tutorial` scenario | **Pending device** |
| 2 | Movement banner readable; dismiss + Why? | `TutorialBanner` tests | **Pending device** |
| 3 | London → Paris march ~12 real-min @ 30× | `previewMoveEtaMs` + playthrough | **Pending device** |
| 4 | Combat + Beat 2 banner | playthrough test | **Pending device** |
| 5 | Paris infra upgrade + cost transparency | playthrough + `costPreview` tests | **Pending device** |
| 6 | Pinch banner three-path hint | beat copy + selector | **Pending device** |
| 7 | Conquest pinch → Foreign Rule on dashboard | playthrough enqueues dilemma; dashboard card wired | **Pending device** |
| 8 | Decision card → modal → three options | `DilemmaModal` tests | **Pending device** |
| 9 | Choose option → toast → handoff banner | GameContext `resolvePendingDilemma` + beat progression | **Pending device** |
| 10 | Graduate button → banner gone, 1× time | `graduateTutorial` + banner tests | **Pending device** |
| 11 | Post-graduation sandbox diplomacy | `tutorial.postGraduation.test.ts` | **Pending device** |
| 12 | Mid-tutorial save/load (Q3) | `ensureWorldMigrations` + storage round-trip via GameContext init | **Pending device** |
| 13 | No P0 crashes / visual regressions vs 7a | — | **Pending device** |

## Q3 — mid-tutorial save/load

Persistence path: `saveWorld` / `loadWorld` with `ensureWorldMigrations` on load.
GameContext restores stored world when `scenarioId` matches. Tutorial fields
(`tutorial`, `timeMultiplier`, `pendingDilemmas`) are part of `WorldState` JSON.
**Automated:** migration + state tests pass. **Device:** confirm banner beat resumes
after force-quit mid-march.

## Findings

### P0 blockers

None identified in automated suite. Device session not executed in this environment.

### P1 (backlog)

- **Manual cold-play confirmation** — run checklist rows 1–13 on device before App Store
  style release; automated proxies do not replace tap-through UX validation.
- **Handoff banner dismiss semantics** — dismiss hides graduate CTA until restore; verify
  players discover "Continue to Sandbox" without confusion (copy tuning candidate).

### P2 (polish)

- Dilemma modal has no consequence preview (deferred Sprint 9 — see backlog).
- Treaty/infra pinch paths skip governance dilemma (deferred Sprint 9).

## Decisions locked in Phase 6

- **Q1:** (a) Dashboard pending-decision card + `DilemmaModal` — implemented.
- **Q2:** (a) No tutorial restart UI in Sprint 7b.

## Exit recommendation

Automated gate is green (373 tests, typecheck clean). Tag `sprint-7b-final` is
appropriate for sim/mobile integration; schedule a focused device pass to close
manual checklist items before merging to `main` if hardware validation is a hard
release gate for the team.

Locked: Sprint 7c hotfix sprint approved, scoped to the three quality gaps, everything folded into one clean history, real-device cold-play committed for sprint exit.

Sprint 7c — Hotfix Sprint Plan
Branch: sprint-7c/hotfix from sprint-7b-final @ 4dde847

Baseline: 373 green tests (293 sim + 80 mobile), mobile typecheck clean. Sprint 7c floor: 373. Target: ≥395 (≈22 new tests across phases).

Theme: Make the tutorial demonstrably play through end-to-end on a real device, and enforce the diplomacy contract already designed.

Phase structure: 5 phases (0 diagnostic, 1 diplomacy, 2 tutorial, 3 UI hygiene, 4 cold-play + tag). Stop-and-report after each phase. Real-device cold-play is non-negotiable for sprint exit.

Phase 0 — Diagnostic Pass
Goal: Reproduce the two highest-risk P0 issues and report findings before any code changes. The fix scope for Phases 1 and 2 depends on what's actually broken.

Phase 0 scope
1. Branch setup

Create sprint-7c/hotfix from sprint-7b-final @ 4dde847
Verify baseline: 373 tests green, mobile typecheck clean
Cherry-pick housekeeping: fix sprint-5.5-final tag drift (git tag -f sprint-5.5-final 648e39d && git push origin -f sprint-5.5-final) — report status
2. Issue #6b diagnostic — Tutorial starting state

Add a diagnostic test (NOT a fix yet) in packages/sim/tests/scenario.tutorial.invariants.test.ts:

Copytest('createTutorialWorld produces a Beat-1-completable starting state', () => {
  const world = createTutorialWorld();
  const playerId = PLAYER_TUTORIAL_FACTION_ID;
  const player = world.factions.find(f => f.id === playerId);

  // Report all relevant starting state
  console.log({
    funding: player.funding,
    units: world.units.filter(u => u.ownerId === playerId),
    london: world.territories.find(t => t.id === TUTORIAL_HOME_TERRITORY_ID),
    paris: world.territories.find(t => t.id === TUTORIAL_PARIS_TERRITORY_ID),
  });

  // Assertions (intentionally aggressive — these MAY fail; that's the diagnostic value)
  expect(player.funding).toBeGreaterThan(0);
  expect(world.units.filter(u => u.ownerId === playerId && u.territoryId === TUTORIAL_HOME_TERRITORY_ID).length).toBeGreaterThanOrEqual(1);
});
Required output in Phase 0 report:

Actual funding value at scenario creation
Actual unit list for player faction
Comparison to Phase 5 playthrough fixture (which used $8,000)
Conclusion: Possibility (1) misconfigured scenario / (2) state drains over time / (3) UI selector broken — pick one, with evidence
3. Issue #2 diagnostic — Alliance contract violation

Add a diagnostic test in packages/sim/tests/diplomacy.allianceContract.diagnostic.test.ts:

Copytest('DIAGNOSTIC: in-flight hostile order vs alliance formation', () => {
  // Scenario: Genghis dispatches assault on player at t=0
  // Player proposes alliance at t=arrival/2
  // Alliance accepted
  // Tick to t=arrival
  // Question: does combat occur?
});
Three sub-tests:

(A) In-flight hostile order + alliance forms before arrival → does combat occur?
(B) AI scoring with active alliance → can AI score a fresh assault against ally? (Inspect score, not behavior)
(C) Combat resolution → does arrivalCombat.ts check areAllied() before resolving?
Required output: Confirmation of which hypothesis (A/B/C, or compounding) is true with code-path evidence (file:line references).

4. Issue #4b diagnostic — Two-Elizabeth in Sprint 5

Quick scan and report:

Does createSprint5World (or equivalent) have two factions sharing leader-elizabeth?
Does Sprint 5 scenario file exist at packages/shared/src/scenario-sprint5.ts or elsewhere?
File:line references
No fix yet. Just confirm the regression.

5. Issue inventory consolidation

Produce docs/sprints/sprint-7c-issues.md with:

All 10 issues with severity, current diagnosis status, planned fix phase (1/2/3)
Open questions for each issue
Test additions planned
Phase 0 acceptance criteria
 Branch sprint-7c/hotfix created from sprint-7b-final @ 4dde847
 Baseline 373 tests confirmed green; mobile typecheck clean
 sprint-5.5-final tag drift fixed (or reported as already-correct)
 Diagnostic test for Issue #6b runs and reports starting state
 Diagnostic tests for Issue #2 run and report which hypothesis is true
 Issue #4b confirmed with file:line references
 docs/sprints/sprint-7c-issues.md created with full inventory
 No production code changed yet — only diagnostic tests added
 Diagnostic tests can pass OR fail — that's their job; report which they did
 Commit: sprint-7c: phase-0 diagnostic pass
Phase 0 report required content
Baseline test count confirmation
Tag drift status
Issue #6b finding: Which possibility (1/2/3) is true, with evidence
Issue #2 finding: Which hypothesis (A/B/C, compounding) is true, with file:line evidence
Issue #4b finding: Confirmation with file:line
Updated fix-scope estimate for Phase 1 (diplomacy) and Phase 2 (tutorial)
Any unexpected findings that change planned scope
Commit hash
Why diagnostic-first
Two reasons:

The fix for Issue #2 differs significantly across A/B/C (single-file vs three-file change). Building the fix before knowing the cause risks over-scoping.
The fix for Issue #6b could be a 5-line scenario adjustment (possibility 1) or a deeper investigation (possibilities 2 or 3). Knowing matters.
After Phase 0 reports, I'll greenlight Phase 1 (diplomacy invariants) with concrete fix scope informed by diagnostics.

Subsequent phases (preview, locked in after Phase 0 reports)
Phase 1 — Diplomacy invariants (Issues #2, #4a, #4b)

Three-part fix for #2 (combat guard + in-flight recall + AI scoring guard) — scope confirmed by Phase 0 findings
Player-faction filter on DiplomacyScreen for #4a
Rename AI Elizabeth → Suleiman in Sprint 5 scenario for #4b
Invariant test: no two factions share leaderId across all scenarios
Estimated ~10-12 new tests
Phase 2 — Tutorial usability (Issues #5a, #6a, #6b, #6c)

Fix tutorial starting state (scope from Phase 0)
Banner recovery affordance — restore button in header when active+dismissed
Banner collapsed-thin default with auto-expand on beat advance
OrderScreen empty-state copy fix
Invariant test: createTutorialWorld() produces Beat-1-completable state
Estimated ~8-10 new tests
Phase 3 — UI hygiene (Issues #1, #3a, #3b, #3c, #5b, #5c)

eventId field on SimEvent for unique React keys (#1)
Safe-area audit across all task screens (#3a)
Persistent header date abbreviation (#3b)
__DEV__ flag gate for [DEV] cards and dev-facing copy (#3c, #5b)
Scroll affordance polish (#5c)
Estimated ~4-6 new tests
Phase 4 — Mandatory real-device cold-play + tag

You execute ~2h cold-play through full tutorial including conquest path, dilemma, graduation
Findings doc: docs/sprints/sprint-7c-cold-play.md
Any P0 found → return to Phase 1/2/3 to fix
No tag until you complete cold-play without P0 issues
Tag sprint-7c-final only after device-validated
Merge sprint-7c/hotfix → main

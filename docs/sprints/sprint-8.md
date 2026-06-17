Locked. All recommendations adopted:

Q1 → Model 3: Faction→Country rename; Territory stays (semantically a city, name deferred to Sprint 9)
Q2 → Capital + threshold: Defeat = capital captured AND zero cities held; capital auto-relocates on capture if other cities remain
Q3 → Canon Option X: Defeated country stays in world.countries with defeated: true; cities transfer to conqueror; alliances dissolve with break events; treaties expire
Q4 → Option β: France defeated in tutorial Beat 2 when Paris falls (teaches the new defeat system)
Q5 → Phasing A: 12 phases sequential with stop-and-report gates
Sprint 8 — Country/City Restructure + Structural Integrity
Theme: Land the canon spine (countries, capitals, defeat conditions, defeated state) while resolving the structural integrity issues surfaced in Sprint 7c cold-play.

Branch: sprint-8/country-city from sprint-7c-final @ (your post-merge HEAD)

Baseline: 443 tests (325 sim + 118 mobile). Target end of sprint: ~520+ (≈80 new tests).

Sprint exit: Real-device cold-play + sprint-8-final tag.

Sprint 8 Phase 0 — Design Pass + Diagnostic + Branch Setup
Goal: Establish baseline, audit current Faction usage across codebase, validate design decisions against reality, surface any unexpected complexities before Phase 1 commits to data model changes.

Phase 0 scope
1. Branch setup

Verify Sprint 7c is merged to main and tagged sprint-7c-final (you confirmed; agent verifies)
Create branch sprint-8/country-city from main (post-merge HEAD)
Confirm baseline: 443 tests green, mobile typecheck clean
2. Faction usage audit — docs/sprints/sprint-8-faction-audit.md

Comprehensive inventory of where Faction is used. Categorize by:

Type definitions: Where is Faction declared, what fields does it have?
Sim modules: Which files import/reference Faction?
Mobile screens: Which UI surfaces reference faction directly?
Tests: How many tests reference faction by ID?
Scenarios: Sprint 4 / Sprint 5 / Tutorial — how do they construct factions?
Storage / persistence: Does any save format key by faction ID?
Dispatch events: Which events carry factionId?
Required output: file-by-file count of references; estimate of rename scope.

3. Capital / city audit

Current Territory has no capital concept. Each faction implicitly has "capital" = the first territory in its list, or hardcoded somewhere. Audit:

Where is "capital" currently implied or hardcoded?
Does any scenario specify a faction's capital territory?
Does any UI surface "capital" to the player?
Required output: list of capital-implied locations and how they're computed today.

4. Defeat detection audit

What happens today when a faction has zero territories?

Does the game continue treating them as active?
Are they still in diplomacy lists? (Yes per cold-play Issue #9.)
Do they still get AI turns?
Are they removed from any UI naturally?
Required output: current behavior summary + identified gaps.

5. Tutorial impact analysis

Specifically for Option β (France defeated in Beat 2):

Where exactly does Beat 2 capture happen? (arrivalCombat.ts ownership change)
What dispatch events fire today on territory capture?
What additional events need to fire for "country defeated"?
Does Beat 5 (Foreign Rule dilemma) need copy adjustments to reflect "ruling defeated France" vs "ruling captured Paris"?
Required output: list of touchpoints for tutorial integration with new defeat system.

6. Migration strategy outline

Old saves have:

Faction records with territories: Id[]
No Country entity
No capital, defeated, etc.
Migration approach for Phase 1 to consume:

Each Faction becomes a Country (1:1 mapping initially)
Country.capitalTerritoryId defaults to the faction's first territory (or scenario-specified)
Country.defeated defaults to territories.length === 0
Country.leaderId already exists on Faction
Faction type kept temporarily as alias for backward compatibility; deprecated in Phase 9+
Required output: migration plan with edge cases identified.

7. Phase 0 invariant tests (diagnostic only)

Add tests that document the desired end-state but expect to fail at Phase 0:

country.defeat.test.ts.skip — country with zero cities marked defeated (will pass after Phase 2)
country.capital.test.ts.skip — capital auto-relocates on capture (will pass after Phase 2)
tutorial.franceDefeated.test.ts.skip — Beat 2 capture triggers France defeat event (will pass after Phase 4)
Skipped tests with TODO comments are placeholder contracts. Or use test.todo() if framework supports it.

8. Risk register — docs/sprints/sprint-8-risks.md

Identified risks for the sprint:

R1: Faction→Country rename diff size; merge conflict risk with any concurrent work
R2: Tutorial test fixtures may need substantial migration (Option β changes Beat 2 behavior)
R3: Mobile UI surfaces that hardcoded Faction terminology in copy (not just code) — design canon expects "country" in player-facing text
R4: Sprint 6 diplomacy state (alliances, treaties, reputation) is keyed by faction IDs — migration must preserve these
R5: Sprint 7c diagnosed but didn't fix #9 (defeated factions in UI); fixing in Phase 9 may surface late-stage issues
Each risk: severity, likelihood, mitigation plan, decision point (which phase confronts it).

Phase 0 acceptance criteria
 Branch sprint-8/country-city created from post-merge main
 Baseline 443 tests green, mobile typecheck clean
 docs/sprints/sprint-8-faction-audit.md created with full inventory
 Capital / city / defeat audits complete
 Tutorial impact analysis complete
 Migration strategy outlined
 Risk register created
 Phase 0 invariant tests added as test.todo() or skipped placeholders
 No production code changed — only audit docs and skipped tests
 Commit: sprint-8: phase-0 design pass + faction audit
Phase 0 report required content
Baseline test count confirmation
Branch setup status
Faction audit summary (counts only; full inventory in doc)
Capital concept findings: does any concept of "capital" exist today?
Defeat detection findings: what does the game do today with zero-territory factions?
Tutorial integration touchpoints
Migration strategy recommendation with edge cases
Risk register summary (top 3 risks)
Updated Phase 1-11 scope estimates if audit changes them
Any unexpected findings that change planned sprint shape
Why diagnostic-first this time
Sprint 7c's Phase 0 diagnostic pass paid off significantly — discovered #6b was mobile-only, identified #2 as compounding A+B+C. Sprint 8 has much larger scope and one wrong assumption about Faction usage could cascade into bugs across the sim.

Specifically: I want to know before Phase 1 commits to a rename whether there are any Faction references in unexpected places (e.g., dispatch event payloads from Sprint 5/6 that we'd have to migrate, storage formats that bake in the term, etc.).

Strict scope rules for Sprint 8
To prevent the sprawl that Sprint 7c experienced (which was correct but exhausting), explicit guardrails:

In scope:

Country entity + Faction→Country rename
Capital + threshold defeat conditions
Defeated country behavior (Cluster 3 recommendations)
Tutorial Option β
Navigation IA redesign
Deep linking
Dilemma modal popup
Destination owner labels everywhere
Defeated country UI handling
Explicitly out of scope (deferred to Sprint 9+):

Territory→City rename (deferred)
Order system unit-aware redesign
"Stance on Arrival" → "Orders on Arrival" copy rename (can land cheaply in this sprint if it's truly a 1-file change; if not, defer)
Mechanical food upkeep
Async build queues + buildCompleted event
Dilemma triggers for treaty/infra pinch paths
Multi-campaign save infrastructure
Influence layer (canon Sprint 9)
Tech tree (canon Sprint 10+)
Mid-sprint scope additions: None unless I explicitly approve. Backlog items that surface during phases get logged to docs/deferred-backlog.md and ignored until Sprint 9.

Proceed with Phase 0? Reply yes and the agent starts.

Expect Phase 0 to be quick (no production code, just audit). Reports back when audit is complete. Phase 1 (Country entity + migration) starts based on what Phase 0 finds.


Phase 1 accepted. Two specific items worth calling out as good catches:

The Record<Id, Country> deviation is correct. Matching the existing factions shape preserves consistency and means existing patterns (lookup by ID, iteration via Object.values) work identically for both. Cursor caught a stylistic improvement that the spec missed.

The scenario-aware capital table is the right model. I anchored on Sprint 5 capitals (Bucharest/Sofia) without noticing Sprint 4 uses different ones (Paris/Berlin) because the same faction-rome ID maps to different capitals per scenario. Cursor's CANONICAL_CAPITALS_BY_SCENARIO correctly captures that scenario-bound semantics. Worth a process note: the same faction ID can play different historical roles across scenarios — that's a feature of the alt-history canon, not a bug.

The other three Qs landed cleanly: AI scheduler benign in Phase 1, diplomacy state preserved by ID continuity, perf deferred to Phase 11. Phase 1 was textbook additive — 17 new tests, no Faction code modified, no behavior change.

Sprint 8 Phase 2 — Capital + Defeat Sim + Events
Goal: Wire defeat conditions and capital-relocation logic into the sim. After this phase, the syncCountriesFromFactions call in tick.ts becomes meaningful — it transitions countries to defeated: true and relocates capitals when appropriate.

Phase 2 scope
1. Defeat condition logic — packages/sim/src/country.ts

Copyexport function isCountryDefeated(world: WorldState, countryId: Id): boolean {
  return citiesOf(world, countryId).length === 0;
}
That's the rule per Cluster 2 recommendation: zero cities = defeated. Capital capture alone is not defeat — the country relocates. Only zero remaining cities triggers defeat.

2. Capital relocation logic — packages/sim/src/country.ts

Copyexport function relocateCapitalIfNeeded(world: WorldState, countryId: Id): WorldState {
  const country = findCountry(world, countryId);
  if (!country || country.defeated) return world;

  const capital = world.territories[country.capitalTerritoryId];
  if (capital?.ownerId === countryId) return world;  // capital still held

  // Capital captured. Find new capital from remaining cities.
  const cities = citiesOf(world, countryId);
  if (cities.length === 0) return world;  // will be marked defeated by sync

  // Selection rule: most populous city, ties broken by ID for determinism
  // (Population field may not exist yet — fall back to first city by ID)
  const newCapital = selectNewCapital(cities);
  return setCountryCapital(world, countryId, newCapital.id);
}
Capital selection rule:

Phase 0 audit found no population field on Territory. So the selection rule is:

Phase 2: pick the city with the highest infraLevel (proxy for "importance"); ties broken by lexicographic ID order for determinism
Future (Sprint 9+ when population/manpower lands): switch to population-based selection
Document this in code with // SPRINT-9: switch to population-based capital selection when available.

3. Capital-relocated event — packages/sim/src/types.ts

Copy| { kind: 'capitalRelocated'; at: Millis; eventId: Id; countryId: Id;
    oldCapitalTerritoryId: Id; newCapitalTerritoryId: Id; }
Dispatch line: "Capital of {country name} relocated from {old} to {new}"

Visibility rules:

Public event (everyone sees, like allianceFormed)
Emitted in dispatch feed, surfaces in catch-up digest
4. Country-defeated event — packages/sim/src/types.ts

Copy| { kind: 'countryDefeated'; at: Millis; eventId: Id; countryId: Id; 
    defeatedBy?: Id; finalTerritoryId: Id; }
defeatedBy: the faction that captured the final city (often known; sometimes ambiguous if the country lost cities to multiple factions over time — set to whoever captured the final city)

finalTerritoryId: the last city that fell, useful for narrative ("Genghis lost his final hold at Bucharest")

Dispatch line: "{Country name} has fallen. {Leader name}'s reign ends at {final city}."

Visibility rules:

Public event
High urgency tier (per design canon event-system: heavy event, weighted display)
Surfaces in catch-up digest with extra weight
5. Sync function expansion — packages/sim/src/country.ts

syncCountriesFromFactions becomes the orchestrator. New logic:

Copyexport function syncCountriesFromFactions(world: WorldState): { world: WorldState; events: SimEvent[] } {
  let w = world;
  const events: SimEvent[] = [];

  for (const country of Object.values(w.countries ?? {})) {
    if (country.defeated) continue;  // skip already-defeated

    const cities = citiesOf(w, country.id);
    const capitalHeld = cities.some(c => c.id === country.capitalTerritoryId);

    // Capital relocation check
    if (!capitalHeld && cities.length > 0) {
      const newCapital = selectNewCapital(cities);
      w = setCountryCapital(w, country.id, newCapital.id);
      events.push(buildCapitalRelocatedEvent(w, country.id, country.capitalTerritoryId, newCapital.id));
    }

    // Defeat check
    if (cities.length === 0) {
      w = setCountryDefeated(w, country.id);
      events.push(buildCountryDefeatedEvent(w, country.id, /* defeatedBy inferred */ ));
    }
  }

  return { world: w, events };
}
Signature change: now returns { world, events }. Caller (tick.ts) merges events into the tick's dispatch stream.

defeatedBy inference:

This is genuinely tricky. We don't have a built-in "who captured this city last" record. Three options:

(a) Track at capture time: when territoryCaptured event fires, store lastConquerorByCountry on world state, looked up at defeat time
(b) Look back through recent territoryCaptured events in dispatch history at defeat time
(c) Set defeatedBy: undefined for Phase 2; add proper attribution in a later phase
Recommend (a) — tracking at capture time is cheap, deterministic, and gives correct attribution. The state field is small. Add Country.lastConquerorId?: Id and update on each territoryCaptured where the captured city belongs to that country.

6. Capture path integration — packages/sim/src/arrivalCombat.ts

When a territoryCaptured event fires:

Find the country whose territory was captured (the previous owner)
Update previousOwner.lastConquerorId = newOwner
The syncCountriesFromFactions call at end of tick handles the rest
This is a minimal touch on arrivalCombat.ts — just records the conqueror; doesn't trigger defeat or relocation directly. Keeps capture logic clean; defeat orchestration stays in country.ts.

7. Tick integration — packages/sim/src/tick.ts

Current Phase 1 call:

Copyworld = syncCountriesFromFactions(world);  // returns world
New Phase 2 call:

Copyconst syncResult = syncCountriesFromFactions(world);
world = syncResult.world;
emittedEvents.push(...syncResult.events);
Position in tick order: after recordTreatyObservations, after emitIntelReportEvents, after evaluateBeatProgression. So sync runs at the very end of the tick, sees all ownership changes, and emits defeat/relocation events as the final tick action.

Critical: Beat predicates that fire on countryDefeated (Phase 4 will use this for Beat 2) should evaluate AFTER sync. Re-run evaluateBeatProgression on the newly-emitted events. Or extend the existing beat eval to handle a second pass.

Simpler approach: run sync BEFORE beat progression. Order becomes:

CopyrecordIntel → recordAllied → recordTreaty → emitIntelReports → syncCountries → evaluateBeatProgression
Then beat predicates see the countryDefeated event in the same tick. Recommended.

8. Tests — packages/sim/tests/country.defeat.test.ts (target ~12)

Country with 1 city, captured by enemy → marked defeated, event emitted
Country with 3 cities, capital captured → capital relocates to highest-infra remaining city
Country with 3 cities, non-capital captured → no relocation, no defeat
Country with 2 cities, capital captured → relocates to other city; not defeated
Country with 1 city (the capital), capital captured → defeated; no relocation event (only defeat event)
defeatedBy populated from lastConquerorId set at capture time
Capital selection: ties on infraLevel broken by ID ordering (deterministic)
Already-defeated country: no re-emission of defeat event (idempotent)
Country with zero cities at scenario load → marked defeated on migration; no event emission (no transition)
Multi-tick scenario: country loses cities one by one; relocation fires at correct moments; defeat fires only on last
Two countries defeated in same tick → two events, deterministic ordering
Forward-compat: existing scenarios load and produce expected initial defeated states
9. Integration tests — packages/sim/tests/country.integration.test.ts (extend, ~3 new)

Sprint 4 scenario, simulate Britain attacking Paris (Caesar's capital) → relocation event, no defeat (Caesar still has Berlin... wait, this needs verification per the capital table; agent should construct a clean integration test that matches actual scenario geography)
Tutorial scenario, simulate Beat 2 capture of Paris → France country defeated, event emitted (this is the Phase 4 precondition)
Round-trip: world with defeated country survives save/load with defeat state preserved
Combined target: 475+ (460 baseline + ~15).

10. Promote Phase 0 placeholder tests

The two skipped Phase 0 tests now activate:

country.defeat.test.ts.skip → real implementation in country.defeat.test.ts
country.capital.test.ts.skip → folded into country.defeat.test.ts or its own file
Skipped placeholder count drops from 13 → 11 (the tutorial.franceDefeated stays skipped until Phase 4).

Phase 2 acceptance criteria
 isCountryDefeated + relocateCapitalIfNeeded + selectNewCapital implemented
 setCountryDefeated, setCountryCapital helpers
 capitalRelocated and countryDefeated SimEvents added to type union
 Dispatch formatters for both new events
 Country.lastConquerorId?: Id field added; populated on territoryCaptured
 syncCountriesFromFactions returns { world, events } and emits events
 arrivalCombat.ts updates lastConquerorId (minimal touch)
 tick.ts order: sync runs BEFORE beat progression
 ~15 new tests (12 unit + 3 integration), all green
 475+ tests total green
 Mobile typecheck clean
 intel.forwardcompat.test.ts unchanged
 Phase 0 placeholders for defeat/capital promoted to active tests
 Tutorial isolation maintained (no tutorial.ts imports of country.ts logic; tutorial uses events naturally)
 Commit: sprint-8: phase-2 capital relocation + country defeat
Open questions to resolve during Phase 2 (report alongside)
Q1: defeatedBy for multi-attacker scenarios. If a country loses cities to factions A, B, C over time and the final city falls to A, is defeatedBy: A always right? What if A only captured 1 city and C captured 5? Recommend: yes, lastConquerorId is correct semantics — "who delivered the killing blow." Other attribution (e.g., "primary aggressor") is a future enrichment. Confirm.

Q2: Self-capture / civil war edge case. Can a country "capture" its own territory? (Shouldn't happen, but let's confirm.) If it can, lastConquerorId updates would be weird. Recommend: assert previousOwnerId !== newOwnerId in lastConquerorId update; ignore self-captures. Report findings.

Q3: Capital relocation when no cities remain. Edge case: country has zero cities at end of tick (defeat scenario). The relocation branch (line if (!capitalHeld && cities.length > 0)) skips. Defeat branch fires instead. Confirm via test 5 that this produces exactly one event (defeat, no relocation) when capital is the last city.

Q4: Player country defeat. What if the player's country gets defeated? Phase 2 doesn't add any game-over logic — that's later. But the defeat event still fires. Is anything in the codebase going to crash if world.factions.find(f => f.isPlayer) exists but the corresponding country is defeated: true? Recommend: audit mobile callers of player faction — resolvePlayerFactionId still returns the ID; defeated state is informational only. Should be safe. Confirm via test.

Phase boundary
Stop after Phase 2 reporting. Do not start Phase 3 (defeat cascade — alliance dissolution, AI skip). Report:

Test counts
Mobile typecheck status
Commit hash
Forward-compat canary status
Tutorial isolation verification
Q1-Q4 answers
Capital selection tiebreaker behavior verified
Tick order documented in code comments
Any deviations with rationale
Phase 3 will own: defeat cascade — alliance dissolution with reputation events, treaty expiration, AI skip for defeated countries, dispatch feed handling.
## Deferred — combat & movement refinements
- **Adjacency graph**: real territory-connection model (which territories border
  which). Currently retreat uses nearest-friendly-by-distance as a stand-in.
  Unlocks proper "retreat to adjacent", supply lines, and front definitions.
  Slots in around the micro/macro command tooling sprint.
- **Attacker auto-retreat / abort-on-arrival option**: let an attacker choose to
  abort if outpowered on arrival rather than committing to certain death. A
  convenience, but complicates deterministic resolution — defer until the core
  loop is proven. (Sprint 2 rule: no auto-retreat, you commit you fight.)
- **Unit special abilities / evasion**: leader traits or unit-type flags that
  override "no retreat target → death" or improve lopsided-loss survival
  (commandos, guerrilla leaders, scouts that disengage). Data-only modifiers on
  existing combat resolution. Belongs with the full unit-catalog expansion.
- **Interception of retreating units in transit**: retreating forces moving to a
  fallback territory could be caught en route. Depends on adjacency + richer
  movement interaction. Defer.


## Deferred — defensive garrisons & fortification  [Sprint 6 — governance/territory]

The combat model currently makes defending strictly worse than attacking: the
attacker picks the time and masses force, the defender fights with whatever happens
to be standing there. There is no inherent defensive advantage. Fortification fixes
this and gives the map real terrain.

### Core spec
- Add a territory **fortification level** (a new `fortLevel`, or fold into existing
  `infraLevel`) gated as an infrastructure upgrade (cost + build time, like ports/depots).
- Fortification grants a **defensive combat multiplier** applied to `defenderPower`
  in the existing combat resolution — sits alongside terrainMod and the
  `homeDefenseCombatMod` leader trait. No new combat logic; one more modifier.
  - e.g. Fortress Lv.1 = ×1.25 defenders, Lv.2 = ×1.5. Tunable constant.
- Interactions (all automatic, no special-casing):
  - Fortified defenders are less likely to hit the Amendment-1 retreat threshold
    (higher effective power) → fortified positions stand and fight, open ground
    withdraws. Correct and emergent.
  - Gives infrastructure upgrades a DEFENSIVE payoff alongside the economic one.
  - Makes overnight/offline defense fairer (fortify before you log off).
  - Makes conquest of fortified capitals costly → paces the snowball toward the
    world-domination victory condition.

### Open decision (decide when building Sprint 6)
**Static garrison component?** Should a fortified territory provide a small BASELINE
defensive strength even with NO mobile units present (local militia / fixed defenses)?
- WITH (recommended): a fortified-but-empty territory isn't a free bloodless capture;
  fortification stays useful when your army steps away. Keep it MODEST — a fortress
  alone must not hold off a real army.
- WITHOUT: simpler; fortification only multiplies units actually present. Cleaner but
  punishes "I fortified the border town and my army left for an hour."
Leaning WITH a small static component, but it's a taste call for build time.

### Optional polish (lower priority, defer further if needed)
- "Garrison" as a visible, named, assignable defensive role on the Territory screen
  ("Garrison: 3× Infantry (defending)"), rather than just "units that happen to be
  here." Pure UI/framing over existing stationed-units mechanics. Do whenever the
  Territory screen is being worked.

### Data hooks (already present)
- `Territory.infraLevel` exists; add `fortLevel` + a `FORT_DEFENSE_MULT` lookup in
  constants. Combat already reads defender modifiers, so this is a small, additive change.

## Deferred — worldwide stock exchange (war-reactive markets)  [post-MVP / multiplayer-era]

The ambitious EVOLUTION of the simple marketplace item already in this backlog. A
global exchange for materials (oil, steel, rare metals, food) and finance, whose
prices move dynamically with the political/war landscape — a barometer of the whole
world's state that a savvy player reads like real pre-war commodity markets.

### The concept
- Dynamic prices driven by supply/demand AND world events: war near oil regions
  spikes oil; a blockaded/conquered industrial heartland collapses finished-goods
  supply and moves prices; scarcity from conflict raises rare-metal prices.
- Hooks into events the sim already emits (battle near a resource region, territory
  takeover of an industrial center → price shifts).
- Enables the economic-strategist playstyle (Mansa Musa archetype): stockpile before
  a war you foresee, sell to belligerents at a premium, profit from chaos. Gives the
  long real-time waits another thing to do: read the market, position, time trades.
- Reuses existing systems: prices are sim state; buy/sell are Orders; purchased
  resources ship at real-time speed and can be intercepted (consistent with all trade).

### ⚠️ KEY DESIGN RISK — must preserve resource scarcity
The market must stay SCARCE and VOLATILE. If you can buy any rare metals you want at a
stable price, the "what you lack you must conquer or ally for" tension — the whole
point of the resource geography — EVAPORATES. The market has to make resources
*expensive and unreliable* under pressure, not freely available. Getting this balance
right is the hard part; build it badly and it undermines the resource economy.

### Other hard parts (why it's late)
- Market clearing / price discovery; preventing infinite-money exploit loops.
- AI participation: do AI factions trade? If no, it's a market of one (pale). If yes,
  that's a whole AI-trading subsystem. Far richer with HUMAN participants → naturally a
  multiplayer-era feature, next to alliances + the simple marketplace.

### Sequencing (important)
1. Resource economy must exist and be TUNED first (Sprint 3) — you can't price
   resources until you know how scarce they actually feel in play.
2. Ship the SIMPLE post-offer/accept marketplace (existing backlog item) first —
   find out cheaply whether players engage with trading at all.
3. Only then grow it into this dynamic war-reactive exchange. Do NOT build the hard
   version before the simple one proves players care about trade.
4. Cannot be evaluated as worth building until the CORE LOOP is confirmed fun.

## Force composition & partial dispatch  [near-term refinement — micro/macro prerequisite]

Currently a move order relocates a WHOLE unit stack to one destination. The player
cannot compose a combined-arms force (some infantry + some armor together) or split a
stack to leave troops in reserve. This is a real tactical gap, more pressing once AI
presses multiple fronts and the player must ALLOCATE forces, not just relocate them.

### Spec
- Order model shifts from "move whole unit" to "move a SELECTION with quantities":
  pick multiple unit types and a quantity of each; the rest stays behind.
- Source stack splits (e.g. 3 Infantry -> send 2, keep 1). The dispatched group travels
  and fights as ONE composed force.
- Combat already sums sidePower across a stack, so a mixed-tier composed force resolves
  correctly with no combat-math change — composition just needs to flow through.
- UI: a force-selection screen with per-type quantity steppers; show combined ETA
  (gated by the SLOWEST unit's speed) and combined fuel/upkeep cost.

### Placement
- Foundational layer of the micro/macro command tooling already in this backlog — you
  must be able to compose/split forces BEFORE you can have unit groups, fronts, and
  automated reinforcement. Belongs with or just before that work.
- NOT in Sprint 4 (AI sprint must stay scoped). Refinement of a system that already
  works; AI ("does the world feel alive") is the higher-priority open question.

### Already-present hooks
- Unit.count exists; combat sums power across a stack. Extension, not a restructure.

### Open decision (decide at build time)
- Combined-force ETA: gate on the slowest unit (realistic — the convoy moves at the
  pace of its slowest element). Recommended. Confirm when building.

## Deferred — Sprint 5.5 intel tuning  [post-5.5 play-test]

- **Scout range multiplier**: 2.5× from London already makes Berlin live without moving (~930 km < 1,250 km).
  Consider tuning down to **2.0–2.2×** so some capitals require forward deployment while nearer targets stay visible from home.
  **Do not tune during Sprint 5.5 architecture phases** — defer to cold-play across both scenarios after 5.5 ships.

- **Stale destination order round-trip** (non-blocking test): build scout → observe Berlin → scout dies → Berlin stale →
  player orders attack on Berlin → confirm order executes and state stays consistent.

- **Genghis aggressive scouting visibility (Sprint 6.5 — isolated)**: Two cold-plays (pre/post transit-aware scoring) confirmed the transit multiplier works but does **not** unblock Genghis on `createSprint4World` — Berlin→all capitals exceed the 24h decay window, and attack/build still outscore scout actions. **Not a Sprint 6 bug.** Tuning candidates: (a) higher base scout-build/move weights, (b) closer reachable targets in scenario geometry, (c) forward-deploy heuristic (build scout at frontier, not home). Transit-awareness is a precondition for meaningful scouting, not sufficient alone.

- **Alliance heuristics are threat-reactive (document for scenario authors)**: AI alliances form when shared enemies exist (assault transit or invasion observable in sim state). Peaceful scenarios produce fewer alliances — emergent behavior, not a bug. Scenario authors should expect alliance density to track hostility.

- **Scout transit vs intel decay (Sprint 4 geography)**: Addressed in Sprint 6 Phase 4c via `transitAwareIntelMultiplier`. Fixture proof: near-hostile target is chosen; sprint4 capitals from Berlin remain disqualified.

- **Intel dispatch phrasing polish (Sprint 6.5)**: Allied intel where observer-ally reports their own territory reads tautologically ("Genghis's forces report Genghis activity at Berlin"). Consider dropping redundant subject when `subjectFactionId === observerFaction`, or separate phrasing for own-state vs third-party reports.

- **Treaty term richness (Sprint 6.5 candidate)**: Sprint 6 ships single-territory treaties with fixed 48h duration. Deferred: multi-territory scope, adjustable duration, source-type filtering, cadence options.

- **Treaty acceptance threshold tuning (Sprint 6.5 post-play-test)**: Alliance accept threshold 50 vs treaty 35 is a first-pass gap. Cold-play may suggest adjusting; tunable in `diplomaticAi.ts`.

- **Positive reputation events (Sprint 6.5)**: Sprint 6 only penalizes via alliance breaks. Need positive events to balance break penalty and enable high-reputation acceptance paths (e.g. isolationist Caesar).

- **AI-initiated treaty proposals (Sprint 6.5)**: Sprint 6 AI proposes alliances only; treaties are player-initiated.

- **Two-Elizabeth scenario naming (Sprint 6.5 scenario polish)**: `createSprint4World` has player Elizabeth at London and AI Elizabeth at Madrid. Rename AI faction leader or accept fixture-merge convention for cold-reads.

## Deferred — Sprint 7+ diplomacy

- **Multi-party alliances**: coalitions beyond bilateral pairs.
- **Alliance strength / warmth progression**: graduated commitment beyond binary allied/neutral.
- **Full reputation system**: decay, positive events, scenario starting values, observer drift.
- **Diplomatic chat / messages / formal war declarations**: narrative layer above mechanical events.
- **Multi-step negotiation / counter-offers**: pending proposal queue extended beyond accept/decline.


Sprint 6 candidate: Scout intel richness

Scouts currently produce the same TerritorySnapshot shape as direct units. They differ only in observation range.

Proposal: scout observations include composition detail (unit types, fortifications, possibly readiness) that direct sight does not. This converts scouts from "longer-range eyes" into "specialists whose observations carry analysis."

Strategically: scouts become useful even for territory you can already see, because composition data is qualitatively different from presence data.

Architecturally: requires TerritorySnapshot schema extension and likely requires the underlying simulation to track unit composition explicitly. Pairs naturally with Sprint 6's diplomacy work because allied/treaty intel sources can be tuned to produce different intel qualities (filtered vs. precise vs. approximate).

Open questions:

What composition fields does scout intel include vs. omit?
Does scout intel degrade with extended range?
Does the simulation need to track unit types explicitly, or can composition be inferred from existing data?


## Deferred — environmental simulation layer  [Sprint 9–10 candidate]

Weather, seasons, and timezones as a unified environmental layer affecting
movement, combat, intel, economy, and dispatch atmosphere. NOT one feature —
three distinct sub-systems with different complexity profiles, sequenced
deliberately so the cheap atmospheric layer ships before the expensive
stochastic one.

The strongest version of this game eventually has environmental texture:
autumn rains slowing Caesar's advance, winter freezing northern supply lines,
dawn raids on Berlin, monsoons grounding scouts. That texture is what
separates "functional strategy game" from "memorable strategy game". But it
touches almost every system, so it cannot land in one sprint, and it must
NOT leak into Sprints 6–8 planning.

### Three sub-systems, three cost profiles

**Timezones (easiest)** — presentation layer only.
- Local time at a territory = deterministic function of game time + longitude.
- Dispatches gain time-of-day context ("Dawn report: Steppe forces encamped at Berlin").
- No new sim state, no randomness, no balance complexity.
- Cost: small. Could ship alone in a half-sprint if needed.

**Seasons (medium)** — slow predictable cycle affecting mechanics.
- Function of game time + territory latitude (hemispheric, not global —
  southern hemisphere winters opposite northern).
- Affects: transit speed (winter slows ground movement), attrition (winter
  costs supply), economy (seasonal harvests), combat (terrain interaction
  with seasonal state).
- Still deterministic — no randomness, just slow cyclic modifiers.
- Cost: medium. Touches movement, combat, economy, AI scoring. Sprint-sized.

**Weather (hardest)** — stochastic regional events affecting everything.
- Storms, fog, heat waves — short-duration regional state.
- Affects: combat (visibility, terrain interaction), movement (storms slow
  ships, delays), intel (degrades scout observations — uses the `confidence`
  field already on IntelRecord), economy (port closures, harvest failures).
- REQUIRES seeded determinism — same skip must produce same weather.
- Cost: high. Most invasive. Real source of simulation uncertainty.
- Belongs LAST in the sequencing.

### Why this is deferred (not "later" — deliberately deferred)

The environmental layer touches:
- **combat resolution** (weather/season modifiers alongside terrain, fort)
- **movement and transit** (seasonal speed, weather delays, blocked routes)
- **visibility and intel** (weather degrades observations, populates
  `confidence < 1.0` on scout records)
- **economy** (seasonal production, winter costs, harvest events)
- **AI scoring** (does Genghis attack in winter or wait for spring?)
- **dispatch system** (atmospheric phrasing — weather mentions, time of day)
- **time engine** (environmental state evolves over skips, deterministically
  for season, seed-deterministically for weather)
- **scenarios** (starting season, climate model per scenario)
- **mobile UI** (current weather/season indicators)

That is not one sprint. It is a THEME spanning multiple sprints. Trying to
land it as a single sprint produces shallow mechanics across every system.

### When this fits

**Too early (now / Sprints 6–8):** every subsequent feature would have to be
designed weather-aware. Diplomacy needs seasonal treaty terms. Fortification
needs weather modifiers. Force composition needs seasonal viability. Slows
down every sprint between now and the environmental sprint, for no current
benefit.

**Too late (after Sprint 10+):** retrofitting environmental modifiers into
every existing system. Combat, movement, economy, AI scoring all need to be
revisited with the new layer. Expensive and risky.

**Right window:** after core mechanical layers (Sprints 6–8: diplomacy, scout
intel richness, fortification, force composition) are stable enough to extend
cleanly, but before the deep economic layer (Sprint 10+). Sprint 9 or 10.

### Recommended sequencing when it lands

1. **Timezones first** (half-sprint or paired with another small piece).
   Cheap, atmospheric, low risk. Establishes the pattern of
   "environment as deterministic function of game time + territory location."
   Dispatches gain texture immediately.
2. **Seasons second** (full sprint). Mechanical effects on movement, economy,
   combat. Still deterministic — proves the architecture handles cyclic
   environmental modifiers across every affected system.
3. **Weather last** (full sprint, possibly 1.5). Stochastic regional state.
   Requires seeded determinism discipline. Touches everything seasons touched,
   plus intel confidence, plus combat visibility. The hardest to get right.

DO NOT combine these. Each sub-system has its own design surface; landing
them together produces all three shallow rather than each one solid.

### Architectural commitments to make NOW (cost: zero)

These are commitments, not code changes. Honoring them in Sprints 6–8 keeps
the environmental layer cheap to land later.

- **Seeded determinism for any stochastic events**: when weather eventually
  ships, it uses seeded RNG so path-independence holds. Sprint 5.5's
  determinism discipline carries forward — every stochastic event is
  reproducible from seed.
- **Modifier-based combat resolution**: combat already reads multiple
  modifiers (terrain, leader trait, future fort multiplier). Adding weather
  and season modifiers is additive, no restructuring. DO NOT collapse
  modifiers into combined constants in interim sprints.
- **`confidence` field on IntelRecord stays reserved**: weather-affected
  scouts naturally populate `confidence < 1.0`. Sprint 5.5 already reserved
  the field. Sprint 7+ rumor work and weather work both consume it.
- **Territory has `lat`/`lon` already**: timezone and season calculations
  are deterministic functions of these. No new geometry needed.
- **Dispatch source typing is extensible**: weather mentions in dispatches
  are formatting, not new source types. The existing
  `'direct' | 'scout' | 'allied' | 'treaty'` union does not need extending
  for environmental atmosphere — atmosphere is rendering, not provenance.

### Open design questions (decide at build time, not now)

- **Hemispheric vs global seasons**: hemispheric is more honest given real
  geography, but adds complexity (southern-hemisphere scenarios need
  inverted season state). Recommend hemispheric — the game uses real cities
  with real latitudes, abstracting seasons would feel wrong.
- **Weather regions vs per-territory weather**: simpler is per-territory,
  but weather doesn't respect political borders. Region-based weather
  (e.g. "North Atlantic storm" affects multiple territories) is more
  realistic but requires a region model the game does not currently have.
  Probably per-territory in first cut, region-based as a later refinement.
- **Season length**: real-world year (~8760 game-hours) is realistic but
  long compared to typical play sessions. Compressed seasons (e.g. one
  game-year = 30 real-time days) sacrifice realism for play pacing.
  Tuning decision at build time.
- **Combat modifier magnitudes**: how much does a snowstorm reduce
  attacker power? 10%? 30%? Needs play-testing. Defer to build time.

### Connection to existing architecture and backlog

- Pairs with **scout intel richness** (Sprint 6.5 candidate): weather-degraded
  scout reports use the `confidence` field that scout intel richness will
  also use. Both populate the same field for different reasons.
- Pairs with **fortification** (Sprint 7 candidate): fortified positions
  benefit MORE in bad weather (attacker can't bring force to bear). The
  fortification multiplier and weather modifier compound naturally in
  existing combat resolution.
- Pairs with **diplomacy** (Sprint 6 candidate): seasonal treaty terms
  ("free passage through winter") are a natural extension once treaties
  exist. But Sprint 6 should NOT design diplomacy around weather — add
  seasonal treaty terms in the environmental sprint, not before.
- Independent of **force composition** (Sprint 8 candidate): no direct
  interaction. Force composition is order-model work; environmental
  layer is sim-state work. They cohabit cleanly.

### Hard rule for Sprints 6–8

The environmental layer is REAL and IS COMING, but it must not leak into
intermediate sprint planning. Each sprint between now and the environmental
sprint should ship its mechanics WITHOUT anticipating weather/seasons/timezone
hooks. The architecture is extensible enough (modifier-based combat,
deterministic time engine, lat/lon territories, confidence field) that the
environmental layer can land cleanly LATER without anticipation NOW.

If a Sprint 6–8 feature genuinely needs an environmental hook to make sense,
that is a signal to revisit the sprint scope, not to start building the
environmental layer early.

## Sim state migrations (Sprint 7+)

Every new persisted `WorldState` field ships with:

1. An additive migrator registered in `ensureWorldMigrations`.
2. A legacy-save regression test (strip the field, migrate, confirm playable state).

This discipline prevents recurrence of the Sprint 5.5 scout-build class of bugs.

## Process — canon-shift audit

When upstream canon changes (e.g. Sprint 8 Option β: France defeated in Beat 2
regardless of pinch path), re-audit downstream design decisions that assumed the
old canon. Sprint 7b deferred governance skip on non-conquest pinch paths; that
decision became wrong after Option β and was fixed in Sprint 8.5 Phase 1.

## Process — player action feedback (no silent failures)

Sprint 7c established dispatch events for player-visible cancellations (e.g.
`dispatchCancelledByAlliance`). Sprint 8.5 Phase 2 extends the same principle to
rejections (`orderRejected`). Player-initiated actions that fail in sim should
emit a dispatch or feedback event — never fail silently. AI/non-player failures
may reject quietly.

## Process — diagnostic-first (Sprint 8.5)

Run a diagnostic pass before fixing suspected bugs when cold-play perception and
code path are misaligned. Sprint 8.5 Issue #18: Phase 0 found sim/UI cost logic
correct; Phase 4 construction tests confirmed — no fix required. Prevents
fix-where-no-bug-exists work.

**Require-cycle warnings during cold-play:** triage; do not auto-fix before ship
unless symptomatic. Noise obscures real bugs. Fix when: undefined-at-import,
flaky tests, or user-visible incorrect behavior tied to the cycled modules.

## Process — mobile effect lifecycle (Sprint 9)

**AsyncStorage hydration callbacks must not sit in `useEffect` dependency arrays
when the effect manages timers or other side-effect lifecycles.**

Hydration flips state (e.g. `ready`, dismissed-ID sets) after mount. If that
callback is a dependency, the effect re-runs, cleanup cancels in-flight timers,
and UX becomes intermittent (e.g. first-mount tooltips that never fire).

**Pattern:** read hydration-derived state inside the effect body or event
handlers; depend only on stable inputs (`id`, `enabled`, delay constants). Check
dismissal/persistence at fire time, not as an effect dep that changes when storage
loads.

Source: Sprint 9 Phase 9 — `TooltipAnchor` first-mount timer cancelled when
`isDismissed` (backed by AsyncStorage) was in the effect deps. Fix: remove from
deps; gate at `openTooltip()` time.

## Sprint 7c issue closures (bundled in Sprint 9)

- **Issue #17 — Foreign TerritoryScreen polymorphism** — closed via Sprint 9
  Phase 8 as bundled work. Read-only foreign city influence detail and territory
  screen polymorphism shipped in a single pass (not a separate hotfix iteration).

## Sprint 7b tutorial follow-ups

### Sprint 8 candidates
- **Unit food upkeep consumption per game-day** — pinch is currently legibility-driven
  (low stocks + banner copy), not mechanically forced. Design canon assumes mechanical
  scarcity drives strategic decisions.
- **`buildCompleted` event emission** — event shape reserved in Phase 5; wire when async
  build queues land.
- **Full scenario picker UI** — Phase 6 exposes scenario list via dev menu; player-facing
  picker for New Game (tutorial + sandbox scenarios) deferred.

### Sprint 9 candidates (content depth)
- ~~**Issue #18 per-city infra cost**~~ — **Verified Sprint 8.5 Phase 4.** Sim and
  `costPreview` both scale by target `territory.infraLevel`; cold-play same-cost
  perception was not reproduced in tests. Regression guards in
  `production.infraCost.test.ts` and `infraCost.perTerritory.test.ts`.
- ~~**Dilemma triggers for treaty/infra pinch paths**~~ — **Resolved Sprint 8.5 Phase 1.**
  All pinch paths enqueue Foreign Rule per Option β; no separate Treaty Terms /
  Foreign Investment dilemmas for Beat 4 completion.
- **Treaty pinch UX feedback (Sprint 8.5 cold-play)** — treaty offer/decline path
  resolves Beat 4 without clear player feedback; coordinate with dilemma surfacing
  fix (#14) and Sprint 9 dispatch/UX polish.
- **Alliance proposal two-step UX (Sprint 10)** — apply the same select-then-send
  pattern from Sprint 9.5 Phase 1 treaty UX to `Propose alliance` for diplomacy
  consistency (one-step submit remains lower severity but same accidental-submit class).
- **AI-initiated treaty proposals (Sprint 10)** — AI queues alliances via
  `queueAllianceProposal` but has no symmetric treaty proposal pipeline; players
  can target AI with treaties but AI cannot initiate them. Pair with existing
  Sprint 10 **AI agency for influence threshold actions** theme (Set B expansion).
  Audit confirmed in Sprint 9.5 Phase 4 (duplicate treaty guard).
- **Dilemma consequence preview UI tuning** — Phase 6 ships Choose without spelling out
  "+200 gold, -30 standing" on option cards (legibility B: constraints visible,
  consequences hinted).

### Sprint 9 — engineering hygiene (symptom-triggered)

- **`diplomaticAi` ↔ `playerDiplomacy` require cycle (sim)** — Superseded by
  **Sim require-cycle hygiene** under Sprint 10 candidates below (inventory item
  12). Was symptom-triggered defer from Sprint 8.5; promoted to scheduled work
  after Sprint 9 cycle growth.
- **VirtualizedList slow-update warnings (mobile)** — Promote if scroll jank is
  reported during cold-play on World, Diplomacy, Dispatches, or Forces screens.
  Fix scope: `React.memo` row components, stable `keyExtractor`, avoid inline
  objects in `renderItem`. Dev warning alone is not sufficient trigger.

### Sprint 10 candidates (engineering)

- **Sim require-cycle hygiene** — Dedicated cleanup of `packages/sim` circular
  dependencies. Promoted from "deferred until symptomatic" (Sprint 8.5) to
  scheduled Sprint 10 work after Sprint 9 build added ~10 new cycles on top of
  Sprint 8.5's two known deferrals — growth rate confirms architectural attention,
  not incremental one-off fixes.

  **Inventory (12 cycles, `madge --circular packages/sim/src/index.ts`, Sprint 9):**

  1. `diplomacy.ts` ↔ `diplomaticDispatch.ts`
  2. `country.ts` → `diplomacy.ts` → `diplomaticDispatch.ts` → `dispatch.ts`
  3. `diplomaticDispatch.ts` → `dispatch.ts`
  4. `diplomacy.ts` → `diplomaticDispatch.ts` → `dispatch.ts` → `influenceAccelerators.ts`
  5. `diplomacy.ts` → `diplomaticDispatch.ts` → `dispatch.ts` → `influenceAccelerators.ts` → `influence.ts`
  6. `country.ts` → … → `influenceActions.ts` (via dispatch / influenceAccelerators)
  7. `diplomacy.ts` → … → `influenceActions.ts`
  8. `diplomaticDispatch.ts` → … → `influenceActions.ts`
  9. `country.ts` → … → `movement.ts` → `arrivalCombat.ts`
  10. `diplomacy.ts` → … → `arrivalCombat.ts`
  11. `diplomaticDispatch.ts` → … → `intelDispatch.ts` (via arrivalCombat)
  12. `dispatch.ts` → `influenceAccelerators.ts` → `movement.ts` → `arrivalCombat.ts` → `intelDispatch.ts`

  **Direct pair of highest concern:** `diplomaticAi.ts` ↔ `playerDiplomacy.ts`
  (cycle 13 in full madge output; smallest scoring/threshold extraction fix).

  **Other high-priority pairs:** `country.ts` ↔ `influenceActions.ts` (smallest
  country-layer fix); `diplomacy.ts` ↔ `diplomaticDispatch.ts` (dispatch
  formatting vs state).

  **Likely root cause:** `dispatch.ts` and `diplomacy.ts` are over-imported;
  extract shared types/helpers to dedicated modules (`diplomaticScoring.ts`,
  thin dispatch formatters, etc.).

  **Promotion triggers (any one):**

  - Cold-play finding traceable to module load order or undefined-at-import
  - Diplomacy proposal non-determinism or test flakiness tied to cycled modules
  - Sprint 10 feature work blocked by new import cycles

  **Estimated scope:** 3–5 day dedicated cleanup sprint, or 2–3 phases integrated
  into broader sim architecture work. Re-run `madge --circular src/index.ts` from
  `packages/sim` before starting to confirm current graph.


## UI — Diplomacy identity axes (Sprint 8+)

DiplomacyScreen tertiary disclosure (reputation score + stance today) is the
home for full canon Layer 3 identity-axis display when multi-axis reputation
tracking ships.

## Save infrastructure — multi-campaign (Sprint 8+)

Player campaign identity is implicit today: the loaded `WorldState` JSON carries
`isPlayer` on one faction, not an explicit storage record. Sprint 7c `eventId`
migration backfills legacy dispatches with `legacy-{index}` IDs and starts
`nextEventId` at `1_000_000` on old saves — no schema break because saves are
full world JSON. If Sprint 8 introduces save slots or multiple campaigns,
promote explicit campaign identity in storage (slot id, player faction id,
scenario metadata) rather than inferring solely from `isPlayer`.


Unit-aware order system redesign

Rename UI section "STANCE ON ARRIVAL" → "ORDERS ON ARRIVAL" (or "MISSION")
Reserve stance for AI faction posture (existing stance.ts)
Per-unit-type order lists with shared verb pool (~8 verbs total)
OrderOption data shape: { id, label, description, requiresTier?, validDestinations[] }
Filter orders by destination status (no "Secure" on hostile territory)
Tier-locked orders surface as greyed-out with tooltips
Combined-force orders show combat unit's order list; scout auto-screens
Scout order list: Recon / Infiltrate / Shadow / Screen / Sabotage(T2)
Levy order list: Assault / Secure / Hold / Reinforce / Withdraw
**Note (Sprint 8.5):** `Reinforce` and other unit-specific verbs are design targets for
this redesign. The live sim stance type remains `assault | secure | hold` only until
that work ships; do not reference `reinforce` as an implemented order stance.
Future units (when roster expands): Men-at-Arms (Assault/Storm/Hold/Reinforce), Cavalry (Charge/Raid/Pursue/Hold/Screen), Archers (Assault/Garrison/Hold/Withdraw), Siege (Besiege/Bombard/Hold)
"Raid" and "Pursue" verbs touch the in-transit interception system — far-future backlog item; coordinate when prioritized
Source: 7c-era design session with other agent, 2026-06-16

tructural integrity sprint candidates (from cold-play insights):

#9 Defeated faction handling — when faction has zero territories, mark as defeated: true; remove from active diplomacy lists; preserve in dispatch history; coordinate with canon's "leader removed with country" (Option X)
#10 Dilemma surfacing — promote from Dashboard card to modal popup with urgency window per design canon event-system Model C
#11 Navigation IA redesign — Dispatches appears in both bottom nav and Home, Forces ambiguity, Home as parallel-paths-to-everywhere. Needs unified IA pass.
#12 Deep linking — contextual cross-screen navigation: tap territory name in Diplomacy → navigate to that territory; tap "Move forces here" in World → opens Order with destination pre-set
#13 Destination owner labels — territory ownership visible at decision points (Order screen, etc.)
Order system unit-aware redesign — full Scout/Levy/Cavalry order verb system per other session's design pass
#3a stack header pattern — if approach (2) wasn't fully clean, may need a navigation refactor pass to formalize "persistent header is the only header"

## Sprint 9 documentation polish — country display naming (Sprint 8 Phase 10 note)

Canonical pattern: **country display name derives from `leader.region`; faction/country ID is an opaque identifier.**

Example: `faction-britain` led by Philip II renders as "Spain" (Philip's region), not "Britain". Same pattern as Sprint 7c country-led naming ("Rome — led by Caesar"). Document in player-facing glossary / dev onboarding so future agents do not treat ID slugs as display names.

Source: Sprint 8 Phase 9 acceptance + Sprint 4 cold-play Spain naming flag.

## Sprint 10 process note — AI subsystem collection passes

When AI behavior has a **different decision cadence** than existing scoring (e.g. military orders per tick vs. influence orders capped per day), add a **dedicated collection pass** (`collectAiInfluenceOrders`) rather than extending `decideOrders` / `collectAiOrders`. Keeps scoring loops from compounding complexity.

Source: Sprint 10 Phase 0 audit — AI agency is a new tick path, not an extension of `decideOrders`.

## Sprint 10 process note — cycle hub cascade resolution (Phase 1)

Leaf-module extraction from cyclic **hub** modules (`dispatch.ts`, `diplomacy.ts`, …) can collapse **transitive** require cycles beyond the directly targeted pairs. Breaking hub edges removes dependencies that downstream chains relied on — the right small refactor may fix more cycles than explicitly scoped.

Source: Sprint 10 Phase 1 — 12 sim cycles targeted (6 scoped), 0 remaining after `beatId.ts` + `diplomaticPair.ts` extractions.

## Sprint 11+ — consolidate `diplomaticDispatch.ts` re-export barrel

`diplomaticDispatch.ts` is a backward-compat re-export over `diplomaticEvents.ts`. When consumer paths are clear, deprecate the barrel and import `diplomaticEvents` directly.

Source: Sprint 10 Phase 1 cycle hygiene.

## Sprint 11+ — dispatch event payload rename (`factionId` → `countryId`)

Dispatch event payloads and saved AsyncStorage history still use `factionId` field names (IDs are country IDs). Renaming requires save migration and optional event versioning if multiple field renames land together. Pair with slug rename consideration below.

Source: Sprint 10 Phase 3 — deferred per Phase 0 audit.

## Sprint 11+ — country ID slug rename (`faction-*` → `country-*`)

Country IDs remain opaque legacy slugs (`faction-player`, `faction-rome`, …) for save compatibility through Sprint 10. Long-term rename to `country-*` slugs is architecturally cleaner but needs full save + snapshot migration.

Source: Sprint 10 Phase 3 — explicit non-decision; IDs unchanged.

## Sprint 10 Phase 9 tuning watch — intelligence channel-flip gap (Phase 6)

Phase 6 keystone proves intel **changes coup success estimate and coup-vs-accelerator ranking** (dual-arm: strong garrison dissuades, weak garrison encourages). On the **strong-garrison informed arm**, `resolveAiDailyInfluenceChannel` did **not** deterministically flip from `'threshold'` to `'accelerator'` — subversion's total score still won the channel even after coup sub-score dropped.

**Open question when next touching scoring weights:** does intelligence ever **flip** what the AI actually does, or only **nudge** sub-scores that get overridden by accelerators (especially subversion)? If the answer is "nudge only," the influence/intel layer may feel less impactful in play than unit tests suggest. Revisit with cold-play observation or a decision-level test that asserts channel flip on a tuned scenario.

Source: Sprint 10 Phase 6 acceptance — honestly reported unasserted channel flip.

## Sprint 10 cleanup — extract shared influence constants (Phase 6)

`intelligenceGather.ts` ↔ `influenceActions.ts` circular import was unblocked by inlining `INTELLIGENCE_MIN_INFLUENCE = 30` as a literal. **Two sources of truth risk** if influence-side thresholds are tuned without updating intelligence. Proper fix: extract shared constants (e.g. `influenceConstants.ts` or extend `constants.ts`) that both modules import — neither imports the other.

Source: Sprint 10 Phase 6 circular-import fix (temporary literal).

## Parked investigation — duplicate treaty / re-proposal stacking (Phase 6 side thread)

**Status:** Parked — not blocking Sprint 10.

**What was being investigated:** A hung inline diagnostic (`playerProposeTreaty` called twice on same target, treaty count via `getTreatiesBetween`, `computePassiveInfluenceSources` with duplicate treaties, treaty-sourced intel record duplication). Goal was to verify whether duplicate proposals or stacked treaties corrupt passive influence accrual or intel emission beyond the Sprint 9.5 Phase 4 `hasActiveTreatyOn` / `active-treaty-exists` guard.

**Why parked:** Script hung (~3.5h, exit 1073807364); unrelated to Phase 6 Intelligence delivery. Sprint 9.5 Phase 4 already shipped four-layer duplicate-treaty **formation** guard (#27). This thread is about **re-proposal / stacking side effects** under repeated player proposes — needs a committed script with timeout + incremental logging, not inline `tsx -e`.

**Next step when picked up:** `packages/sim/scripts/duplicate-treaty-diagnostic.ts` (or similar), assert treaty count, influence sources, and intel records after first + duplicate propose at +1h and same timestamp.

Source: Sprint 10 Phase 6 — diagnostic parked per user; Sprint 9.5 Phase 4 for formation guard context.

## Sprint 11+ — sim test-file type debt (~210 errors)

Adding a `typecheck` script (Sprint 10 review, infrastructure pass) revealed that `packages/sim` had **never been type-checked** — there was no script, and `apps/mobile`'s tsconfig only covers `apps/mobile/**`. `packages/sim/src` and `packages/shared/src` are **clean**; the debt is entirely in test files and one perf bench.

**Current gating:** `pnpm typecheck` runs `packages/sim/tsconfig.src.json` (src only) and **is green** — this is what CI enforces. `pnpm --filter sim typecheck:tests` runs the full surface (`src` + `tests` + `perf`) and currently reports **~210 errors**. The broad `tsconfig.json` is retained so the IDE still type-checks tests.

**Error classes (all in tests, none affect runtime — vitest transpiles without type-checking):**

| Class | Example | Rough count |
|---|---|---|
| `SimEvent` literals missing `eventId` | `tutorialBeats.test.ts:26` — required by `SimEventBase` | largest group |
| Order literals missing tagging fields / wrong shape for `Omit<Order, 'intent' \| 'beatId' \| 'decisionTickMs'>` | `tutorial.playthrough.test.ts:39` | many |
| Over-narrow inferred fixture types | `tutorial.playthrough.test.ts:164` — `WorldState` not assignable to inferred literal faction map | a few |
| Incomplete event literals in perf bench | `perf/tutorialQuick.bench.ts:21` | 1 |

**Highest-value fix:** a typed test-event factory in `tests/fixtures.ts` (e.g. `simEvent(kind, fields)` that stamps `eventId`) would clear the largest class in one pass. Do this before flipping `typecheck:tests` into the CI gate.

**Also fixed during the same pass (for context):** `packages/sim/tsconfig.json` had `rootDir: "."` under `noEmit: true`, which produced 13 spurious `TS6059` errors on every cross-package import from `packages/shared`. `rootDir`/`outDir` removed — they were meaningless without emit.

Source: Sprint 10 full project review — infrastructure pass (`docs/sprints/sprint-10-project-review.md`, P2-4).

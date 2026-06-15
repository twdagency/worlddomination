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

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

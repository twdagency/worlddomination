Design Canon
The strategic vision and design commitments for the project. This document is the reference future sprints implement against. It captures what the game IS, not what's been built yet.

Status: Locked through five-layer design pass. Specific content (leaders, dilemmas, scenarios) is authored progressively across sprints; the architectural and design commitments here are foundational.

Layer 1 — Game Identity
What this game is
A persistent asynchronous strategy game centered on empire-building through conquest, with deep strategic systems supporting year-long campaigns. The player commits to a long-form experience and is rewarded with strategic depth proportional to that commitment.

Reference games
Mechanics and depth:

Civilization — empire breadth, multiple paths, long-arc strategic planning
Master of Orion 2 — meaningful asymmetry, voting/political endgame, depth through faction differentiation
Risk — territorial conquest as primary action, geographical adjacency matters
Twilight Imperium 4 — political depth, asymmetric factions, multiple meaningful paths
Total War (campaign layer only) — multi-city provinces, operational tactics, faction politics
King's Dilemma — moral dilemmas accumulating into political identity
Negative references (explicitly NOT this game):

No pay-to-win monetization (Game of War, Clash of Kings, Rise of Kingdoms)
No real-time tactical combat (StarCraft, AoE, Total War's battle layer)
No city-builder optimization focus (Tropico, Banished)
No tactical scope (XCOM, Into the Breach, Fire Emblem)
No authored narrative (Banner Saga, King of Dragon Pass)
No lightweight/casual format (Reigns, Plague Inc.)
Core player fantasy
Empire-building over time through long-term strategic planning, with conquest as the primary mode of expansion and victory.

Players experience the satisfaction of watching their empire grow under deliberate planning. Smaller tactical wins and losses provide pacing dopamine throughout. Ultimately this is a war-dominated conquest game — diplomacy, political systems, and influence mechanics are tools serving war and empire, not co-equal paths.

Session shape: persistent asynchronous
Campaign length: ~1 year of real time for an engaged player to complete. Serious long-form commitment.

Engagement model — three tiers, all guaranteed value:

Snack (30-120s): Read catch-up, handle urgent prompts, log off. Minimum guarantee: news of activity — the world did something interesting while away.
Meal (10-30 min): Strategic review, multiple orders, diplomatic management, planning the next phase.
Feast (1+ hours): Deep strategic commitment, major campaigns, treaty negotiations, multi-front coordination.
Game must deliver value at every tier. A snack-only player should still progress meaningfully; a feast-occasional player should find depth waiting.

Real-time model: response windows
Time passes in real time; the world is always active. When AI actions affect the player, the player gets a time-bounded response window to engage before defaults apply.

Window sizing principle: windows vary by event type. Diplomatic proposals get longer windows (24-48 game-hours) than combat decisions (6-12 game-hours) than crisis events (variable, often shorter). Windows are a design tool.

This is persistent asynchronous strategy with response windows. Closest genre neighbors: Conflict of Nations, Supremacy 1914, Hearts of Iron multiplayer — but with deeper strategic systems than those games offer.

Speed settings
Player or lobby selects campaign pace at start. Fixed for the campaign duration. Indicative tiers:

Slow: ~2 real-years per campaign
Standard: ~1 real-year per campaign
Fast: ~3 real-months per campaign
Sprint: ~weeks per campaign (4X-like pacing)
Combat philosophy
Strategic-level resolution, not tactical. Combat is force-vs-force with modifiers (composition, terrain, fortification, leader traits). Player does not control individual unit maneuvers.

Operational tactics matter: where to mass force, when to commit, how to defend on multiple fronts, when to feint, when to assault. These happen on the strategic map.

Narrative philosophy
Emergent, not authored. The game is a system that produces stories when played. Same starting position + different random event seeds = different campaigns.

Replayability comes from systems + event randomness, not from new content per playthrough.

The event system is foundational, not decorative. Events must be diverse, consequential, causally chained, and seeded for determinism.

The session-duration contract
The game asks for serious time investment. It MUST deliver strategic depth proportional to that investment.

Concrete implications:

Diplomacy cannot be "click → declined." Multi-step depth required.
Combat cannot be "stack vs stack power comparison." Composition, positioning, and timing matter.
Economy cannot be "income per territory." Production chains, scarcity, trade.
The political layer must exist as a meaningful system, even though war is dominant.
Asymmetric factions are not optional — every faction plays meaningfully differently.
The strategic map must be the game, not just the board it sits on.
Layer 2 — Strategic Model
Structural hierarchy
Country → City structure with Influence layer as a non-ownership overlay.

Countries are first-class entities in the world. Each country contains multiple cities, one of which is designated the capital. Cities are the territorial unit — what gets owned, fought over, built upon, garrisoned. Countries are the political unit — what has a leader, what wins or loses, what enters alliances and treaties.

The influence layer sits over this structure as separate state. Every faction has an influence score in every city in the world, regardless of ownership. Influence is the non-military strategic axis.

World composition
Real-world geography. The game uses the actual Earth — real continents, real countries, real cities. ~200 countries when fully populated, with cities per country varying by historical/geographic reality.

Continent selection at campaign setup. Players choose which continents are in play. Scope scales from focused (one continent) to global (full world).

Every country has a leader at all times. No unowned territory, no power vacuums. The world is fully populated with political entities from the moment a campaign begins.

Alt-history mashup as primary mode. Leaders from different eras coexist on a fictional shared timeline. Specific-era campaigns (WWII, Renaissance, Ancient world) available as future campaign setup options.

Leader-country relationship
Leaders are removed with their countries. When a country falls, its leader is gone. No leader-in-exile mechanic, no restoration intrigue.

Players command countries, not leaders. The country is the player's identity and continuity. Leaders are characters within the country who can die, be succeeded, or be replaced through events.

Succession via heir system with player levers:

Each leader has visible potential heirs with known traits.
Smooth successions happen automatically; crises trigger event sequences.
Players have limited influence levers — "favor an heir" (passive sponsorship), "marriage alliance" (diplomatic act with succession side-effects).
Succession depth is intentionally bounded — succession is a meaningful event, not a sub-game competing with the war system.
Cities, capitals, and conquest
Capitals are mechanically significant but not victory-determining. The capital has special properties — higher income, better infrastructure, hosts the leader, location of certain events. Losing the capital is a major blow but doesn't defeat the country; the capital can relocate to another city.

Country defeat via Standard-plus surrender:

A country becomes vulnerable to surrender when both its capital has been lost AND its city count falls below a threshold. This triggers a surrender event with two outcomes:

Capitulate. Conqueror chooses from a menu: annex, vassalize, install puppet, or impose reparations + disarmament.
Fight on. Country continues as a rump state with defined penalties.
Surrender terms carry ongoing consequences: reparations as recurring income transfers, vassals that can rebel under degraded conditions, puppet governments that can be overthrown by events. Annexation is the only "clean" outcome but carries diplomatic cost.

Full negotiated surrender with bargaining tokens, peace conferences, and conqueror-defender negotiation is deferred to a later expansion sprint.

Victory and defeat
Coalition territory counts toward global domination. Allied territory contributes to the alliance's combined strategic footprint, not just the individual faction's.

Victory modes are campaign setup options:

Joint Victory. All coalition members win together when combined footprint crosses threshold.
Single Victor. A specific leader is named victor from the winning coalition.
Coalition-Endgame. Coalition victory triggers an endgame phase where former allies compete for the final win.
Modes shipped progressively. Initial implementation ships Single Victor. Joint Victory follows. Coalition-Endgame is the most ambitious and lands last.

Technology
Tech tree with era-based starting positions. All factions research up a shared tree, but they start at different points based on their leader's era-appropriate context.

Tech enables unit unlocks, building unlocks, governance unlocks, ability unlocks across six branches:

Military land
Naval
Air (industrial-era and later)
Economic
Governance
Science
Influence mechanics
Accumulation: Hybrid with active weighting.

Passive baseline: Influence shifts continuously based on world conditions — proximity, diplomatic ties, trade relationships, shared culture.
Active accumulation: Specific influence actions are the primary lever. Diplomatic envoys, cultural exchanges, subsidized local factions, propaganda campaigns.
Triggers (threshold-based actions):

30+ influence: Fund factions within the city (cause unrest).
50+ influence: Demand tribute from the city's owner.
70+ influence: Attempt a coup that flips the city to your control.
100% influence: City defects to you peacefully without military action.
Economy
Hybrid economic model: local production, national pooling for some resources.

Per-city (local): Food, manpower, garrison units, infrastructure, local stockpiles.
National pool: Treasury/gold, research progress, refined strategic resources.
Cities can starve while the national treasury is full. Geographic strategy matters: conquering specific cities for their specific outputs is a meaningful strategic objective.

Layer 3 — Depth Systems
Combat depth
Composition with rock-paper-scissors interactions. Combat resolution reads composition, terrain, fortification, leader traits, and tech tier. Unit type interactions matter mechanically.

Terrain interacts with composition. Cavalry penalized in forests and mountains. Armor strong in open terrain, weak in urban. Artillery devastating in flat terrain, useless in dense forest. Fortification scales with terrain.

Three combat domains, each parallel:

Land: force-vs-force with composition, terrain, fortification, RPS interactions.
Naval: parallel system with sea-zone control, ship composition, era-gated tech, transport capability.
Air (industrial-era+): parallel system with air supremacy zones, aircraft composition, transport capability.
Both naval and air can transport ground forces, with distinct capacity/speed/vulnerability profiles. Transport is a core operational capability gating cross-continental warfare and strategic mobility.

Vulnerable transport convoys create escort and interception gameplay — naval submarines hunting convoys, fighters intercepting airlifts, combined-arms protection of strategic movements.

Diplomacy depth
Multi-step negotiation with bargaining tokens.

Diplomatic proposals are opening offers. Counter-proposals are possible. Negotiations continue until both sides agree or one walks away. Each side has bargaining tokens — territory, intel sharing, military commitments, gold, technology, claims — and the negotiation itself is the gameplay.

AI heuristics include "counter-offer logic" — factions evaluate offers, propose adjustments, walk away from unacceptable terms.

Tech tree shape
Era gates with within-era flexibility.

Era progression provides thematic grounding (modern aircraft require industrial-era prerequisites; pre-industrial factions can't skip ahead). Within-era specialization is wide — factions can pursue different branch focuses within their current era.

Six branches:

Military land
Naval
Air (industrial-era and later)
Economic
Governance
Science
Research mechanics
Single active track with heavy passive flavor.

Active research is single-track. Player picks the focus. The passive layer produces real research progress in branches you're not actively focused on, driven by:

Leader traits (scientific leader generates passive science).
Infrastructure (universities → passive science; arsenals → passive military research).
Events (battles won → passive military bonus; political crises → passive governance).
Influence (high foreign influence → passive science from cultural exchange).
Tech-trading (diplomatic exchange via bargaining tokens).
Result: countries develop emergent strategic identity — Britain ends up science-rich whether she focuses or not, because her infrastructure and traits feed passive science.

Governance
Three-layer model — policies, dilemmas, identity.

Policy layer. Player sets ongoing policy stances directly — economic, military, diplomatic, internal. Produces ongoing mechanical effects and shapes which dilemmas trigger.

Dilemma layer (the dominant governance interaction). Events fire from world conditions and policy interactions, presenting morally and politically charged choices. Resolutions affect mechanics across multiple systems and accumulate into political identity.

Identity layer. Cumulative dilemma resolutions shift political identity along tendency axes. Identity affects: AI faction perceptions, available diplomatic options, future dilemma triggers, succession dynamics, reputation across the world.

Dilemma design principles:

Difficulty varies. Mix of light flavor, moderate strategic, and heavy moral dilemmas. Heavy dilemmas are rare and weighty.
No false dichotomies. Most dilemmas have 2-4 options; resolutions reflect real tradeoffs.
Consequences cascade. Resolutions affect standing, resources, faction relationships, reputation, future event triggers, and political identity axes.
Themes and topics drive content generation. Structured thematic taxonomy enables scale.
Content scale target: Thousands of dilemmas over the project's life.

Identity tracking
Player-visible identity layer (4-5 broad axes):

Authoritarian ↔ Liberal
Militarist ↔ Mercantilist
Traditionalist ↔ Progressive
Isolationist ↔ Engaged
Harsh ↔ Merciful
Player-visible themes. Identity themes emerge when broad axes cross thresholds or combine. Examples: "Iron Crown," "Trading Republic," "Enlightened Court," "Imperial Cruelty." Themes affect mechanics directly and surface as "what your country is known for."

System-internal nuance. Underneath, the dilemma resolution machinery tracks finer-grained data. Faction-specific memory. AI heuristics read fine-grained patterns. Content authoring uses precise mappings. Players don't see this layer.

Resources
Twelve working resources across four scopes:

Local (city-scoped): Food, Manpower, Timber, Horses, Stone.
Regional (cluster-scoped): Iron/Steel, Coal — pool within geographic clusters; friction across regions until transport infrastructure links them.
National (country-scoped): Gold, Research points, Oil, Rare metals — fungible across the country.
Geographically concentrated: Oil, Rare metals, Luxury goods — only exist in specific real-world regions; control of those regions determines access.
Strategic principles:

Geography determines what's available.
Conquest of resource-rich regions is a primary strategic motivator.
Trade and alliances are alternative paths to access.
Regional pooling adds infrastructure dimension.
Tech progression changes which resources matter.
Trade
Bilateral diplomatic trade + simple marketplace.

Major resource flows via negotiated treaties.
Smaller transactions via offer-and-accept marketplace.
Prices in the marketplace are seller-set, not market-dynamic.
Dynamic global exchange (war-reactive markets) deferred as a far-future expansion.

Event system
Four categories:

Dilemmas. Require player choice. Morally/politically weighted. Accumulate into identity. The governance layer.
Notifications. World-state awareness. Player informed; no required action.
Opportunities. Time-bounded windows for advantageous actions. Small wins.
Crises. High-stakes time-bounded threats requiring response. Acute attention demand.
Pacing principle:

Dilemmas: regular but weight-varied.
Notifications: continuous baseline.
Opportunities: moderately frequent.
Crises: rare and consequential. One or two per game-month at most.
Triggers (state-triggered backbone with random injection layer):

~70-80% of events fire from world conditions. Most events are consequences.
~20-30% of events fire from time-based rolls weighted by current conditions. Keep the world surprising.
All randomness uses seeded RNG. Same seed produces same campaign.
Chains:

Most chains are state-driven (events affect state, state changes trigger new events).
Heavy dilemmas, major crises, and surrender outcomes get authored follow-up sequences playing out over game-weeks.
Intel depth
Source-differentiated intel quality:

Direct sight: basic presence and counts only.
Scout reports: composition detail when successful. Scouts are analytical specialists.
Allied intel: filtered through the ally's reporting. Approximately accurate for honest allies.
Treaty intel: exactly what the treaty terms specify.
Future: rumor (low confidence, qualitative), counter-intel (active disruption).
The confidence field on intel records is meaningful. Defaults to 1.0 but is honestly populated based on conditions.

Scout mission failure modes:

Detection: probabilistic chance the target faction notices. Triggers notification event and diplomatic consequences.
Destruction: detected scouts may be intercepted. Loss of unit. Returns partial or no intel.
Success: scout returns with full composition-level intel.
Probabilistic but seeded-deterministic.

Progression — three layers
Tech tree (universal). Era-gated with within-era flexibility. Six branches. Persists with the country across leader transitions.

Institutions (country-durable). Long-term investments tied to the country, not the leader. Examples: Royal Academy, Standing Army, Mercantile Guild Network, Naval College, Diplomatic Corps, Civil Service. Built through resource investment + time + dilemma resolutions. Persist across leader transitions. Can be damaged or destroyed by events, war, or political upheaval.

Leader perks (leader-specific). Personal advancement tied to the current leader. Unlocked through actions taken during the leader's reign — combat victories unlock military perks, successful negotiations unlock diplomatic perks. Reset on succession.

The three layers interact richly. A militarily-focused leader unlocks combat perks AND directs institutional investment toward Standing Army AND researches military tech. When that leader dies, perks reset. The new leader inherits institutions and tech.

Layer 4 — Content Canon
Era scope
Full historical scope: ~500 BCE through ~1950 CE.

Six eras covered: Ancient, Classical, Medieval, Renaissance/Early Modern, Industrial, Modern.

Atomic weapons (principles): Buildable at end of modern military and science tech branches. Require rare uranium. Devastating but not victory-triggering. Use triggers massive standing/reputation consequences. Mutual capability creates deterrent equilibrium.

Historical leader handling: Historical figures included with appropriate but respectful representation. Nazi-era leaders included per genre standard (Hearts of Iron / Civilization approach), modeled as historical figures with appropriate traits without ideological celebration. Living and recent figures excluded.

Alt-history premise: Leaders from across history are dropped onto a shared fictional present. Each leader has an era of origin determining starting tech position.

Leader roster
Every country has a leader at all times — no empty countries, no placeholder gaps. Leaders exist in three tiers:

Tier 1 (iconic): ~20-30 at launch, expanding with continent rollout. Deep characterization, distinctive voice, unique perks, era-specific positions.
Tier 2 (historically grounded): ~30-40 at launch. Standard characterization, era-appropriate voice, generic-but-real-history identity.
Tier 3 (procedurally appropriate): Remaining country positions. Procedurally-generated era-appropriate names and traits. Plausibly real, not bland.
All three tiers are real characters in the game — they have traits, posture, scouting priority, dispatch behavior, decision logic. The difference is depth of authoring, not depth of presence.

Leader pool grows continent by continent. Launch covers Europe + Mediterranean. Subsequent expansions add continent-specific Tier 1/2/3 leaders.

Launch content scope
Geography: Historical Europe with Mediterranean rim. ~55-60 countries plus Mediterranean coastal regions (~10-15 additional). Hundreds of cities.

Country roster: Expansive historical with era-aware political geography. Some countries exist in all eras (France in some form); some exist only in specific eras (Holy Roman Empire, Burgundy, Crusader states, Italian city-states, Soviet Union). Scenarios load era-appropriate political geography.

Continent expansion roadmap:

Europe + Mediterranean (launch)
Asia
Middle East / Central Asia
Africa
Americas
Oceania / global completeness
Each continent expansion includes geography, era-appropriate leaders, regional resources, regional event flavor.

Scenarios
Launch scenario set:

Tutorial: small geography, 3-5 leaders, six-beat scripted onboarding.
Punic Wars: ancient Mediterranean focus, Carthage vs. Rome.
Crusader Europe: medieval era, religious conflict, European powers vs. Levantine kingdoms.
Napoleon's Europe: industrial era, France vs. coalition.
WWII Europe: modern era, Axis vs. Allies, full air/naval/modern combat.
Europe Sandbox: full Europe + Mediterranean alt-history mashup.
Unit catalog
Two-layer model:

Universal units (~110-120 at launch): baseline catalog across six eras and three combat domains. Tech-gated through the universal tech tree.
Unique units (~60-100 at launch): country-specific signatures, era-locked. Each major faction has 1-3 unique units across their era range. England has Longbowmen; Switzerland has Pikemen; Mongolia has Horse Archers; Sparta has Hoplites; Sweden has Caroleans; Germany has Stormtroopers.
Total launch catalog: ~180-220 units.

Resource geography
Realistic placement with balance tuning. Resources placed based on real-world historical and geological reality, tuned only when necessary for gameplay balance.

Resource placement as setup option:

Strict realistic: historical accuracy.
Balanced gameplay: distributed for competitive fairness.
Event content scale
Launch: Size B (~200-300 dilemmas + ~200-300 other events). 15-20 thematic clusters.

Rapid post-launch expansion committed. Each post-launch sprint includes event/dilemma additions. Target: ~50-100 new dilemmas per cycle. Long-term target: thousands of dilemmas.

Content infrastructure as foundational. The dilemma authoring framework, taxonomy, and generation pipeline are themselves foundational systems.

Campaign setup options
Six axes, providing rich combinatorial play modes:

Continent selection (Europe at launch; future continents on rollout)
Political geography density (strict modern / expansive historical)
Victory mode (Joint / Single Victor / Coalition-Endgame)
Speed setting (Slow / Standard / Fast / Sprint)
Era selection (alt-history mashup / era-coherent — era-coherent deferred to future setup option)
Resource placement (strict realistic / balanced gameplay)
Layer 5 — UI Philosophy
Navigation structure
Dashboard-centric with focused task screens.

Central Dashboard / Home screen serves as briefing surface and navigation hub. Task screens are focused, full-screen workspaces for specific systems.

Navigation pattern: Dashboard → Task → Action → return to Dashboard.

Dashboard responsibilities:

Catch-up summary (when returning from absence).
Urgent attention queue.
Empire state summary.
Navigation to all task screens.
Game time and skip controls.
Task screens (initial canonical set):

Dispatches, World/Map, Order, Diplomacy, Influence, Tech Tree, Governance, Forces, Territory, Progression.
Reduced tab bar: 3-4 icon-led primary destinations.

Persistent header strip: minimal critical state (game time, away indicator, urgent notification count, current funding).

Catch-up digest
Importance-ranked summary with narrative flourish.

Structure:

Narrative opening: brief procedurally-generated paragraph summarizing the period. Tone: war-council briefing.
Critical items (always shown): Crises, dilemmas pending resolution, succession events, alliance proposals, major battles.
Notable items (shown at Standard+): Build completions, research progress, treaty milestones, influence thresholds.
Routine items (grouped at Standard, individual at Full): Border patrols, minor economic ticks, ambient AI activity.
Drill-down access: "Show all events" for full chronological feed.
Player-configurable detail level (Settings, Sprint 7.5+):

Minimal: Critical only.
Standard (default): Critical + Notable, routine grouped.
Full: All events individual.
Importance ranking is system-driven. Events carry importance metadata from emission. Digest uses metadata to rank and group automatically.

Information density
Progressive disclosure with context-adaptive highlights.

Every task screen follows the same disclosure hierarchy:

Primary view (visible by default): 3-5 most important pieces of information. Glance-readable in 5 seconds. Includes urgent items lifted by context-adaptive logic.
Secondary view (expand/tap): Next layer of detail without leaving the screen. Full information about tapped item. Available actions.
Tertiary view (drill-down): Specialist or historical information. Fine-grained data. Strategic analysis.
Context-adaptive highlights: Urgent items lifted into primary view. Recommendations surfaced where helpful. Issue indicators (resource shortages, building blockers) bubbled up.
Action feedback loops
Three-layer feedback for every player action:

Immediate (toast notification, within 200ms): Brief, plain-language outcome summary. Persists 3-5 seconds. Located consistently across all screens.
Persistent (inline screen update): Current screen immediately reflects outcome. State changes visible without navigation.
Historical (dispatch log): Every action and outcome logged. Searchable from Dispatches.
Failure cases produce all three layers. Build attempt blocked: toast explains why; inline shows highlighted resource issue; dispatch logs attempt and failure reason.

Implementation discipline:

No "silent" actions.
No "navigation-required" feedback.
No "ephemeral-only" feedback.
First-session path
Tutorial campaign with six-beat scripted onboarding, graduating to Europe sandbox.

Six beats in dependency order:

Movement. Move infantry to adjacent territory. Teaches orders, ETA, transit.
Combat. Arrive at lightly-defended target. Combat resolves. Teaches resolution, action feedback.
Economy. Build infrastructure on captured territory. Teaches Territory screen, costs, build queue.
Constraint pinch. Try to build higher-tier unit. Blocked — missing local resource (food). WHY-block explains options: conquer food region, trade, build food infrastructure.
Governance. Path chosen in Beat 4 triggers dilemma. Resolution affects standing, identity axes, future events. Teaches governance, dilemmas, identity.
Handoff. Game transitions to Europe sandbox. Player retains tutorial faction.
Beat mechanics:

Suggestions with persistent highlights, not gates.
Player can dismiss prompt banner to background; re-summon when ready.
Beats complete on player action (not on time passing).
Time mechanics:

Tutorial runs at 30× compressed time.
Time multiplier reverts to 1× on graduation.
Graduation transition tested for determinism.
Legibility principle
Constraints fully transparent, consequences hinted.

Constraints (fully shown):

Build costs, resource requirements, tech prerequisites — numerical and explicit.
"Cannot build X — requires Y, you have Z. Acquire from: [list]."
Consequences (qualitatively hinted):

Diplomatic proposals: "Caesar is likely to refuse" / "open to negotiation" / "enthusiastic" — qualitative bands.
Combat preview: "favored" / "roughly even" / "outnumbered" — qualitative.
Dilemma resolution: directional hints, not exact numbers.
Numerical exceptions for mechanical state: ETAs, resource quantities, income/expenditure, research progress.

Preserves room for skill in reading qualitative hints. Optimization-spreadsheet play is impossible.

Mobile design philosophy
Mobile-first, multi-platform aware.

Mobile is the primary design target. UI patterns, density, touch interaction, notification integration, network sensitivity all designed for phone-first experience. Interaction patterns scale up to tablet and desktop without rewrites.

Touch interaction:

Minimum 44pt touch target (iOS) / 48dp (Material).
No reliance on hover states.
Swipe gestures as enhancements, not required.
Long-press for contextual menus.
Network sensitivity:

Sim is deterministic, runs client-side.
Catch-up reconstructs from seed + actions on app open.
Future multiplayer requires server; launch runs offline.
Notification integration:

Push notifications for arrivals, attacks, alliance proposals, urgent dilemmas, crisis events.
Opt-in via system prompt during tutorial.
Player-relevant only.
Suppressed when app foregrounded.
Per-category configurable in Settings (Sprint 7.5+).
Background and state:

State persists across app close/reopen.
Time advances in real time regardless of app state.
Opening after absence triggers catch-up.
Platform-aware deviations:

iOS: Safe Area Insets, SF Symbols, HIG patterns.
Android: Material Design where it differs, system back gesture.
Scaling to tablet/desktop (future):

Dashboard layout has multi-column expansion.
Task screens show secondary detail without drill-down on tablets.
Desktop adds multi-window view, keyboard shortcuts, mouse hover affordances as supplements.
Cross-layer principles
A few principles emerged across multiple layers that are worth stating explicitly:

Determinism is foundational. Every system — combat, AI, events, intel, succession, dilemmas, trade — must be deterministic from seed. Sprint 5.5/6 established this discipline; it carries forward across all future systems. Path-independence holds.

Forward-compatibility is repeatable. Sprint 5.5's forward-compat test pattern (write synthetic tests for anticipated source types before production code emits them) proved across six consecutive Sprint 6 phases. Use this pattern for any architecture-significant sprint.

"Log don't tune." Tuning during architecture sprints corrupts signals. Decisions about content depth, balance, and feel happen after the architecture is stable and informed by play data.

Progressive playability. Every sprint produces a playable intermediate version. Long-horizon development never has "the game isn't playable yet" months. Each sprint adds depth to something already working.

Real-world grounding. Geography is real. Cities are real. Leaders are real. The alt-history premise is the only departure from historical reality — political geography, resource distribution, and cultural identity all reflect the actual world.

Asymmetry is identity. Factions, leaders, countries, scenarios are all meaningfully different. Generic factions with reskins are a failure mode, not a target.

Depth without spreadsheet. Strategic depth comes from meaningful choices with cascading consequences, not from optimization puzzles. Qualitative hints over numerical certainty in consequential decisions.

Players see meaning; systems track precision. Underlying state can be fine-grained and rich; player-facing surfaces are clear, categorical, and narrative.

Implementation horizon
This canon describes a multi-year project. The roadmap to fully realize it spans approximately 15+ sprints, with intermediate playable versions throughout.

Approximate sprint sequence (subject to refinement based on play data and emergent priorities):

Sprint 7: UI/UX unification, tutorial scenario, dashboard, action feedback loops, scout bug fix, tab bar restructure.
Sprint 8: Country/city model restructure. Capital designation. Coalition victory tracking foundation.
Sprint 9: Influence layer foundations.
Sprint 10: Tech tree foundations (initial branches and era progression).
Sprint 11: Tech tree expansion, AI research heuristics, tech UI.
Sprint 12: Surrender system (Standard-plus). Coalition victory modes (Joint, Coalition-Endgame).
Sprint 13: Event system foundations. Random event generation. Causal chains.
Sprint 14: Succession events. Heir generation. Crisis branching.
Sprint 15: Governance dilemma system foundations. Identity tracking.
Sprint 16: Three-layer progression (institutions, leader perks).
Sprint 17+: Naval depth, air depth, multi-step diplomacy depth, content expansion, continent rollouts, multiplayer architecture, etc.
Each sprint produces a playable intermediate version. Specific sprint scoping happens at the start of each sprint, informed by current state and play data.

Canon locked through Layer 5. Future modifications happen through deliberate canon-update conversations, not silent drift during implementation sprints. When implementation surfaces a canonical question we didn't anticipate, the answer is "stop and resolve at canon level," not "decide in code."
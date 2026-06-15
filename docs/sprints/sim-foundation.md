# Sim Foundation — Core Types & Tick Signature

The canonical reference for game state and the simulation entry point.
**Authoritative types live in** `packages/sim/src/types.ts` — keep this doc in sync
when that file changes.

Everything in `/sim` reads/writes these shapes. The mobile app and (future)
server both import `sim`. Keep `/sim` **PURE**: no React, no DB, no network, no
`Math.random` (use the seeded RNG only).

Fields marked `// [sprint N+]` are hooks for later systems — leave them
optional/unused until their sprint. They exist so later features don't force a
refactor of the core shape.

## Status (through Sprint 4)

| System | Module(s) | Notes |
|--------|-----------|-------|
| Time + catch-up | `tick.ts`, `clock.ts` | Event-driven `advanceTo`; one `income` summary per catch-up window |
| Movement | `movement.ts` | Great-circle transit; arrivals |
| Combat | `combat.ts`, `arrivalCombat.ts`, `reports.ts` | Tech-tier battles; withdrawal vs secured |
| Economy | `economy.ts` | Funding + territory resource extraction |
| Manpower | `manpower.ts` | Regen from held territories; build consumes, combat does not refund |
| Production | `production.ts` | Build queue, BOM, infra tier gates |
| Visibility | `visibility.ts` | Fog-of-war; scout range from leader traits |
| AI | `ai.ts` | Same `Order[]` pipeline as player; 6h decision interval in `advanceTo` |
| Dispatches | `reports.ts` | Narrative formatters for movement, production, combat outcomes |

```ts
// ---------- Primitives ----------
export type Id = string;
export type Millis = number;          // absolute epoch ms
export type ResourceId = 'fuel' | 'steel' | 'rareMetals' | 'food'; // extend later
export type Domain = 'land' | 'sea' | 'air';
export type UnitRole =                  // [sprint 8+] full catalog; MVP uses a subset
  | 'infantry' | 'armor' | 'artillery'
  | 'air' | 'naval' | 'transport' | 'spy';

export interface Coord { lat: number; lon: number }

// ---------- Seeded RNG (determinism is mandatory) ----------
export interface RngState { seed: number }   // never call Math.random in /sim

// ---------- Leaders ----------
export interface LeaderWeights {
  aggression: number;  // 1..10
  risk: number;
  economy: number;
  expansion: number;
}
export interface Leader {
  id: Id;
  name: string;
  region: string;
  era: string;
  weights: LeaderWeights;
  // All gameplay effects are multipliers defaulting to 1.0 (see trait table).
  traits: Partial<Record<TraitKey, number>>;
}
export type TraitKey =
  | 'incomeMult' | 'landSpeedMult' | 'seaSpeedMult'
  | 'attackCombatMod' | 'homeDefenseCombatMod'
  | 'buildCostMult' | 'buildTimeMult' | 'manpowerRegenMult'
  | 'scoutRangeMult' | 'standingFloor'            // [sprint 6]
  | 'espionageMult' | 'counterIntelMult';          // [sprint 8+]

// ---------- Unit types (DATA — catalog in /shared/units.ts) ----------
export interface UnitType {
  id: Id;
  name: string;
  tier: number;            // tech generation — dominant combat lever
  domain: Domain;
  role: UnitRole;
  combatValue: number;     // base strength before tech-tier exponent
  baseSpeedKmh: number;
  fundingCost: number;
  manpowerCost: number;
  buildHours: number;
  billOfMaterials: Partial<Record<ResourceId, number>>; // deducted from territory stock
  upkeep?: Partial<Record<ResourceId, number>>;          // [sprint 6+] per-hour
  capacity?: number;       // [sprint 8+] for transports: units carried
}

// ---------- Units (instances on the map) ----------
export interface TransitOrder {
  fromId: Id;
  toCoord: Coord;
  toTerritoryId?: Id;
  departMs: Millis;
  arriveMs: Millis;
  distanceKm: number;
  stanceOnArrival: 'assault' | 'secure' | 'hold';
}
export interface Unit {
  id: Id;
  typeId: Id;              // -> UnitType
  ownerId: Id;             // faction id
  count: number;           // stack size
  locationId?: Id;         // territory if stationed
  transit?: TransitOrder;  // present iff moving
  stance: 'defend' | 'retreat-if-outnumbered' | 'hold';
}

// ---------- Territory ----------
export interface BuildQueueItem {
  unitTypeId: Id;
  count: number;
  startMs: Millis;
  durationMs: Millis;      // completes at startMs + durationMs
}
export interface Territory {
  id: Id;
  name: string;
  coord: Coord;
  ownerId?: Id;
  baseYield: number;                       // funding/hr basis
  infraLevel: number;                      // gates buildable tiers (Depot 1–2, Arsenal 3+)
  resources: Partial<Record<ResourceId, number>>; // local stock (BOM deducted here)
  extraction?: Partial<Record<ResourceId, number>>; // per-hour base rate, scaled by infra
  population?: number;                     // [sprint 6] drives output/manpower
  standing?: number;                       // [sprint 6] 0..100
  buildQueue?: BuildQueueItem[];           // absent when empty
}

// ---------- Factions (player AND AI are identical) ----------
export interface Faction {
  id: Id;
  leaderId: Id;
  isPlayer: boolean;
  funding: number;
  manpower: number;
  manpowerCap: number;
  resources?: Partial<Record<ResourceId, number>>; // [sprint 6+] pooled stock model
  policies?: Policies;                               // [sprint 6]
  diplomacy?: Record<Id, DiplomacyState>;
  tension?: Record<Id, number>;                      // [sprint 8+] cold-war meter
}
export type DiplomacyState = 'neutral' | 'allied' | 'at-war';
export interface Policies {                          // [sprint 6]
  taxation: number;        // 0..1 low..high
  economyFocus: number;    // 0..1 civilian..war
  conscription?: number;
  governance?: number;
}

// ---------- Orders (player & AI both emit these) ----------
export type Order =
  | { kind: 'move'; unitId: Id; toTerritoryId: Id; stanceOnArrival: TransitOrder['stanceOnArrival'] }
  | { kind: 'build'; territoryId: Id; unitTypeId: Id; count: number }
  | { kind: 'upgradeInfra'; territoryId: Id }
  | { kind: 'setPolicy'; factionId: Id; policies: Partial<Policies> }    // [sprint 6]
  | { kind: 'setStance'; unitId: Id; stance: Unit['stance'] }
  | { kind: 'eventChoice'; eventId: Id; choiceId: Id }                    // [sprint 5]
  | { kind: 'covertOp'; spyUnitId: Id; targetId: Id; op: CovertOpKind };  // [sprint 8+]
export type CovertOpKind = 'recon' | 'sabotage' | 'subvert' | 'counterintel';

// ---------- Events (output of the sim, shown in dispatch digest) ----------
export type SimEvent =
  | { kind: 'departure'; at: Millis; unitId: Id; fromTerritoryId: Id; toTerritoryId: Id;
      ownerId: Id; unitTypeId: Id; count: number;
      stanceOnArrival: TransitOrder['stanceOnArrival'] }                          // [sprint 4] snapshot for narrative
  | { kind: 'arrival'; at: Millis; unitId: Id; territoryId: Id;
      ownerId: Id; unitTypeId: Id; count: number;
      stanceOnArrival: TransitOrder['stanceOnArrival']; fromTerritoryId: Id }     // [sprint 4] snapshot for narrative
  | { kind: 'battle'; at: Millis; territoryId: Id; report: BattleReport }
  | { kind: 'withdrawal'; at: Millis; territoryId: Id; factionId: Id; unitIds: Id[];
      toTerritoryId?: Id; destroyed: boolean;
      defenderLosses: number; attackerLosses: number; underFire: boolean }  // [sprint 2]
  | { kind: 'secured'; at: Millis; territoryId: Id; factionId: Id; unitIds: Id[];
      enemyWithdrew: boolean }                                              // [sprint 2]
  | { kind: 'income'; at: Millis; funding: number;
      resourcesByTerritory: Record<Id, Partial<Record<ResourceId, number>>> }  // [sprint 3] per-territory extraction on catch-up
  | { kind: 'production'; at: Millis; territoryId: Id; unitTypeId: Id; count: number;
      factionId: Id }                                                         // [sprint 4] snapshot for narrative
  | { kind: 'buildBlocked'; at: Millis; territoryId: Id; reason: string; missing?: ResourceId }
  | { kind: 'procedural'; at: Millis; eventId: Id; templateId: Id; payload: unknown } // [sprint 5]
  | { kind: 'unrest'; at: Millis; territoryId: Id; standing: number }                 // [sprint 6]
  | { kind: 'victory'; at: Millis; factionId: Id }                                     // [sprint 6]
  | { kind: 'espionage'; at: Millis; report: string; exposed: boolean };               // [sprint 8+]

export interface BattleReport {
  attackerId: Id; defenderId: Id;
  attackerPower: number; defenderPower: number;
  winnerId: Id;
  attackerLosses: number; defenderLosses: number;
  narrative: string;       // human-readable dispatch text
}

// ---------- World State (THE single object) ----------
export interface WorldState {
  nowMs: Millis;
  day: number;             // derived from startMs
  startMs: Millis;         // campaign epoch (day 1 anchor)
  rng: RngState;
  territories: Record<Id, Territory>;
  units: Record<Id, Unit>;
  factions: Record<Id, Faction>;
  leaders: Record<Id, Leader>;
  unitTypes: Record<Id, UnitType>;
  scenarioId: Id;
  victoryThreshold?: number;  // [sprint 6] dominance fraction to win
}

// ============================================================
// CORE SIMULATION ENTRY POINTS
// ============================================================

/**
 * Pure. Advances the world by `elapsedMs`, applying orders at the start of the
 * step, then resolving in order:
 *   1. move orders (departures)
 *   2. build / upgradeInfra orders
 *   3. advance nowMs
 *   4. accrue economy + manpower for elapsedMs
 *   5. production completions at nowMs
 *   6. movement arrivals + hostile resolution at nowMs
 *
 * Returns NEW world + step events. Also returns `accrued` totals for the step
 * (used by advanceTo to build a single income summary — tick itself does NOT
 * emit per-step income events).
 */
export function tick(
  world: WorldState,
  orders: Order[],
  elapsedMs: number
): { world: WorldState; events: SimEvent[]; accrued: AccruedIncome };

export interface AccruedIncome {
  funding: number;
  resourcesByTerritory: Record<Id, Partial<Record<ResourceId, number>>>;
}

/**
 * Event-driven catch-up from world.nowMs to targetMs. Steps to the soonest of:
 *   - next movement arrival
 *   - next production completion (startMs + durationMs)
 *   - next AI decision boundary (every 6h)                    // [sprint 4]
 *   - targetMs
 *
 * Calls tick() per step. Appends ONE summary `income` event for the whole
 * catch-up window (sum of per-step accrual). Production/battle/arrival events
 * fire at their timestamps within the window.
 */
export function advanceTo(
  world: WorldState,
  targetMs: Millis
): { world: WorldState; events: SimEvent[] };

/** Soonest pending arrival or production completion strictly after nowMs. */
export function nextEventMs(world: WorldState): Millis | null;

// ---- Read-time derived values (NOT stored — computed on demand) ----
export function unitPosition(world: WorldState, unitId: Id): Coord;
export function previewMoveEtaMs(world: WorldState, unitId: Id, toTerritoryId: Id): ...;
export function territoryIncomePerHour(world: WorldState, territoryId: Id): number;
export function dominanceShare(world: WorldState, factionId: Id): number;  // [sprint 6]
```

## Economy formulas (Sprint 3)

```
incomePerHour     = baseYield × (1 + 0.25 × infraLevel) × leader.incomeMult
extractionPerHour = extraction[resource] × (1 + 0.25 × infraLevel)
manpowerRegen/hr  = Σ held territory baseYield × MANPOWER_REGEN_PER_YIELD × leader.manpowerRegenMult
```

- Funding accrues to **faction**; extracted resources accrue to **territory** stock.
- Build BOM is checked against and deducted from **territory** stock.
- Build costs funding + manpower from **faction** at queue time; blocked builds deduct **nothing**.
- Manpower spent on builds is **not** refunded when units die in combat.

## Infra & production gates (Sprint 3)

| Infra | Facility | Buildable tiers |
|-------|----------|-----------------|
| 1–2 | Depot | 1–2 |
| 3+ | Arsenal | 1–5 |

## Combat event semantics (Sprint 2)

Three distinct outcomes — do not fold into each other:

| Event | When |
|-------|------|
| `battle` | Forces fought; `BattleReport` carries losses |
| `withdrawal` | Defender relocated (or destroyed with no fallback); may include rearguard losses if attacker used `assault` |
| `secured` | Attacker took ground without a full battle (empty garrison, or enemy withdrew) |

Retreat is per-stack (`retreat-if-outnumbered` only). Withdrawal cost depends on attacker arrival stance: **assault** = fighting retreat (flat fraction losses); **hold/secure** = clean break.

## Dispatch narratives (Sprint 4)

Movement and production events carry **snapshot fields at emission time** (`ownerId`, `unitTypeId`, `count`, `stanceOnArrival`, and `factionId` on production). The digest must not re-read live `world.units` for historical lines — transit is cleared on arrival and stacks can be destroyed in combat.

`reports.ts` exports formatters used by the mobile digest (`apps/mobile/src/game/actions.ts`):

| Formatter | Events | Notes |
|-----------|--------|-------|
| `formatDepartureNarrative` | `departure` | Player: `DEPARTURE — Your …`; AI: `INTEL — {leader}'s …`; stance suffix e.g. `(assault inbound)` toward player territory |
| `formatArrivalNarrative` | `arrival` | Hostile assault: `— contact expected`; secure: `— occupying` |
| `formatProductionNarrative` | `production` | Player: `PRODUCTION — Your …`; AI: `INTEL — {leader} — …` |
| `formatBattleNarrative` | `battle` | Fills `BattleReport.narrative` when empty |
| `formatWithdrawalNarrative` | `withdrawal` | Rearguard / pursuit phrasing |
| `formatSecuredNarrative` | `secured` | Occupation without full battle |

Stance intent on departure (non-exhaustive):

| `stanceOnArrival` | Destination | Suffix |
|-------------------|-------------|--------|
| `assault` | hostile, player-owned | `(assault inbound)` |
| `assault` | hostile, non-player | `(assault)` |
| `assault` | friendly/neutral | `(advance)` |
| `secure` | any | `(to occupy)` |
| `hold` | any | `(reinforcing)` |

## AI (Sprint 4)

- AI factions submit the same `Order[]` as the player (`move`, `build`, `upgradeInfra` only).
- `collectAiOrders` / `decideOrders` run inside `advanceTo` at 6-hour boundaries (`AI_DECISION_INTERVAL_MS`).
- Move targets must pass fog-of-war checks (`visibility.ts`); no world mutation inside AI decision code.
- `assertAiOrders` validates emitted orders against current world state (tests).

## Invariants (enforce these everywhere)

1. **Purity:** `tick` / `advanceTo` never mutate inputs; always return new state.
2. **Determinism:** no `Math.random`; all randomness via `world.rng` (seeded).
3. **No rules in the UI:** the mobile app only calls sim functions + renders results.
4. **Player == AI:** both submit `Order[]`; the sim treats them identically.
5. **Store timestamps, derive on read:** never tick positions per-frame; interpolate on read.
6. **One time engine:** income, production, and arrivals all resolve through `tick` / `advanceTo` — no parallel accrual path in the app.
7. **Event snapshots:** dispatch text reads from event payload fields, not derived from post-hoc world state.
8. **Forward-compatible:** `// [sprint N+]` fields stay optional until implemented; do not remove them.

## Keeping this doc current

When adding a `SimEvent` kind, `Order` variant, or `WorldState` field:

1. Update `packages/sim/src/types.ts` first.
2. Mirror the change here with a sprint tag.
3. If behavior is non-obvious, add a row to the tables above.

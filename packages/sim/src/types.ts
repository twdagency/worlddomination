// packages/sim/src/types.ts
// Single source of truth for game state. PURE — no React/DB/network/Math.random.

export type Id = string;
export type Millis = number;
export type ResourceId = 'fuel' | 'steel' | 'rareMetals' | 'food';
export type Domain = 'land' | 'sea' | 'air';
export type UnitRole =
  | 'infantry'
  | 'armor'
  | 'artillery'
  | 'air'
  | 'naval'
  | 'transport'
  | 'spy';

export interface Coord {
  lat: number;
  lon: number;
}

export interface RngState {
  seed: number;
}

export interface LeaderWeights {
  aggression: number;
  risk: number;
  economy: number;
  expansion: number;
}

export type TraitKey =
  | 'incomeMult'
  | 'landSpeedMult'
  | 'seaSpeedMult'
  | 'attackCombatMod'
  | 'homeDefenseCombatMod'
  | 'buildCostMult'
  | 'buildTimeMult'
  | 'manpowerRegenMult'
  | 'scoutRangeMult'
  | 'standingFloor'
  | 'espionageMult'
  | 'counterIntelMult';

export type LeaderTempo = 'fast' | 'steady' | 'slow';

export interface Leader {
  id: Id;
  name: string;
  region: string;
  era: string;
  weights: LeaderWeights;
  traits: Partial<Record<TraitKey, number>>;
  tempo: LeaderTempo;
}

export interface UnitType {
  id: Id;
  name: string;
  tier: number;
  domain: Domain;
  role: UnitRole;
  combatValue: number;
  baseSpeedKmh: number;
  fundingCost: number;
  manpowerCost: number;
  buildHours: number;
  billOfMaterials: Partial<Record<ResourceId, number>>;
  upkeep?: Partial<Record<ResourceId, number>>;
  capacity?: number;
}

export type OrderIntent = 'defend' | 'attack' | 'expand' | 'build';

export interface TransitOrder {
  fromId: Id;
  toCoord: Coord;
  toTerritoryId?: Id;
  departMs: Millis;
  arriveMs: Millis;
  distanceKm: number;
  stanceOnArrival: 'assault' | 'secure' | 'hold';
  intent: OrderIntent;
  beatId: string;
  decisionTickMs: Millis;
}

export interface Unit {
  id: Id;
  typeId: Id;
  ownerId: Id;
  count: number;
  locationId?: Id;
  transit?: TransitOrder;
  stance: 'defend' | 'retreat-if-outnumbered' | 'hold';
}

export interface BuildQueueItem {
  unitTypeId: Id;
  count: number;
  startMs: Millis;
  durationMs: Millis;
}

export interface Territory {
  id: Id;
  name: string;
  coord: Coord;
  ownerId?: Id;
  baseYield: number;
  infraLevel: number;
  resources: Partial<Record<ResourceId, number>>;
  extraction?: Partial<Record<ResourceId, number>>;
  population?: number;
  standing?: number;
  buildQueue?: BuildQueueItem[];
}

export type DiplomacyState = 'neutral' | 'allied' | 'at-war';

export interface Policies {
  taxation: number;
  economyFocus: number;
  conscription?: number;
  governance?: number;
}

export interface Faction {
  id: Id;
  leaderId: Id;
  isPlayer: boolean;
  funding: number;
  manpower: number;
  manpowerCap: number;
  resources?: Partial<Record<ResourceId, number>>;
  policies?: Policies;
  diplomacy?: Record<Id, DiplomacyState>;
  tension?: Record<Id, number>;
}

export type Order =
  | {
      kind: 'move';
      unitId: Id;
      toTerritoryId: Id;
      stanceOnArrival: TransitOrder['stanceOnArrival'];
      intent: OrderIntent;
      beatId: string;
      decisionTickMs: Millis;
      count?: number;
    }
  | {
      kind: 'build';
      territoryId: Id;
      unitTypeId: Id;
      count: number;
      intent: OrderIntent;
      beatId: string;
      decisionTickMs: Millis;
    }
  | {
      kind: 'upgradeInfra';
      territoryId: Id;
      intent: OrderIntent;
      beatId: string;
      decisionTickMs: Millis;
    }
  | { kind: 'setPolicy'; factionId: Id; policies: Partial<Policies> }
  | { kind: 'setStance'; unitId: Id; stance: Unit['stance'] }
  | { kind: 'eventChoice'; eventId: Id; choiceId: Id }
  | { kind: 'covertOp'; spyUnitId: Id; targetId: Id; op: CovertOpKind };

export type CovertOpKind = 'recon' | 'sabotage' | 'subvert' | 'counterintel';

export interface BattleReport {
  attackerId: Id;
  defenderId: Id;
  attackerPower: number;
  defenderPower: number;
  winnerId: Id;
  attackerLosses: number;
  defenderLosses: number;
  narrative: string;
}

export type SimEvent =
  | {
      kind: 'departure';
      at: Millis;
      unitId: Id;
      fromTerritoryId: Id;
      toTerritoryId: Id;
      ownerId: Id;
      unitTypeId: Id;
      count: number;
      stanceOnArrival: TransitOrder['stanceOnArrival'];
      intent: OrderIntent;
      beatId: string;
      decisionTickMs: Millis;
    }
  | {
      kind: 'arrival';
      at: Millis;
      unitId: Id;
      territoryId: Id;
      ownerId: Id;
      unitTypeId: Id;
      count: number;
      stanceOnArrival: TransitOrder['stanceOnArrival'];
      fromTerritoryId: Id;
      intent: OrderIntent;
      beatId: string;
      decisionTickMs: Millis;
    }
  | { kind: 'battle'; at: Millis; territoryId: Id; report: BattleReport }
  | {
      kind: 'withdrawal';
      at: Millis;
      territoryId: Id;
      factionId: Id;
      unitIds: Id[];
      toTerritoryId?: Id;
      destroyed: boolean;
      defenderLosses: number;
      attackerLosses: number;
      underFire: boolean;
    }
  | {
      kind: 'secured';
      at: Millis;
      territoryId: Id;
      factionId: Id;
      unitIds: Id[];
      enemyWithdrew: boolean;
    }
  | {
      kind: 'income';
      at: Millis;
      funding: number;
      resourcesByTerritory: Record<Id, Partial<Record<ResourceId, number>>>;
    }
  | {
      kind: 'production';
      at: Millis;
      territoryId: Id;
      unitTypeId: Id;
      count: number;
      factionId: Id;
    }
  | {
      kind: 'buildStarted';
      at: Millis;
      territoryId: Id;
      factionId: Id;
      unitTypeId: Id;
      count: number;
      intent: OrderIntent;
      beatId: string;
      decisionTickMs: Millis;
    }
  | {
      kind: 'infraUpgraded';
      at: Millis;
      territoryId: Id;
      factionId: Id;
      infraLevel: number;
      intent: OrderIntent;
      beatId: string;
      decisionTickMs: Millis;
    }
  | { kind: 'buildBlocked'; at: Millis; territoryId: Id; reason: string; missing?: ResourceId }
  | { kind: 'procedural'; at: Millis; eventId: Id; templateId: Id; payload: unknown }
  | { kind: 'unrest'; at: Millis; territoryId: Id; standing: number }
  | { kind: 'victory'; at: Millis; factionId: Id }
  | { kind: 'espionage'; at: Millis; report: string; exposed: boolean };

export interface WorldState {
  nowMs: Millis;
  day: number;
  startMs: Millis;
  rng: RngState;
  territories: Record<Id, Territory>;
  units: Record<Id, Unit>;
  factions: Record<Id, Faction>;
  leaders: Record<Id, Leader>;
  unitTypes: Record<Id, UnitType>;
  scenarioId: Id;
  victoryThreshold?: number;
}

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

export type ScoutingPriority = 'aggressive' | 'defensive' | 'broad';

export type DiplomaticPosture = 'opportunist' | 'isolationist' | 'loyal';

export interface LeaderWeights {
  aggression: number;
  risk: number;
  economy: number;
  expansion: number;
  scoutingPriority: ScoutingPriority;
  diplomaticPosture: DiplomaticPosture;
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

export type PendingProposalType = 'alliance' | 'treaty';

/** In-flight diplomatic offer awaiting accept/decline (typically AI → player). */
export interface PendingProposal {
  id: Id;
  from: Id;
  to: Id;
  type: PendingProposalType;
  scope?: { territoryIds: Id[] };
  durationMs?: Millis;
  proposedAt: Millis;
  expiresAt: Millis;
}

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
  /** Accumulated identity tags from dilemma resolutions. */
  identityTags?: string[];
}

/** Political entity — 1:1 with legacy `Faction` IDs during the Sprint 8 alias period. */
export interface Country {
  id: Id;
  /** Display name — typically the leader's region (e.g. England, France). */
  name: string;
  leaderId: Id;
  /** Designated capital city; empty when the country holds no cities. */
  capitalTerritoryId: Id;
  defeated: boolean;
  isPlayer: boolean;
  diplomaticPosture?: DiplomaticPosture;
  /** Faction that captured the most recently lost city (defeat attribution). */
  lastConquerorId?: Id;
  /** Territory ID of the most recently lost city (defeat narrative). */
  lastLostTerritoryId?: Id;
  /** Wall-clock time when defeat was recorded (undefined for pre-Phase-9 saves). */
  defeatedAt?: Millis;
  /** Alliance partner IDs at the moment of defeat (empty for migrated saves). */
  formerAllianceIds?: Id[];
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

export type DispatchImportance = 'high' | 'medium' | 'low';

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

export type IntelReportVariant = 'activity' | 'massing' | 'construction';

export type SimEventKind =
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
      source: IntelSource;
      beatId: string;
      decisionTickMs: Millis;
      importance?: DispatchImportance;
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
      source: IntelSource;
      beatId: string;
      decisionTickMs: Millis;
      importance?: DispatchImportance;
    }
  | { kind: 'battle'; at: Millis; territoryId: Id; report: BattleReport; importance: DispatchImportance }
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
      importance?: DispatchImportance;
    }
  | {
      kind: 'secured';
      at: Millis;
      territoryId: Id;
      factionId: Id;
      unitIds: Id[];
      enemyWithdrew: boolean;
      importance?: DispatchImportance;
    }
  | {
      kind: 'income';
      at: Millis;
      funding: number;
      resourcesByTerritory: Record<Id, Partial<Record<ResourceId, number>>>;
      importance?: DispatchImportance;
    }
  | {
      kind: 'production';
      at: Millis;
      territoryId: Id;
      unitTypeId: Id;
      count: number;
      factionId: Id;
      importance?: DispatchImportance;
    }
  | {
      kind: 'buildStarted';
      at: Millis;
      territoryId: Id;
      factionId: Id;
      unitTypeId: Id;
      count: number;
      intent: OrderIntent;
      source: IntelSource;
      beatId: string;
      decisionTickMs: Millis;
      importance?: DispatchImportance;
    }
  | {
      kind: 'infraUpgraded';
      at: Millis;
      territoryId: Id;
      factionId: Id;
      infraLevel: number;
      intent: OrderIntent;
      source: IntelSource;
      beatId: string;
      decisionTickMs: Millis;
      importance?: DispatchImportance;
    }
  | {
      kind: 'intelReport';
      at: Millis;
      observerFaction: Id;
      /** Faction whose feed receives this line; defaults to observerFaction when omitted. */
      receiverFaction?: Id;
      territoryId: Id;
      source: IntelSource;
      variant: IntelReportVariant;
      subjectFactionId?: Id;
      garrisonDescriptor?: string;
      intent: OrderIntent;
      beatId: string;
      decisionTickMs: Millis;
      importance?: DispatchImportance;
    }
  | {
      kind: 'allianceFormed';
      at: Millis;
      parties: [Id, Id];
      initiatingFaction: Id;
      beatId: string;
      decisionTickMs: Millis;
      importance?: DispatchImportance;
    }
  | {
      kind: 'allianceBroken';
      at: Millis;
      breaker: Id;
      betrayed: Id;
      parties: [Id, Id];
      beatId: string;
      decisionTickMs: Millis;
      importance?: DispatchImportance;
    }
  | {
      kind: 'treatyFormed';
      at: Millis;
      treatyId: Id;
      parties: [Id, Id];
      territoryIds: Id[];
      expiresAt: Millis;
      initiatingFaction: Id;
      beatId: string;
      decisionTickMs: Millis;
      importance?: DispatchImportance;
    }
  | {
      kind: 'treatyExpired';
      at: Millis;
      treatyId: Id;
      parties: [Id, Id];
      territoryIds: Id[];
      beatId: string;
      decisionTickMs: Millis;
      importance?: DispatchImportance;
    }
  | {
      kind: 'allianceProposed';
      at: Millis;
      proposalId: Id;
      from: Id;
      to: Id;
      expiresAt: Millis;
      beatId: string;
      decisionTickMs: Millis;
      importance?: DispatchImportance;
    }
  | {
      kind: 'allianceDeclined';
      at: Millis;
      from: Id;
      to: Id;
      declinedBy: Id;
      beatId: string;
      decisionTickMs: Millis;
      importance?: DispatchImportance;
    }
  | {
      kind: 'treatyProposed';
      at: Millis;
      proposalId: Id;
      from: Id;
      to: Id;
      territoryIds: Id[];
      expiresAt: Millis;
      durationMs: Millis;
      beatId: string;
      decisionTickMs: Millis;
      importance?: DispatchImportance;
    }
  | {
      kind: 'treatyDeclined';
      at: Millis;
      from: Id;
      to: Id;
      declinedBy: Id;
      territoryIds?: Id[];
      beatId: string;
      decisionTickMs: Millis;
      importance?: DispatchImportance;
    }
  | {
      kind: 'buildBlocked';
      at: Millis;
      territoryId: Id;
      reason: string;
      missing?: ResourceId;
      importance?: DispatchImportance;
    }
  | {
      kind: 'orderRejected';
      at: Millis;
      factionId: Id;
      unitId: Id;
      attemptedDestinationId: Id;
      reason: string;
      importance?: DispatchImportance;
    }
  | { kind: 'procedural'; at: Millis; catalogEventId: Id; templateId: Id; payload: unknown }
  | { kind: 'unrest'; at: Millis; territoryId: Id; standing: number }
  | { kind: 'victory'; at: Millis; factionId: Id }
  | { kind: 'espionage'; at: Millis; report: string; exposed: boolean }
  | {
      kind: 'territoryCaptured';
      at: Millis;
      territoryId: Id;
      previousOwnerId?: Id;
      newOwnerId: Id;
      importance?: DispatchImportance;
    }
  | {
      kind: 'buildCompleted';
      at: Millis;
      ownerId: Id;
      territoryId: Id;
      buildType: 'infrastructure' | 'food-infrastructure' | 'unit';
      importance?: DispatchImportance;
    }
  | {
      kind: 'dilemmaResolved';
      at: Millis;
      factionId: Id;
      dilemmaId: Id;
      optionId: Id;
      importance?: DispatchImportance;
    }
  | {
      kind: 'tutorialHandoffReady';
      at: Millis;
      factionId: Id;
      importance?: DispatchImportance;
    }
  | {
      kind: 'tutorialGraduated';
      at: Millis;
      factionId: Id;
      importance?: DispatchImportance;
    }
  | {
      kind: 'allyArrivalPeaceful';
      at: Millis;
      factionId: Id;
      allyFactionId: Id;
      territoryId: Id;
      fromTerritoryId: Id;
      unitId: Id;
      importance?: DispatchImportance;
    }
  | {
      kind: 'dispatchCancelledByAlliance';
      at: Millis;
      factionId: Id;
      allyFactionId: Id;
      unitId: Id;
      fromTerritoryId: Id;
      toTerritoryId: Id;
      importance?: DispatchImportance;
    }
  | {
      kind: 'orderRedirectedToAlly';
      at: Millis;
      orderingFactionId: Id;
      territoryId: Id;
      newOwnerId: Id;
      unitId: Id;
      fromTerritoryId: Id;
      importance?: DispatchImportance;
    }
  | {
      kind: 'capitalRelocated';
      at: Millis;
      countryId: Id;
      oldCapitalTerritoryId: Id;
      newCapitalTerritoryId: Id;
      importance?: DispatchImportance;
    }
  | {
      kind: 'countryDefeated';
      at: Millis;
      countryId: Id;
      defeatedBy?: Id;
      finalTerritoryId: Id;
      /** Alliance partners at the moment of defeat. */
      formerAlliances?: Id[];
      importance?: DispatchImportance;
    };

/** Stable unique identifier assigned at emission time (see `emit` / `stampEvents`). */
export interface SimEventBase {
  eventId: Id;
}

export type SimEvent = SimEventBase & SimEventKind;
/** Event payload before `eventId` is assigned at emission. */
export type SimEventDraft = SimEventKind;

export type IntelSource = 'direct' | 'scout' | 'allied' | 'treaty';

export interface TerritorySnapshot {
  ownerId?: Id;
  infraLevel: number;
  garrisonCount: number;
  visibleEnemyGarrison: number;
  inTransitCount: number;
}

export interface IntelRecord {
  observerFaction: Id;
  territoryId: Id;
  observationTime: Millis;
  snapshot: TerritorySnapshot;
  source: IntelSource;
  expiresAt: Millis | null;
  confidence: number;
}

export type IntelStore = Record<Id, IntelRecord[]>;

/** Symmetric alliance between two factions. Stored with lexicographically ordered pair. */
export interface AlliancePair {
  factionA: Id;
  factionB: Id;
  formedAt: Millis;
}

/** Time-bounded information-sharing agreement scoped to specific territories. */
export interface Treaty {
  id: Id;
  parties: [Id, Id];
  scope: { territoryIds: Id[] };
  formedAt: Millis;
  expiresAt: Millis;
}

/** reputation[observer][subject] — how observer views subject. Materialized at world creation. */
export type Reputation = Record<Id, Record<Id, number>>;

export type TerritoryVisibilityState =
  | { state: 'live'; snapshot: TerritorySnapshot; sources: IntelSource[] }
  | {
      state: 'stale';
      snapshot: TerritorySnapshot;
      sources: IntelSource[];
      lastObservedAt: Millis;
    }
  | { state: 'unknown' };

export type TutorialBeatId =
  | 'movement'
  | 'combat'
  | 'economy'
  | 'pinch'
  | 'governance'
  | 'handoff';

export interface TutorialState {
  /** True during beats 1–6; false after graduation. */
  active: boolean;
  currentBeat: TutorialBeatId | null;
  completedBeats: TutorialBeatId[];
  startedAt: Millis;
  graduatedAt: Millis | null;
}

export interface PendingDilemma {
  dilemmaId: Id;
  factionId: Id;
  offeredAt: Millis;
}

export type InfluenceSourceKind =
  | 'proximity'
  | 'alliance'
  | 'treaty'
  | 'trade'
  | 'culture'
  | 'scout-presence';

export interface InfluenceSource {
  kind: InfluenceSourceKind;
  /** Influence per game-day from this source at the current snapshot. */
  contribution: number;
  lastAccrualAt: Millis;
}

export interface InfluenceState {
  /** 0–100 cap for threshold actions; floor INFLUENCE_FLOOR for war pressure. */
  value: number;
  lastAccrualAt: Millis;
  lastDecayAt: Millis;
  sources: InfluenceSource[];
}

/** Per target city, per influencing faction. */
export type InfluenceStore = Record<Id, Record<Id, InfluenceState>>;

export interface WorldState {
  nowMs: Millis;
  day: number;
  startMs: Millis;
  rng: RngState;
  territories: Record<Id, Territory>;
  units: Record<Id, Unit>;
  factions: Record<Id, Faction>;
  /** Populated by `ensureWorldCountries` — parallel to `factions` during alias period. */
  countries?: Record<Id, Country>;
  leaders: Record<Id, Leader>;
  unitTypes: Record<Id, UnitType>;
  intel: IntelStore;
  alliances: AlliancePair[];
  treaties: Treaty[];
  reputation: Reputation;
  pendingProposals: PendingProposal[];
  pendingDilemmas?: PendingDilemma[];
  scenarioId: Id;
  victoryThreshold?: number;
  /** Undefined on non-tutorial worlds. Populated by tutorial scenario or migration backfill. */
  tutorial?: TutorialState;
  /** Game-time pacing knob. 30 during active tutorial; 1 otherwise. Set by migration if missing. */
  timeMultiplier?: number;
  /** Monotonic counter for deterministic `eventId` assignment. Starts at 0 on new worlds. */
  nextEventId?: number;
  /** Per-city, per-actor influence. Backfilled to `{}` by `ensureWorldInfluence`. */
  influence?: InfluenceStore;
}

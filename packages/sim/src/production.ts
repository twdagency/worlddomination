import {
  ARSENAL_MAX_TIER,
  ARSENAL_MIN_INFRA,
  DEFAULT_TRAIT,
  DEPOT_MAX_TIER,
  INFRA_UPGRADE_BASE_COST,
  MAX_INFRA_LEVEL,
  MS_PER_HOUR,
} from './constants';
import { incomePerHour } from './economy';
import type {
  BuildQueueItem,
  Id,
  Millis,
  Order,
  ResourceId,
  SimEvent,
  Territory,
  Unit,
  UnitType,
  WorldState,
} from './types';

export type BuildBlockedCode =
  | 'not-owned'
  | 'unknown-unit-type'
  | 'infra-too-low'
  | 'insufficient-funding'
  | 'insufficient-manpower'
  | 'missing-resource'
  | 'max-infra';

export interface BuildBlockedReason {
  code: BuildBlockedCode;
  missing?: ResourceId;
  requiredInfra?: number;
}

export type BuildCheckResult =
  | { ok: true }
  | { ok: false; reason: BuildBlockedReason };

/** Max unit tier buildable at this infra level (Depot 1–2, Arsenal 3+). */
export function maxBuildableTier(infraLevel: number): number {
  if (infraLevel < ARSENAL_MIN_INFRA) return DEPOT_MAX_TIER;
  return ARSENAL_MAX_TIER;
}

export function formatBuildBlockedMessage(
  unitType: UnitType | undefined,
  reason: BuildBlockedReason,
): string {
  const label = unitType?.name ?? 'unit';
  switch (reason.code) {
    case 'missing-resource':
      return `Cannot build ${label} — missing ${reason.missing ?? 'resources'}`;
    case 'infra-too-low':
      return `Cannot build ${label} — requires Arsenal (infra ${reason.requiredInfra ?? ARSENAL_MIN_INFRA}+)`;
    case 'insufficient-funding':
      return `Cannot build ${label} — insufficient funding`;
    case 'insufficient-manpower':
      return `Cannot build ${label} — insufficient manpower`;
    case 'not-owned':
      return `Cannot build ${label} — territory not under your control`;
    case 'unknown-unit-type':
      return `Cannot build — unknown unit type`;
    case 'max-infra':
      return 'Infrastructure already at maximum level';
    default:
      return `Cannot build ${label}`;
  }
}

function leaderBuildTimeMult(world: WorldState, factionId: Id): number {
  const faction = world.factions[factionId];
  const leader = faction ? world.leaders[faction.leaderId] : undefined;
  return leader?.traits.buildTimeMult ?? DEFAULT_TRAIT;
}

function hasResources(
  stock: Partial<Record<ResourceId, number>>,
  bill: Partial<Record<ResourceId, number>>,
  count: number,
): ResourceId | null {
  for (const [resourceId, perUnit] of Object.entries(bill)) {
    const needed = (perUnit ?? 0) * count;
    if (needed <= 0) continue;
    const available = stock[resourceId as ResourceId] ?? 0;
    if (available < needed) return resourceId as ResourceId;
  }
  return null;
}

function deductResources(
  stock: Partial<Record<ResourceId, number>>,
  bill: Partial<Record<ResourceId, number>>,
  count: number,
): Partial<Record<ResourceId, number>> {
  const next = { ...stock };
  for (const [resourceId, perUnit] of Object.entries(bill)) {
    const cost = (perUnit ?? 0) * count;
    if (cost <= 0) continue;
    const key = resourceId as ResourceId;
    next[key] = Math.max(0, (next[key] ?? 0) - cost);
  }
  return next;
}

/** Validate a build order without mutating state. */
export function canBuild(
  world: WorldState,
  territoryId: Id,
  unitTypeId: Id,
  count: number,
  factionId: Id,
): BuildCheckResult {
  if (count <= 0) return { ok: false, reason: { code: 'unknown-unit-type' } };

  const territory = world.territories[territoryId];
  if (!territory || territory.ownerId !== factionId) {
    return { ok: false, reason: { code: 'not-owned' } };
  }

  const unitType = world.unitTypes[unitTypeId];
  if (!unitType) return { ok: false, reason: { code: 'unknown-unit-type' } };

  const maxTier = maxBuildableTier(territory.infraLevel);
  if (unitType.tier > maxTier) {
    return {
      ok: false,
      reason: { code: 'infra-too-low', requiredInfra: ARSENAL_MIN_INFRA },
    };
  }

  const faction = world.factions[factionId];
  if (!faction) return { ok: false, reason: { code: 'not-owned' } };

  const fundingCost = unitType.fundingCost * count;
  if (faction.funding < fundingCost) {
    return { ok: false, reason: { code: 'insufficient-funding' } };
  }

  const manpowerCost = unitType.manpowerCost * count;
  if (faction.manpower < manpowerCost) {
    return { ok: false, reason: { code: 'insufficient-manpower' } };
  }

  const missing = hasResources(territory.resources, unitType.billOfMaterials, count);
  if (missing) {
    return { ok: false, reason: { code: 'missing-resource', missing } };
  }

  return { ok: true };
}

export function buildDurationMs(
  world: WorldState,
  unitType: UnitType,
  factionId: Id,
): Millis {
  const mult = leaderBuildTimeMult(world, factionId);
  return unitType.buildHours * MS_PER_HOUR * mult;
}

/** All production completion timestamps strictly after `nowMs`. */
export function pendingProductionMs(world: WorldState): Millis[] {
  const times: Millis[] = [];
  for (const territory of Object.values(world.territories)) {
    for (const item of territory.buildQueue ?? []) {
      const completeAt = item.startMs + item.durationMs;
      if (completeAt > world.nowMs) times.push(completeAt);
    }
  }
  return times;
}

function findStackUnit(
  units: WorldState['units'],
  territoryId: Id,
  ownerId: Id,
  typeId: Id,
): Unit | undefined {
  return Object.values(units).find(
    (u) =>
      u.locationId === territoryId &&
      u.ownerId === ownerId &&
      u.typeId === typeId &&
      !u.transit,
  );
}

function spawnUnit(
  units: WorldState['units'],
  territoryId: Id,
  ownerId: Id,
  unitTypeId: Id,
  count: number,
  at: Millis,
): WorldState['units'] {
  const existing = findStackUnit(units, territoryId, ownerId, unitTypeId);
  if (existing) {
    return {
      ...units,
      [existing.id]: { ...existing, count: existing.count + count },
    };
  }

  const id = `unit-${territoryId}-${unitTypeId}-${at}`;
  return {
    ...units,
    [id]: {
      id,
      typeId: unitTypeId,
      ownerId,
      count,
      locationId: territoryId,
      stance: 'defend',
    },
  };
}

export function applyBuildOrders(
  world: WorldState,
  orders: Order[],
): {
  factions: WorldState['factions'];
  territories: WorldState['territories'];
  events: SimEvent[];
} {
  let factions = { ...world.factions };
  let territories = { ...world.territories };
  const events: SimEvent[] = [];

  for (const order of orders) {
    if (order.kind === 'build') {
      const territory = territories[order.territoryId];
      const factionId = territory?.ownerId;
      if (!factionId) continue;

      const check = canBuild(world, order.territoryId, order.unitTypeId, order.count, factionId);
      if (!check.ok) {
        events.push({
          kind: 'buildBlocked',
          at: world.nowMs,
          territoryId: order.territoryId,
          reason: formatBuildBlockedMessage(
            world.unitTypes[order.unitTypeId],
            check.reason,
          ),
          missing: check.reason.missing,
        });
        continue;
      }

      const unitType = world.unitTypes[order.unitTypeId]!;
      const faction = factions[factionId]!;
      const fundingCost = unitType.fundingCost * order.count;
      const manpowerCost = unitType.manpowerCost * order.count;

      factions[factionId] = {
        ...faction,
        funding: faction.funding - fundingCost,
        manpower: faction.manpower - manpowerCost,
      };

      const queueItem: BuildQueueItem = {
        unitTypeId: order.unitTypeId,
        count: order.count,
        startMs: world.nowMs,
        durationMs: buildDurationMs(world, unitType, factionId),
      };

      territories[order.territoryId] = {
        ...territory!,
        resources: deductResources(
          territory!.resources,
          unitType.billOfMaterials,
          order.count,
        ),
        buildQueue: [...(territory!.buildQueue ?? []), queueItem],
      };
      events.push({
        kind: 'buildStarted',
        at: world.nowMs,
        territoryId: order.territoryId,
        factionId,
        unitTypeId: order.unitTypeId,
        count: order.count,
        intent: order.intent,
        source: 'direct',
        beatId: order.beatId,
        decisionTickMs: order.decisionTickMs,
        importance: 'medium',
      });
      continue;
    }

    if (order.kind === 'upgradeInfra') {
      const territory = territories[order.territoryId];
      const factionId = territory?.ownerId;
      if (!territory || !factionId) continue;

      if (territory.infraLevel >= MAX_INFRA_LEVEL) {
        events.push({
          kind: 'buildBlocked',
          at: world.nowMs,
          territoryId: order.territoryId,
          reason: formatBuildBlockedMessage(undefined, { code: 'max-infra' }),
          importance: 'medium',
        });
        continue;
      }

      const faction = factions[factionId];
      if (!faction) continue;

      const cost = INFRA_UPGRADE_BASE_COST * territory.infraLevel;
      if (faction.funding < cost) {
        events.push({
          kind: 'buildBlocked',
          at: world.nowMs,
          territoryId: order.territoryId,
          reason: 'Insufficient funding for infrastructure upgrade',
          importance: 'medium',
        });
        continue;
      }

      factions[factionId] = { ...faction, funding: faction.funding - cost };
      const infraLevel = territory.infraLevel + 1;
      territories[order.territoryId] = {
        ...territory,
        infraLevel,
      };
      events.push({
        kind: 'infraUpgraded',
        at: world.nowMs,
        territoryId: order.territoryId,
        factionId,
        infraLevel,
        intent: order.intent,
        source: 'direct',
        beatId: order.beatId,
        decisionTickMs: order.decisionTickMs,
        importance: 'medium',
      });
    }
  }

  return { factions, territories, events };
}

/** Complete build queue items whose finish time is at or before `nowMs`. Pure. */
export function resolveProductionCompletions(
  world: WorldState,
  nowMs: Millis,
): {
  units: WorldState['units'];
  territories: WorldState['territories'];
  events: SimEvent[];
} {
  let units = { ...world.units };
  let territories = { ...world.territories };
  const events: SimEvent[] = [];

  for (const territory of Object.values(world.territories)) {
    const queue = territory.buildQueue ?? [];
    if (queue.length === 0) continue;

    const remaining: BuildQueueItem[] = [];
    let territoryChanged = false;

    for (const item of queue) {
      const completeAt = item.startMs + item.durationMs;
      if (completeAt > nowMs) {
        remaining.push(item);
        continue;
      }

      const ownerId = territory.ownerId;
      if (!ownerId) continue;

      units = spawnUnit(units, territory.id, ownerId, item.unitTypeId, item.count, completeAt);
      events.push({
        kind: 'production',
        at: completeAt,
        territoryId: territory.id,
        unitTypeId: item.unitTypeId,
        count: item.count,
        factionId: ownerId,
        importance: 'medium',
      });
      territoryChanged = true;
    }

    if (territoryChanged) {
      territories[territory.id] = {
        ...territories[territory.id],
        buildQueue: remaining.length > 0 ? remaining : undefined,
      };
    }
  }

  return { units, territories, events };
}

export function territoryIncomePerHour(
  world: WorldState,
  territoryId: Id,
): number {
  const territory = world.territories[territoryId];
  if (!territory?.ownerId) return 0;
  const faction = world.factions[territory.ownerId];
  const leader = faction ? world.leaders[faction.leaderId] : undefined;
  const incomeMult = leader?.traits.incomeMult ?? DEFAULT_TRAIT;
  return incomePerHour(territory, incomeMult);
}

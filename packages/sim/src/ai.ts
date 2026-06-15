import { AI_DECISION_INTERVAL_MS, INFRA_UPGRADE_BASE_COST, MAX_INFRA_LEVEL } from './constants';
import { taggedOrderFields, assertActionableOrderTagged } from './dispatch';
import { haversineKm } from './geo';
import { buildTransit } from './movement';
import { canBuild } from './production';
import {
  computeVisibility,
  isTerritoryVisible,
  isUnitVisible,
  visibleEnemyUnits,
} from './visibility';
import type { Id, LeaderTempo, LeaderWeights, Millis, Order, Territory, Unit, WorldState } from './types';

const ALLOWED_ORDER_KINDS = new Set<Order['kind']>(['move', 'build', 'upgradeInfra']);

export const TEMPO_COMMIT_FRACTION: Record<LeaderTempo, number> = {
  fast: 0.75,
  steady: 0.5,
  slow: 0.3,
};

/** Fraction of available force/resources committed after intent is chosen. */
export function tempoCommitFraction(tempo: LeaderTempo): number {
  return TEMPO_COMMIT_FRACTION[tempo];
}

export function committedCount(available: number, fraction: number): number {
  if (available <= 0) return 0;
  return Math.max(1, Math.min(available, Math.floor(available * fraction)));
}

interface ScoredOrder {
  score: number;
  order: Order;
}

function idleUnits(world: WorldState, factionId: Id): Unit[] {
  return Object.values(world.units).filter(
    (unit) => unit.ownerId === factionId && !unit.transit && unit.locationId,
  );
}

function ownedTerritories(world: WorldState, factionId: Id): Territory[] {
  return Object.values(world.territories).filter((territory) => territory.ownerId === factionId);
}

function leaderWeights(world: WorldState, factionId: Id): LeaderWeights {
  const faction = world.factions[factionId];
  const leader = faction ? world.leaders[faction.leaderId] : undefined;
  return leader?.weights ?? { aggression: 5, risk: 5, economy: 5, expansion: 5 };
}

function leaderTempo(world: WorldState, factionId: Id): LeaderTempo {
  const faction = world.factions[factionId];
  const leader = faction ? world.leaders[faction.leaderId] : undefined;
  return leader?.tempo ?? 'steady';
}

function maxAffordableBuildCount(
  world: WorldState,
  territoryId: Id,
  unitTypeId: Id,
  factionId: Id,
  cap: number = 10,
): number {
  let max = 0;
  for (let count = 1; count <= cap; count++) {
    if (canBuild(world, territoryId, unitTypeId, count, factionId).ok) {
      max = count;
    }
  }
  return max;
}

/** Scale order magnitude by leader tempo after scoring — does not change intent or target. */
export function applyTempoCommitment(
  world: WorldState,
  factionId: Id,
  order: Order,
): Order {
  const fraction = tempoCommitFraction(leaderTempo(world, factionId));

  if (order.kind === 'move') {
    const unit = world.units[order.unitId];
    if (!unit) return order;
    const count = committedCount(unit.count, fraction);
    return count >= unit.count ? order : { ...order, count };
  }

  if (order.kind === 'build') {
    const affordable = maxAffordableBuildCount(
      world,
      order.territoryId,
      order.unitTypeId,
      factionId,
    );
    if (affordable <= 0) return order;
    const count = committedCount(affordable, fraction);
    return { ...order, count };
  }

  return order;
}

function scoreDefend(
  world: WorldState,
  factionId: Id,
  weights: LeaderWeights,
  decisionTickMs: Millis,
): ScoredOrder | null {
  const enemies = visibleEnemyUnits(world, factionId);
  if (enemies.length === 0) return null;

  let best: ScoredOrder | null = null;
  for (const owned of ownedTerritories(world, factionId)) {
    const threatened = enemies.some(
      (enemy) =>
        enemy.locationId &&
        haversineKm(world.territories[enemy.locationId]!.coord, owned.coord) <= 600,
    );
    if (!threatened) continue;

    for (const unit of idleUnits(world, factionId)) {
      if (!unit.locationId || unit.locationId === owned.id) continue;

      const tags = taggedOrderFields(factionId, decisionTickMs, 'defend');
      const order: Order = {
        kind: 'move',
        unitId: unit.id,
        toTerritoryId: owned.id,
        stanceOnArrival: 'hold',
        ...tags,
      };
      if (!buildTransit(world, unit, owned.id, order, world.nowMs)) continue;

      const score = weights.aggression * 4 + weights.risk * 6;
      if (!best || score > best.score) best = { score, order };
    }
  }

  return best;
}

function scoreAttack(
  world: WorldState,
  factionId: Id,
  weights: LeaderWeights,
  decisionTickMs: Millis,
): ScoredOrder | null {
  const visibility = computeVisibility(world, factionId);
  let best: ScoredOrder | null = null;

  for (const unit of idleUnits(world, factionId)) {
    if (!unit.locationId) continue;

    for (const territory of Object.values(world.territories)) {
      if (!territory.ownerId || territory.ownerId === factionId) continue;
      if (!visibility.territoryIds.has(territory.id)) continue;

      const visibleDefenders = Object.values(world.units).filter(
        (defender) =>
          defender.ownerId === territory.ownerId &&
          defender.locationId === territory.id &&
          visibility.unitIds.has(defender.id),
      );
      const defenderPower = visibleDefenders.reduce((sum, defender) => sum + defender.count, 0);

      const tags = taggedOrderFields(factionId, decisionTickMs, 'attack');
      const moveFields = {
        stanceOnArrival: 'assault' as const,
        ...tags,
      };
      if (!buildTransit(world, unit, territory.id, moveFields, world.nowMs)) continue;

      const score =
        weights.aggression * 12 +
        weights.expansion * 6 -
        weights.risk * Math.max(1, defenderPower / Math.max(1, unit.count)) -
        weights.economy * 2;

      const order: Order = {
        kind: 'move',
        unitId: unit.id,
        toTerritoryId: territory.id,
        ...moveFields,
      };
      if (!best || score > best.score) best = { score, order };
    }
  }

  return best;
}

function scoreExpand(
  world: WorldState,
  factionId: Id,
  weights: LeaderWeights,
  decisionTickMs: Millis,
): ScoredOrder | null {
  const visibility = computeVisibility(world, factionId);
  let best: ScoredOrder | null = null;

  for (const unit of idleUnits(world, factionId)) {
    if (!unit.locationId) continue;

    for (const territory of Object.values(world.territories)) {
      if (territory.ownerId) continue;
      if (!visibility.territoryIds.has(territory.id)) continue;

      const tags = taggedOrderFields(factionId, decisionTickMs, 'expand');
      const moveFields = {
        stanceOnArrival: 'secure' as const,
        ...tags,
      };
      if (!buildTransit(world, unit, territory.id, moveFields, world.nowMs)) continue;

      const score = weights.expansion * 10 + weights.economy * 2 - weights.risk * 3;
      const order: Order = {
        kind: 'move',
        unitId: unit.id,
        toTerritoryId: territory.id,
        ...moveFields,
      };
      if (!best || score > best.score) best = { score, order };
    }
  }

  return best;
}

function scoreBuild(
  world: WorldState,
  factionId: Id,
  weights: LeaderWeights,
  decisionTickMs: Millis,
): ScoredOrder | null {
  let best: ScoredOrder | null = null;

  for (const territory of ownedTerritories(world, factionId)) {
    const levyCheck = canBuild(world, territory.id, 'levy-t1', 1, factionId);
    if (levyCheck.ok) {
      const score = weights.economy * 10 + weights.aggression * 2;
      const order: Order = {
        kind: 'build',
        territoryId: territory.id,
        unitTypeId: 'levy-t1',
        count: 1,
        ...taggedOrderFields(factionId, decisionTickMs, 'build'),
      };
      if (!best || score > best.score) best = { score, order };
    }

    const faction = world.factions[factionId];
    if (
      territory.infraLevel < MAX_INFRA_LEVEL &&
      faction &&
      faction.funding >= INFRA_UPGRADE_BASE_COST * territory.infraLevel
    ) {
      const score = weights.economy * 8;
      const order: Order = {
        kind: 'upgradeInfra',
        territoryId: territory.id,
        ...taggedOrderFields(factionId, decisionTickMs, 'build'),
      };
      if (!best || score > best.score) best = { score, order };
    }
  }

  return best;
}

/** Validate AI output — only standard player-equivalent orders. */
export function assertAiOrders(orders: Order[]): void {
  for (const order of orders) {
    if (!ALLOWED_ORDER_KINDS.has(order.kind)) {
      throw new Error(`AI emitted forbidden order kind: ${order.kind}`);
    }
    assertActionableOrderTagged(order);
  }
}

/**
 * Goal-driven orders for one AI faction. Pure — returns orders only, never mutates state.
 */
export function decideOrders(world: WorldState, factionId: Id, decisionTickMs: Millis): Order[] {
  const faction = world.factions[factionId];
  if (!faction || faction.isPlayer) return [];

  const weights = leaderWeights(world, factionId);
  const candidates = [
    scoreDefend(world, factionId, weights, decisionTickMs),
    scoreAttack(world, factionId, weights, decisionTickMs),
    scoreExpand(world, factionId, weights, decisionTickMs),
    scoreBuild(world, factionId, weights, decisionTickMs),
  ].filter((candidate): candidate is ScoredOrder => candidate !== null);

  if (candidates.length === 0) return [];

  candidates.sort((a, b) => b.score - a.score);
  const orders = [applyTempoCommitment(world, factionId, candidates[0].order)];
  assertAiOrders(orders);
  return orders;
}

export function collectAiOrders(world: WorldState, decisionTickMs: Millis): Order[] {
  const orders = Object.values(world.factions)
    .filter((faction) => !faction.isPlayer)
    .flatMap((faction) => decideOrders(world, faction.id, decisionTickMs));
  assertAiOrders(orders);
  return orders;
}

/** Next simulated timestamp when AI factions may issue orders. */
export function nextAiDecisionMs(world: WorldState): Millis | null {
  const hasAi = Object.values(world.factions).some((faction) => !faction.isPlayer);
  if (!hasAi) return null;

  const interval = AI_DECISION_INTERVAL_MS;
  const sinceStart = world.nowMs - world.startMs;
  const step = Math.floor(sinceStart / interval) + 1;
  return world.startMs + step * interval;
}

export function isAiDecisionMs(world: WorldState, atMs: Millis): boolean {
  const next = nextAiDecisionMs(world);
  return next !== null && atMs === next;
}

/** Whether a move target is legal under fog-of-war for this faction. */
export function isMoveTargetVisible(
  world: WorldState,
  factionId: Id,
  toTerritoryId: Id,
): boolean {
  return isTerritoryVisible(world, factionId, toTerritoryId);
}

export function isAttackTargetVisible(
  world: WorldState,
  factionId: Id,
  toTerritoryId: Id,
  enemyUnitIds: Id[],
): boolean {
  if (!isTerritoryVisible(world, factionId, toTerritoryId)) return false;
  return enemyUnitIds.every((unitId) => isUnitVisible(world, factionId, unitId));
}

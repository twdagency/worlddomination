import { AI_DECISION_INTERVAL_MS, INFRA_UPGRADE_BASE_COST, MAX_INFRA_LEVEL } from './constants';
import { haversineKm } from './geo';
import { buildTransit } from './movement';
import { canBuild } from './production';
import {
  computeVisibility,
  isTerritoryVisible,
  isUnitVisible,
  visibleEnemyUnits,
} from './visibility';
import type { Id, LeaderWeights, Millis, Order, Territory, Unit, WorldState } from './types';

const ALLOWED_ORDER_KINDS = new Set<Order['kind']>(['move', 'build', 'upgradeInfra']);

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

function scoreDefend(world: WorldState, factionId: Id, weights: LeaderWeights): ScoredOrder | null {
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
      if (!buildTransit(world, unit, owned.id, 'hold', world.nowMs)) continue;

      const score = weights.aggression * 4 + weights.risk * 6;
      const order: Order = {
        kind: 'move',
        unitId: unit.id,
        toTerritoryId: owned.id,
        stanceOnArrival: 'hold',
      };
      if (!best || score > best.score) best = { score, order };
    }
  }

  return best;
}

function scoreAttack(world: WorldState, factionId: Id, weights: LeaderWeights): ScoredOrder | null {
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

      if (!buildTransit(world, unit, territory.id, 'assault', world.nowMs)) continue;

      const score =
        weights.aggression * 12 +
        weights.expansion * 6 -
        weights.risk * Math.max(1, defenderPower / Math.max(1, unit.count)) -
        weights.economy * 2;

      const order: Order = {
        kind: 'move',
        unitId: unit.id,
        toTerritoryId: territory.id,
        stanceOnArrival: 'assault',
      };
      if (!best || score > best.score) best = { score, order };
    }
  }

  return best;
}

function scoreExpand(world: WorldState, factionId: Id, weights: LeaderWeights): ScoredOrder | null {
  const visibility = computeVisibility(world, factionId);
  let best: ScoredOrder | null = null;

  for (const unit of idleUnits(world, factionId)) {
    if (!unit.locationId) continue;

    for (const territory of Object.values(world.territories)) {
      if (territory.ownerId) continue;
      if (!visibility.territoryIds.has(territory.id)) continue;
      if (!buildTransit(world, unit, territory.id, 'secure', world.nowMs)) continue;

      const score = weights.expansion * 10 + weights.economy * 2 - weights.risk * 3;
      const order: Order = {
        kind: 'move',
        unitId: unit.id,
        toTerritoryId: territory.id,
        stanceOnArrival: 'secure',
      };
      if (!best || score > best.score) best = { score, order };
    }
  }

  return best;
}

function scoreBuild(world: WorldState, factionId: Id, weights: LeaderWeights): ScoredOrder | null {
  let best: ScoredOrder | null = null;

  for (const territory of ownedTerritories(world, factionId)) {
    const levyCheck = canBuild(world, territory.id, 'levy-t1', 1, factionId);
    if (levyCheck.ok) {
      const score = weights.economy * 10 + weights.aggression * 2;
      const order: Order = { kind: 'build', territoryId: territory.id, unitTypeId: 'levy-t1', count: 1 };
      if (!best || score > best.score) best = { score, order };
    }

    const faction = world.factions[factionId];
    if (
      territory.infraLevel < MAX_INFRA_LEVEL &&
      faction &&
      faction.funding >= INFRA_UPGRADE_BASE_COST * territory.infraLevel
    ) {
      const score = weights.economy * 8;
      const order: Order = { kind: 'upgradeInfra', territoryId: territory.id };
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
  }
}

/**
 * Goal-driven orders for one AI faction. Pure — returns orders only, never mutates state.
 */
export function decideOrders(world: WorldState, factionId: Id): Order[] {
  const faction = world.factions[factionId];
  if (!faction || faction.isPlayer) return [];

  const weights = leaderWeights(world, factionId);
  const candidates = [
    scoreDefend(world, factionId, weights),
    scoreAttack(world, factionId, weights),
    scoreExpand(world, factionId, weights),
    scoreBuild(world, factionId, weights),
  ].filter((candidate): candidate is ScoredOrder => candidate !== null);

  if (candidates.length === 0) return [];

  candidates.sort((a, b) => b.score - a.score);
  const orders = [candidates[0].order];
  assertAiOrders(orders);
  return orders;
}

export function collectAiOrders(world: WorldState): Order[] {
  const orders = Object.values(world.factions)
    .filter((faction) => !faction.isPlayer)
    .flatMap((faction) => decideOrders(world, faction.id));
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

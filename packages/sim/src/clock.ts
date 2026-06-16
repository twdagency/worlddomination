import { haversineKm } from './geo';
import type { AccruedIncome } from './economy';
import { collectAiOrders, isAiDecisionMs, nextAiDecisionMs } from './ai';
import { applyAiDiplomaticDecisions } from './diplomaticAi';
import { buildTransit, effectiveSpeedKmh, pendingArrivalMs } from './movement';
import { unitPosition } from './position';
import { pendingProductionMs } from './production';
import { tick } from './tick';
import type { Coord, Id, Millis, ResourceId, SimEvent, WorldState } from './types';
import { STANDARD_TIME_MULTIPLIER } from './tutorial';

/**
 * Presentation pacing for real-time catch-up. Sim ticks advance in game-ms only;
 * the mobile layer scales wall-clock elapsed by this multiplier before calling
 * `advanceTo`. Defaults to 1 when unset (see `ensureWorldTimeMultiplier`).
 */
export function getTimeMultiplier(world: WorldState): number {
  return world.timeMultiplier ?? STANDARD_TIME_MULTIPLIER;
}

/** Timestamp of the soonest pending event, or null if none. */
export function nextEventMs(world: WorldState): Millis | null {
  const pending = [...pendingArrivalMs(world), ...pendingProductionMs(world)];
  const aiNext = nextAiDecisionMs(world);
  if (aiNext !== null) pending.push(aiNext);
  if (pending.length === 0) return null;
  return Math.min(...pending);
}

export function mergeAccruedIncome(a: AccruedIncome, b: AccruedIncome): AccruedIncome {
  const resourcesByTerritory = { ...a.resourcesByTerritory };
  for (const [territoryId, resources] of Object.entries(b.resourcesByTerritory)) {
    const merged = { ...resourcesByTerritory[territoryId] };
    for (const [key, value] of Object.entries(resources)) {
      const resourceId = key as ResourceId;
      if (!value || value <= 0) continue;
      merged[resourceId] = (merged[resourceId] ?? 0) + value;
    }
    resourcesByTerritory[territoryId] = merged;
  }
  return {
    funding: a.funding + b.funding,
    resourcesByTerritory,
  };
}

function hasTerritoryResourceAccrual(
  resourcesByTerritory: Record<Id, Partial<Record<ResourceId, number>>>,
): boolean {
  return Object.values(resourcesByTerritory).some((resources) =>
    Object.values(resources).some((amount) => (amount ?? 0) > 0),
  );
}

/**
 * Advances the world from world.nowMs to targetMs by resolving each pending
 * event in chronological order (event-driven). Pure.
 */
export function advanceTo(
  world: WorldState,
  targetMs: Millis,
): { world: WorldState; events: SimEvent[] } {
  if (targetMs <= world.nowMs) {
    return { world, events: [] };
  }

  let current = world;
  const allEvents: SimEvent[] = [];
  let incomeAccrued: AccruedIncome = { funding: 0, resourcesByTerritory: {} };

  while (current.nowMs < targetMs) {
    const next = nextEventMs(current);
    const stepTarget = next !== null && next <= targetMs ? next : targetMs;
    const elapsed = stepTarget - current.nowMs;
    if (elapsed <= 0) break;

    const atAiDecision = isAiDecisionMs(current, stepTarget);
    const diplomatic = atAiDecision
      ? applyAiDiplomaticDecisions(current, stepTarget)
      : { world: current, events: [] as SimEvent[] };
    const stepWorld = diplomatic.world;
    const orders = atAiDecision ? collectAiOrders(stepWorld, stepTarget) : [];
    const result = tick(stepWorld, orders, elapsed);
    current = result.world;
    allEvents.push(...diplomatic.events, ...result.events);

    incomeAccrued = mergeAccruedIncome(incomeAccrued, result.accrued);
  }

  if (
    incomeAccrued.funding > 0 ||
    hasTerritoryResourceAccrual(incomeAccrued.resourcesByTerritory)
  ) {
    allEvents.push({
      kind: 'income',
      at: current.nowMs,
      funding: incomeAccrued.funding,
      resourcesByTerritory: incomeAccrued.resourcesByTerritory,
      importance: 'low',
    });
  }

  return { world: current, events: allEvents };
}

export { unitPosition } from './position';

/** Preview ETA for a hypothetical move (does not mutate state). */
export function previewMoveEtaMs(
  world: WorldState,
  unitId: Id,
  toTerritoryId: Id,
): { distanceKm: number; speedKmh: number; etaMs: Millis; departMs: Millis; travelMs: Millis } | null {
  const unit = world.units[unitId];
  if (!unit || unit.transit || !unit.locationId) return null;
  if (unit.locationId === toTerritoryId) return null;

  const transit = buildTransit(
    world,
    unit,
    toTerritoryId,
    {
      stanceOnArrival: 'hold',
      intent: 'defend',
      beatId: 'preview',
      decisionTickMs: world.nowMs,
    },
    world.nowMs,
  );
  if (!transit) return null;

  return {
    distanceKm: transit.distanceKm,
    speedKmh: effectiveSpeedKmh(world, unit),
    etaMs: transit.arriveMs,
    departMs: transit.departMs,
    travelMs: transit.arriveMs - transit.departMs,
  };
}

/** Great-circle distance for a hypothetical move. */
export function moveDistanceKm(world: WorldState, unitId: Id, toTerritoryId: Id): number | null {
  const unit = world.units[unitId];
  if (!unit?.locationId || unit.locationId === toTerritoryId) return null;
  const from = world.territories[unit.locationId];
  const to = world.territories[toTerritoryId];
  if (!from || !to) return null;
  return haversineKm(from.coord, to.coord);
}

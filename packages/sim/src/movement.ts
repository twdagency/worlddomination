import { resolveHostileArrival } from './arrivalCombat';
import { DEFAULT_TRAIT, MS_PER_HOUR } from './constants';
import { capTutorialPlayerActionGameMs, isTutorialPlayerFaction } from './tutorial';
import { ensureIntelStore } from './intel';
import { haversineKm } from './geo';
import { arrivalImportance, departureImportance } from './importance';
import type { Id, IntelStore, Millis, Order, OrderIntent, SimEventDraft, TraitKey, TransitOrder, Unit, WorldState } from './types';

type TransitOrderFields = {
  stanceOnArrival: TransitOrder['stanceOnArrival'];
  intent: OrderIntent;
  beatId: string;
  decisionTickMs: Millis;
};

export type AssaultOrderRejectionReason = 'cannot-assault-own-territory';

export function formatOrderRejectedMessage(reason: AssaultOrderRejectionReason | string): string {
  if (reason === 'cannot-assault-own-territory') {
    return 'Cannot issue assault on own territory.';
  }
  return reason;
}

export function validateAssaultOrder(
  world: WorldState,
  order: Extract<Order, { kind: 'move' }>,
): { valid: true } | { valid: false; reason: AssaultOrderRejectionReason } {
  if (order.stanceOnArrival !== 'assault') return { valid: true };

  const unit = world.units[order.unitId];
  const destinationOwner = world.territories[order.toTerritoryId]?.ownerId;
  if (unit && destinationOwner && destinationOwner === unit.ownerId) {
    return { valid: false, reason: 'cannot-assault-own-territory' };
  }
  return { valid: true };
}

function speedTraitKey(unitTypeDomain: string): TraitKey {
  if (unitTypeDomain === 'sea') return 'seaSpeedMult';
  return 'landSpeedMult';
}

/** Effective travel speed (km/h) for a unit given its type and owner's leader traits. */
export function effectiveSpeedKmh(world: WorldState, unit: Unit): number {
  const unitType = world.unitTypes[unit.typeId];
  if (!unitType) return 0;

  const faction = world.factions[unit.ownerId];
  const leader = faction ? world.leaders[faction.leaderId] : undefined;
  const traitKey = speedTraitKey(unitType.domain);
  const mult = leader?.traits[traitKey] ?? DEFAULT_TRAIT;

  return unitType.baseSpeedKmh * mult;
}

export function transitFraction(nowMs: Millis, transit: TransitOrder): number {
  if (nowMs <= transit.departMs) return 0;
  if (nowMs >= transit.arriveMs) return 1;
  return (nowMs - transit.departMs) / (transit.arriveMs - transit.departMs);
}

export function buildTransit(
  world: WorldState,
  unit: Unit,
  toTerritoryId: Id,
  order: TransitOrderFields,
  departMs: Millis,
): TransitOrder | null {
  const fromTerritoryId = unit.locationId;
  if (!fromTerritoryId) return null;

  const from = world.territories[fromTerritoryId];
  const to = world.territories[toTerritoryId];
  if (!from || !to) return null;
  if (fromTerritoryId === toTerritoryId) return null;

  const distanceKm = haversineKm(from.coord, to.coord);
  if (distanceKm <= 0) return null;
  const speed = effectiveSpeedKmh(world, unit);
  if (speed <= 0) return null;

  let travelMs = (distanceKm / speed) * MS_PER_HOUR;
  if (isTutorialPlayerFaction(world, unit.ownerId)) {
    travelMs = capTutorialPlayerActionGameMs(world, travelMs);
  }
  const arriveMs = departMs + travelMs;

  return {
    fromId: fromTerritoryId,
    toCoord: to.coord,
    toTerritoryId,
    departMs,
    arriveMs,
    distanceKm,
    stanceOnArrival: order.stanceOnArrival,
    intent: order.intent,
    beatId: order.beatId,
    decisionTickMs: order.decisionTickMs,
  };
}

/** Preview travel duration for a unit without mutating state. */
export function estimateTravelMs(world: WorldState, unit: Unit, toTerritoryId: Id): number | null {
  const fromTerritoryId = unit.locationId;
  if (!fromTerritoryId) return null;

  const from = world.territories[fromTerritoryId];
  const to = world.territories[toTerritoryId];
  if (!from || !to || fromTerritoryId === toTerritoryId) return null;

  const distanceKm = haversineKm(from.coord, to.coord);
  if (distanceKm <= 0) return null;

  const speed = effectiveSpeedKmh(world, unit);
  if (speed <= 0) return null;

  let travelMs = (distanceKm / speed) * MS_PER_HOUR;
  if (isTutorialPlayerFaction(world, unit.ownerId)) {
    travelMs = capTutorialPlayerActionGameMs(world, travelMs);
  }
  return travelMs;
}

/** Apply move orders at the start of a tick step. Pure — returns new units + departure events. */
export function applyMoveOrders(
  world: WorldState,
  orders: Order[],
): { units: WorldState['units']; events: SimEventDraft[] } {
  const units = { ...world.units };
  const events: SimEventDraft[] = [];

  for (const order of orders) {
    if (order.kind !== 'move') continue;

    const unit = units[order.unitId];
    if (!unit || unit.transit) continue;
    if (unit.locationId === order.toTerritoryId) continue;

    const assaultValidation = validateAssaultOrder(world, order);
    if (!assaultValidation.valid) {
      // Player-facing rejections emit orderRejected (Sprint 7c: no silent failures for player actions).
      if (world.factions[unit.ownerId]?.isPlayer) {
        events.push({
          kind: 'orderRejected',
          at: world.nowMs,
          factionId: unit.ownerId,
          unitId: order.unitId,
          attemptedDestinationId: order.toTerritoryId,
          reason: assaultValidation.reason,
          importance: 'medium',
        });
      }
      continue;
    }

    const moveCount = order.count ?? unit.count;
    if (moveCount <= 0 || moveCount > unit.count) continue;

    let movingUnitId = order.unitId;
    let movingUnit = unit;

    if (moveCount < unit.count) {
      const detachedId = `${order.unitId}-commit-${order.decisionTickMs}`;
      units[order.unitId] = { ...unit, count: unit.count - moveCount };
      movingUnit = {
        ...unit,
        id: detachedId,
        count: moveCount,
      };
      movingUnitId = detachedId;
      units[detachedId] = movingUnit;
    }

    const transit = buildTransit(
      world,
      movingUnit,
      order.toTerritoryId,
      order,
      world.nowMs,
    );
    if (!transit || !movingUnit.locationId) continue;

    const fromTerritoryId = movingUnit.locationId;
    units[movingUnitId] = {
      ...movingUnit,
      locationId: undefined,
      transit,
    };

    events.push({
      kind: 'departure',
      at: world.nowMs,
      unitId: movingUnitId,
      fromTerritoryId,
      toTerritoryId: order.toTerritoryId,
      ownerId: movingUnit.ownerId,
      unitTypeId: movingUnit.typeId,
      count: moveCount,
      stanceOnArrival: order.stanceOnArrival,
      intent: order.intent,
      source: 'direct',
      beatId: order.beatId,
      decisionTickMs: order.decisionTickMs,
      importance: departureImportance(order.intent),
    });
  }

  return { units, events };
}

/** Finalize arrivals for units whose transit ends at or before `nowMs`. Pure. */
export function resolveArrivals(
  world: WorldState,
  nowMs: Millis,
): {
  units: WorldState['units'];
  territories: WorldState['territories'];
  countries?: WorldState['countries'];
  rng: WorldState['rng'];
  intel: IntelStore;
  events: SimEventDraft[];
} {
  let units = { ...world.units };
  let territories = { ...world.territories };
  let countries = world.countries;
  let rng = world.rng;
  let intel = ensureIntelStore(world);
  const events: SimEventDraft[] = [];

  const arriving = Object.entries(units)
    .filter(([, unit]) => unit.transit && nowMs >= unit.transit.arriveMs)
    .sort(([, a], [, b]) => (a.transit!.arriveMs ?? 0) - (b.transit!.arriveMs ?? 0));

  for (const [unitId, unit] of arriving) {
    if (!unit.transit || nowMs < unit.transit.arriveMs) continue;

    const territoryId = unit.transit.toTerritoryId;
    if (!territoryId) continue;

    const at = unit.transit.arriveMs;
    const stanceOnArrival = unit.transit.stanceOnArrival;

    const arrivedUnit: Unit = {
      ...unit,
      locationId: territoryId,
      transit: undefined,
    };

    const resolution = resolveHostileArrival(
      { ...world, units, territories, rng, countries },
      arrivedUnit,
      territoryId,
      at,
      stanceOnArrival,
      unit.transit.fromId,
    );

    units = resolution.units;
    territories = resolution.territories;
    countries = resolution.countries ?? countries;
    rng = resolution.rng;
    intel = resolution.intel;
    const snapshotWorld = { ...world, units, territories, rng, intel };
    events.push(
      {
        kind: 'arrival',
        at,
        unitId,
        territoryId,
        ownerId: unit.ownerId,
        unitTypeId: unit.typeId,
        count: unit.count,
        stanceOnArrival,
        fromTerritoryId: unit.transit.fromId,
        intent: unit.transit.intent,
        source: 'direct',
        beatId: unit.transit.beatId,
        decisionTickMs: unit.transit.decisionTickMs,
        importance: arrivalImportance(
          snapshotWorld,
          unit.ownerId,
          territoryId,
          unit.transit.intent,
        ),
      },
      ...resolution.events,
    );
  }

  return { units, territories, countries, rng, intel, events };
}

/** All pending arrival timestamps strictly after `nowMs`. */
export function pendingArrivalMs(world: WorldState): Millis[] {
  const times: Millis[] = [];
  for (const unit of Object.values(world.units)) {
    if (unit.transit && unit.transit.arriveMs > world.nowMs) {
      times.push(unit.transit.arriveMs);
    }
  }
  return times;
}

import { BASE_SCOUT_RANGE_KM, DEFAULT_TRAIT } from './constants';
import { haversineKm } from './geo';
import { unitPosition } from './position';
import type { Id, Territory, Unit, WorldState } from './types';

export interface FactionVisibility {
  territoryIds: Set<Id>;
  unitIds: Set<Id>;
}

export function scoutRangeKm(world: WorldState, factionId: Id): number {
  const faction = world.factions[factionId];
  const leader = faction ? world.leaders[faction.leaderId] : undefined;
  const mult = leader?.traits.scoutRangeMult ?? DEFAULT_TRAIT;
  return BASE_SCOUT_RANGE_KM * mult;
}

function observerCoords(world: WorldState, factionId: Id): { lat: number; lon: number }[] {
  const coords: { lat: number; lon: number }[] = [];

  for (const territory of Object.values(world.territories)) {
    if (territory.ownerId === factionId) {
      coords.push(territory.coord);
    }
  }

  for (const unit of Object.values(world.units)) {
    if (unit.ownerId !== factionId) continue;
    try {
      coords.push(unitPosition(world, unit.id));
    } catch {
      // unit has no position — skip
    }
  }

  return coords;
}

function withinRange(
  observers: { lat: number; lon: number }[],
  target: { lat: number; lon: number },
  rangeKm: number,
): boolean {
  return observers.some((observer) => haversineKm(observer, target) <= rangeKm);
}

/** Territories and units visible to `factionId` from owned ground and scouting range. */
export function computeVisibility(world: WorldState, factionId: Id): FactionVisibility {
  const rangeKm = scoutRangeKm(world, factionId);
  const observers = observerCoords(world, factionId);
  const territoryIds = new Set<Id>();
  const unitIds = new Set<Id>();

  for (const territory of Object.values(world.territories)) {
    if (territory.ownerId === factionId || withinRange(observers, territory.coord, rangeKm)) {
      territoryIds.add(territory.id);
    }
  }

  for (const unit of Object.values(world.units)) {
    if (unit.ownerId === factionId) {
      unitIds.add(unit.id);
      continue;
    }
    try {
      const coord = unitPosition(world, unit.id);
      if (withinRange(observers, coord, rangeKm)) {
        unitIds.add(unit.id);
      }
    } catch {
      // skip unpositioned units
    }
  }

  return { territoryIds, unitIds };
}

/** @deprecated Use `computeVisibility` — identical behavior, kept for call-site clarity during migration. */
export function getFactionVisibility(world: WorldState, factionId: Id): FactionVisibility {
  return computeVisibility(world, factionId);
}

export function isTerritoryVisible(
  world: WorldState,
  factionId: Id,
  territoryId: Id,
): boolean {
  return computeVisibility(world, factionId).territoryIds.has(territoryId);
}

export function isUnitVisible(world: WorldState, factionId: Id, unitId: Id): boolean {
  return computeVisibility(world, factionId).unitIds.has(unitId);
}

export function visibleEnemyUnits(world: WorldState, factionId: Id): Unit[] {
  const visibility = computeVisibility(world, factionId);
  return Object.values(world.units).filter(
    (unit) => unit.ownerId !== factionId && visibility.unitIds.has(unit.id),
  );
}

export function visibleTerritories(world: WorldState, factionId: Id): Territory[] {
  const visibility = computeVisibility(world, factionId);
  return Object.values(world.territories).filter((territory) =>
    visibility.territoryIds.has(territory.id),
  );
}

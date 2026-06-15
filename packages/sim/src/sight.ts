import { BASE_SCOUT_RANGE_KM, DEFAULT_TRAIT } from './constants';
import { haversineKm } from './geo';
import { unitPosition } from './position';
import { isScoutUnit, SCOUT_UNIT_RANGE_MULT } from './scout';
import type { Id, Unit, WorldState } from './types';

export interface ActiveSight {
  directTerritoryIds: Set<Id>;
  scoutTerritoryIds: Set<Id>;
  /** Union of direct and scout geometric sight — live binary visibility. */
  territoryIds: Set<Id>;
  unitIds: Set<Id>;
}

/** @deprecated Use `ActiveSight` via `activeSight`. */
export interface ActiveDirectSight {
  territoryIds: Set<Id>;
  unitIds: Set<Id>;
}

export function scoutRangeKm(world: WorldState, factionId: Id): number {
  const faction = world.factions[factionId];
  const leader = faction ? world.leaders[faction.leaderId] : undefined;
  const mult = leader?.traits.scoutRangeMult ?? DEFAULT_TRAIT;
  return BASE_SCOUT_RANGE_KM * mult;
}

function scoutUnitRangeKm(world: WorldState, factionId: Id): number {
  return scoutRangeKm(world, factionId) * SCOUT_UNIT_RANGE_MULT;
}

function withinRange(
  observers: { lat: number; lon: number }[],
  target: { lat: number; lon: number },
  rangeKm: number,
): boolean {
  if (observers.length === 0 || rangeKm <= 0) return false;
  return observers.some((observer) => haversineKm(observer, target) <= rangeKm);
}

function observerCoords(world: WorldState, factionId: Id): {
  direct: { lat: number; lon: number }[];
  scout: { lat: number; lon: number }[];
} {
  const direct: { lat: number; lon: number }[] = [];
  const scout: { lat: number; lon: number }[] = [];

  for (const territory of Object.values(world.territories)) {
    if (territory.ownerId === factionId) {
      direct.push(territory.coord);
    }
  }

  for (const unit of Object.values(world.units)) {
    if (unit.ownerId !== factionId) continue;
    try {
      const coord = unitPosition(world, unit.id);
      if (isScoutUnit(world, unit)) scout.push(coord);
      else direct.push(coord);
    } catch {
      // unit has no position — skip
    }
  }

  return { direct, scout };
}

/** Geometric sight from owned ground, standard units, and scout units (extended range). */
export function activeSight(world: WorldState, factionId: Id): ActiveSight {
  const directRangeKm = scoutRangeKm(world, factionId);
  const extendedRangeKm = scoutUnitRangeKm(world, factionId);
  const observers = observerCoords(world, factionId);
  const directTerritoryIds = new Set<Id>();
  const scoutTerritoryIds = new Set<Id>();
  const unitIds = new Set<Id>();

  for (const territory of Object.values(world.territories)) {
    if (territory.ownerId === factionId) {
      directTerritoryIds.add(territory.id);
      continue;
    }
    if (withinRange(observers.direct, territory.coord, directRangeKm)) {
      directTerritoryIds.add(territory.id);
    }
    if (withinRange(observers.scout, territory.coord, extendedRangeKm)) {
      scoutTerritoryIds.add(territory.id);
    }
  }

  const territoryIds = new Set<Id>([...directTerritoryIds, ...scoutTerritoryIds]);

  for (const unit of Object.values(world.units)) {
    if (unit.ownerId === factionId) {
      unitIds.add(unit.id);
      continue;
    }
    try {
      const coord = unitPosition(world, unit.id);
      if (
        withinRange(observers.direct, coord, directRangeKm) ||
        withinRange(observers.scout, coord, extendedRangeKm)
      ) {
        unitIds.add(unit.id);
      }
    } catch {
      // skip unpositioned units
    }
  }

  return { directTerritoryIds, scoutTerritoryIds, territoryIds, unitIds };
}

/** Territories and units visible via direct sight only (owned + standard unit range). */
export function activeDirectSight(world: WorldState, factionId: Id): ActiveDirectSight {
  const sight = activeSight(world, factionId);
  return { territoryIds: sight.directTerritoryIds, unitIds: sight.unitIds };
}

/** Territories observed by a single scout unit from its current position. */
export function territoriesObservedByScoutUnit(
  world: WorldState,
  scoutUnit: Unit,
): { territoryIds: Set<Id>; unitIds: Set<Id> } {
  const factionId = scoutUnit.ownerId;
  const rangeKm = scoutUnitRangeKm(world, factionId);
  const territoryIds = new Set<Id>();
  const unitIds = new Set<Id>();

  let coord;
  try {
    coord = unitPosition(world, scoutUnit.id);
  } catch {
    return { territoryIds, unitIds };
  }

  for (const territory of Object.values(world.territories)) {
    if (haversineKm(coord, territory.coord) <= rangeKm) {
      territoryIds.add(territory.id);
    }
  }

  for (const unit of Object.values(world.units)) {
    if (unit.ownerId === factionId) {
      if (unit.id === scoutUnit.id) unitIds.add(unit.id);
      continue;
    }
    try {
      const unitCoord = unitPosition(world, unit.id);
      if (haversineKm(coord, unitCoord) <= rangeKm) {
        unitIds.add(unit.id);
      }
    } catch {
      // skip
    }
  }

  return { territoryIds, unitIds };
}

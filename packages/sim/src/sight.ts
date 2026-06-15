import { BASE_SCOUT_RANGE_KM, DEFAULT_TRAIT } from './constants';
import { haversineKm } from './geo';
import { unitPosition } from './position';
import type { Id, WorldState } from './types';

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

/** Geometric line-of-sight from owned ground and scouting range — no intel merge. */
export function activeDirectSight(world: WorldState, factionId: Id): ActiveDirectSight {
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

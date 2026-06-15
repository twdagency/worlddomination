import { activeSight, scoutRangeKm } from './sight';
import { mergeAllTerritoryVisibility } from './intel';
import type { Id, Territory, Unit, WorldState } from './types';
import type { TerritoryVisibilityState } from './types';

export { scoutRangeKm } from './sight';

export interface FactionVisibility {
  /** Per-territory live / stale / unknown — full tri-state for Phase 2 UI. */
  territoryStates: Record<Id, TerritoryVisibilityState>;
  /** Live geometric sight only — preserves Sprint 5 binary semantics in Phase 1. */
  territoryIds: Set<Id>;
  unitIds: Set<Id>;
}

/** Territories and units visible to `factionId` via intel merge + active direct sight. */
export function computeVisibility(world: WorldState, factionId: Id): FactionVisibility {
  const sight = activeSight(world, factionId);
  const territoryStates = mergeAllTerritoryVisibility(world, factionId);

  return {
    territoryStates,
    territoryIds: sight.territoryIds,
    unitIds: sight.unitIds,
  };
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

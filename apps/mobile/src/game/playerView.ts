import {
  computeVisibility,
  type FactionVisibility,
  type Territory,
  type Unit,
  type WorldState,
} from 'sim';

export const PLAYER_FACTION_ID = 'faction-player';

/**
 * When true, map/order views show all territories and units (fog off).
 * Gate for cold-read debugging — do not enable in production builds.
 */
export const DEV_REVEAL = false;

function revealAll(world: WorldState): FactionVisibility {
  return {
    territoryIds: new Set(Object.keys(world.territories)),
    unitIds: new Set(Object.keys(world.units)),
  };
}

/** Player fog-of-war — same rules as AI via `computeVisibility`. */
export function playerVisibility(world: WorldState): FactionVisibility {
  if (DEV_REVEAL) {
    return revealAll(world);
  }
  return computeVisibility(world, PLAYER_FACTION_ID);
}

export function playerVisibleTerritories(world: WorldState): Territory[] {
  const { territoryIds } = playerVisibility(world);
  return Object.values(world.territories).filter((territory) =>
    territoryIds.has(territory.id),
  );
}

export function playerOwnedTerritories(world: WorldState): Territory[] {
  return Object.values(world.territories).filter(
    (territory) => territory.ownerId === PLAYER_FACTION_ID,
  );
}

export function playerMovableUnits(world: WorldState): Unit[] {
  const { unitIds } = playerVisibility(world);
  return Object.values(world.units).filter(
    (unit) =>
      unitIds.has(unit.id) &&
      unit.ownerId === PLAYER_FACTION_ID &&
      !unit.transit &&
      unit.locationId,
  );
}

/** All player stacks visible under fog (stationed or in transit). */
export function playerForces(world: WorldState): Unit[] {
  const { unitIds } = playerVisibility(world);
  return Object.values(world.units).filter(
    (unit) => unit.ownerId === PLAYER_FACTION_ID && unitIds.has(unit.id),
  );
}

export function getPlayerVisibleTerritory(
  world: WorldState,
  territoryId: string,
): Territory | undefined {
  const { territoryIds } = playerVisibility(world);
  if (!territoryIds.has(territoryId)) return undefined;
  return world.territories[territoryId];
}

export function getPlayerVisibleTerritoryName(world: WorldState, territoryId: string): string {
  return getPlayerVisibleTerritory(world, territoryId)?.name ?? 'Unknown';
}

/** Move destinations: visible territories excluding the unit's current location. */
export function playerMoveDestinations(world: WorldState, fromTerritoryId: string | undefined): Territory[] {
  if (!fromTerritoryId) return [];
  return playerVisibleTerritories(world).filter((territory) => territory.id !== fromTerritoryId);
}

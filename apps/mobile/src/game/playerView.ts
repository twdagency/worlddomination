import {
  computeVisibility,
  type FactionVisibility,
  type IntelSource,
  type Territory,
  type TerritorySnapshot,
  type TerritoryVisibilityState,
  type Unit,
  type WorldState,
} from 'sim';

export const PLAYER_FACTION_ID = 'faction-player';

/**
 * When true, map/order views show all territories and units (fog off).
 * Bypasses the intel store entirely — every territory renders as live `direct`.
 * Gate for cold-read debugging during UI work; do not enable in production builds.
 */
export const DEV_REVEAL = false;

export interface TerritoryIntelDisplay {
  territoryId: string;
  state: 'live' | 'stale' | 'unknown';
  name: string;
  sources: IntelSource[];
  lastObservedAt?: number;
  snapshot?: TerritorySnapshot;
}

function revealAll(world: WorldState): FactionVisibility {
  const territoryStates: Record<string, TerritoryVisibilityState> = {};
  for (const territory of Object.values(world.territories)) {
    territoryStates[territory.id] = {
      state: 'live',
      snapshot: {
        ownerId: territory.ownerId,
        infraLevel: territory.infraLevel,
        garrisonCount: 0,
        visibleEnemyGarrison: 0,
        inTransitCount: 0,
      },
      sources: ['direct'],
    };
  }
  return {
    territoryStates,
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

function territoryName(world: WorldState, territoryId: string): string {
  return world.territories[territoryId]?.name ?? territoryId;
}

/** Tri-state intel for one territory — primary UI read path in Phase 2+. */
export function getTerritoryIntelDisplay(
  world: WorldState,
  territoryId: string,
): TerritoryIntelDisplay {
  const intel = playerVisibility(world).territoryStates[territoryId] ?? { state: 'unknown' };

  if (intel.state === 'unknown') {
    return { territoryId, state: 'unknown', name: 'Unknown', sources: [] };
  }

  return {
    territoryId,
    state: intel.state,
    name: territoryName(world, territoryId),
    sources: intel.sources,
    lastObservedAt: intel.state === 'stale' ? intel.lastObservedAt : undefined,
    snapshot: intel.snapshot,
  };
}

/** All territories with live / stale / unknown rendering metadata. */
export function playerWorldIntel(world: WorldState): TerritoryIntelDisplay[] {
  return Object.keys(world.territories)
    .sort((a, b) => territoryName(world, a).localeCompare(territoryName(world, b)))
    .map((territoryId) => getTerritoryIntelDisplay(world, territoryId));
}

/** Live geometric sight only — unchanged Sprint 5 semantics. */
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

/** Live sight only — binary fog gate for detail that must reflect current ground truth. */
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

/** Live or stale — for labels where historical knowledge is enough. */
export function getPlayerKnownTerritoryName(world: WorldState, territoryId: string): string {
  return getTerritoryIntelDisplay(world, territoryId).name;
}

/** Owner at observation time for stale destinations; live owner for current sight. */
export function ownerIdForIntelDisplay(
  world: WorldState,
  display: TerritoryIntelDisplay,
): string | undefined {
  if (display.state === 'live') {
    return world.territories[display.territoryId]?.ownerId;
  }
  if (display.state === 'stale') {
    return display.snapshot?.ownerId;
  }
  return undefined;
}

/** Move destinations: live and stale territories; unknown filtered out. */
export function playerOrderDestinations(
  world: WorldState,
  fromTerritoryId: string | undefined,
): TerritoryIntelDisplay[] {
  if (!fromTerritoryId) return [];
  return playerWorldIntel(world).filter(
    (display) => display.territoryId !== fromTerritoryId && display.state !== 'unknown',
  );
}

/** @deprecated Use `playerOrderDestinations` for tri-state move targets. */
export function playerMoveDestinations(world: WorldState, fromTerritoryId: string | undefined): Territory[] {
  return playerOrderDestinations(world, fromTerritoryId)
    .filter((display) => display.state === 'live')
    .map((display) => world.territories[display.territoryId])
    .filter((territory): territory is Territory => territory !== undefined);
}

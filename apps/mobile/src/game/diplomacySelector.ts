import { resolvePlayerFactionId } from 'shared';
import type { Faction, Id, WorldState } from 'sim';

/** Factions shown on the Diplomacy screen — excludes the human player. */
export function diplomacyTargetFactions(world: WorldState): Faction[] {
  const playerId = resolvePlayerFactionId(world);
  return Object.values(world.factions).filter((faction) => faction.id !== playerId);
}

export function diplomacyTargetFactionIds(world: WorldState): Id[] {
  return diplomacyTargetFactions(world).map((faction) => faction.id);
}

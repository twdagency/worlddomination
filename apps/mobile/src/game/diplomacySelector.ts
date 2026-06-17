import { resolvePlayerFactionId } from 'shared';
import type { Faction, Id, WorldState } from 'sim';
import { selectDiplomacyTargets } from './countrySelector';

/** Factions shown on the Diplomacy screen — excludes the human player and defeated countries. */
export function diplomacyTargetFactions(world: WorldState): Faction[] {
  const activeIds = new Set(selectDiplomacyTargets(world).map((country) => country.id));
  return Object.values(world.factions).filter((faction) => activeIds.has(faction.id));
}

export function diplomacyTargetFactionIds(world: WorldState): Id[] {
  return diplomacyTargetFactions(world).map((faction) => faction.id);
}

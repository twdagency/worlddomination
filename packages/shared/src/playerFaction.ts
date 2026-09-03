import type { Id, WorldState } from 'sim';

/** Human-controlled country for the active scenario (tutorial or sandbox). */
export function resolvePlayerCountryId(world: WorldState): Id | undefined {
  const source = world.countries ?? world.factions;
  if (!source) return undefined;
  return Object.values(source).find((country) => country.isPlayer)?.id;
}

/**
 * @deprecated Use `resolvePlayerCountryId` instead.
 */
export function resolvePlayerFactionId(world: WorldState): Id | undefined {
  return resolvePlayerCountryId(world);
}

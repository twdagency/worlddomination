import type { WorldState } from './types';

/** Tutorial uses deterministic AI; skip influence-aware military scoring. */
export function isInfluenceAgencyDisabled(world: WorldState): boolean {
  return world.scenarioId?.startsWith('tutorial') ?? false;
}

export function resolvePlayerFactionId(world: WorldState): string | undefined {
  return Object.values(world.factions).find((faction) => faction.isPlayer)?.id;
}

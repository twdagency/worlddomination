import type { WorldState } from './types';

/** Tutorial uses deterministic AI; skip influence-aware military scoring. */
export function isInfluenceAgencyDisabled(world: WorldState): boolean {
  return world.scenarioId?.startsWith('tutorial') ?? false;
}

/** When false, AI skips accelerator and threshold influence orders (player-mechanics isolation). */
export function isAiInfluenceAgencyActive(world: WorldState): boolean {
  if (isInfluenceAgencyDisabled(world)) return false;
  if (world.aiInfluenceAgencySuppressed) return false;
  return true;
}

export function resolvePlayerFactionId(world: WorldState): string | undefined {
  return Object.values(world.factions).find((faction) => faction.isPlayer)?.id;
}

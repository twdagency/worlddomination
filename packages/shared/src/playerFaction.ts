import type { Id, WorldState } from 'sim';

/** Human-controlled faction for the active scenario (tutorial or sandbox). */
export function resolvePlayerFactionId(world: WorldState): Id | undefined {
  return Object.values(world.factions).find((faction) => faction.isPlayer)?.id;
}

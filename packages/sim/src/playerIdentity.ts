import type { Id, WorldState } from './types';

export function playerFactionId(world: WorldState): Id | undefined {
  return Object.values(world.factions).find((faction) => faction.isPlayer)?.id;
}

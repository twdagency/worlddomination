import { resolvePlayerFactionId } from 'shared';
import type { Id, WorldState } from 'sim';

/** Human-controlled faction for the active scenario (tutorial or sandbox). */
export function playerFactionIdFor(world: WorldState): Id | undefined {
  return resolvePlayerFactionId(world);
}

export function requirePlayerFactionId(world: WorldState): Id {
  const id = resolvePlayerFactionId(world);
  if (!id) {
    throw new Error('No player faction in world');
  }
  return id;
}

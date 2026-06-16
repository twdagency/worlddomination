import { areAllied, type Id, type WorldState } from 'sim';

export type DestinationStance = 'friendly' | 'neutral' | 'allied' | 'hostile';

export { formatDestinationRowTitle } from './territoryOwnerLabel';

export function classifyDestination(
  world: WorldState,
  playerId: Id | undefined,
  territoryId: string,
  ownerId?: string,
): DestinationStance {
  if (!playerId) return 'neutral';

  const owner = ownerId ?? world.territories[territoryId]?.ownerId;
  if (!owner) return 'neutral';
  if (owner === playerId) return 'friendly';
  if (areAllied(world, playerId, owner)) return 'allied';
  return 'hostile';
}

import { areAllied, type Id, type TransitOrder, type WorldState } from 'sim';

export type DestinationStance = 'friendly' | 'neutral' | 'allied' | 'hostile';

export interface OrderDestinationIntel {
  territoryId: Id;
  state: 'live' | 'stale' | 'unknown';
  snapshot?: { ownerId?: Id };
}

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

/** Assault stance cannot target player-owned territories; other stances may. */
export function filterOrderDestinationsForStance<T extends OrderDestinationIntel>(
  world: WorldState,
  playerId: Id | undefined,
  stance: TransitOrder['stanceOnArrival'],
  destinations: readonly T[],
): T[] {
  if (!playerId || stance !== 'assault') return [...destinations];

  return destinations.filter((display) => {
    const ownerId =
      display.state === 'live'
        ? world.territories[display.territoryId]?.ownerId
        : display.snapshot?.ownerId;
    return ownerId !== playerId;
  });
}

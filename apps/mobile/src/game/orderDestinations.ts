import { areAllied, type Id, type WorldState } from 'sim';

export type DestinationStance = 'friendly' | 'neutral' | 'allied' | 'hostile';

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

export function formatDestinationRowTitle(
  territoryName: string,
  stance: DestinationStance,
  ownerCountryName?: string,
  ownerLeaderName?: string,
  recommended?: boolean,
): string {
  let title = territoryName;
  if (ownerCountryName) title += ` (${ownerCountryName})`;
  if (recommended) title += ' · Suggested';
  if (stance === 'hostile' || stance === 'allied') {
    title += ` · ${stance.toUpperCase()}`;
    if (ownerLeaderName) title += ` · ${ownerLeaderName}`;
  } else if (stance === 'neutral') {
    title += ' · NEUTRAL';
    if (ownerLeaderName) title += ` · ${ownerLeaderName}`;
  }
  return title;
}

import { areAllied, getActiveTreaties } from './diplomacy';
import { pendingProposalsForFaction } from './pendingProposals';
import type { Id, Millis, WorldState } from './types';

export type DiplomaticRelationshipStatus =
  | 'allied'
  | 'treaty-active'
  | 'proposal-incoming'
  | 'neutral';

export function diplomaticRelationshipStatus(
  world: WorldState,
  viewerId: Id,
  otherId: Id,
  atMs: Millis = world.nowMs,
): DiplomaticRelationshipStatus {
  if (viewerId === otherId) return 'neutral';
  if (areAllied(world, viewerId, otherId)) return 'allied';

  const treaties = getActiveTreaties(world, viewerId, atMs).filter(
    (treaty) => treaty.parties[0] === otherId || treaty.parties[1] === otherId,
  );
  if (treaties.length > 0) return 'treaty-active';

  const incoming = pendingProposalsForFaction(world, viewerId).some(
    (proposal) => proposal.from === otherId && proposal.type === 'alliance',
  );
  if (incoming) return 'proposal-incoming';

  return 'neutral';
}

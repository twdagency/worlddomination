import { AI_DECISION_INTERVAL_MS } from './constants';
import type { Id, Millis, PendingProposal, PendingProposalType, WorldState } from './types';

export function deterministicProposalId(
  from: Id,
  to: Id,
  proposedAt: Millis,
  type: PendingProposalType,
  territoryId?: Id,
): Id {
  const scope = territoryId ?? '';
  const input = `${from}:${to}:${proposedAt}:${type}:${scope}`;
  let hash = 2_166_136_261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 1_677_761_9);
  }
  return `proposal-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function proposalExpiresAt(proposedAt: Millis): Millis {
  return proposedAt + AI_DECISION_INTERVAL_MS;
}

export function sortPendingProposals(proposals: PendingProposal[]): PendingProposal[] {
  return [...proposals].sort((left, right) => left.id.localeCompare(right.id));
}

export function hasPendingProposalBetween(
  world: WorldState,
  from: Id,
  to: Id,
  type: PendingProposalType,
): boolean {
  return world.pendingProposals.some(
    (proposal) => proposal.from === from && proposal.to === to && proposal.type === type,
  );
}

export function addPendingProposal(
  world: WorldState,
  proposal: PendingProposal,
): WorldState {
  if (world.pendingProposals.some((existing) => existing.id === proposal.id)) {
    return world;
  }
  return {
    ...world,
    pendingProposals: sortPendingProposals([...world.pendingProposals, proposal]),
  };
}

export function removePendingProposal(world: WorldState, proposalId: Id): WorldState {
  const next = world.pendingProposals.filter((proposal) => proposal.id !== proposalId);
  if (next.length === world.pendingProposals.length) return world;
  return { ...world, pendingProposals: next };
}

export function findPendingProposal(
  world: WorldState,
  proposalId: Id,
): PendingProposal | undefined {
  return world.pendingProposals.find((proposal) => proposal.id === proposalId);
}

export function pendingProposalsForFaction(world: WorldState, factionId: Id): PendingProposal[] {
  return world.pendingProposals.filter((proposal) => proposal.to === factionId);
}

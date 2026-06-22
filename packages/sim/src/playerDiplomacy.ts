import {
  areAllied,
  breakAlliance,
  formAlliance,
  formTreaty,
  hasActiveTreatyOn,
} from './diplomacy';
import {
  allianceBrokenEvent,
  allianceDeclinedEvent,
  allianceFormedEvent,
  allianceProposedEvent,
  DEFAULT_TREATY_DURATION_MS,
  treatyDeclinedEvent,
  treatyFormedEvent,
} from './diplomaticDispatch';
import {
  ALLIANCE_ACCEPT_THRESHOLD,
  scoreAllianceAcceptance,
  scoreTreatyAcceptance,
  TREATY_ACCEPT_THRESHOLD,
} from './diplomaticAi';
import {
  addPendingProposal,
  deterministicProposalId,
  findPendingProposal,
  hasPendingProposalBetween,
  proposalExpiresAt,
  removePendingProposal,
} from './pendingProposals';
import type { Id, Millis, PendingProposal, SimEvent, SimEventDraft, WorldState } from './types';
import { stampEvents } from './events';

export { DEFAULT_TREATY_DURATION_MS } from './diplomaticDispatch';

function withEvents(world: WorldState, events: SimEventDraft[]): { world: WorldState; events: SimEvent[] } {
  return stampEvents(world, events);
}

function assertPlayerFaction(world: WorldState, factionId: Id): void {
  if (!world.factions[factionId]?.isPlayer) {
    throw new Error(`Expected player faction: ${factionId}`);
  }
}

/** Expire unanswered proposals — implicit decline at expiry boundary. */
export function expirePendingProposals(
  world: WorldState,
  atMs: Millis,
): { world: WorldState; events: SimEvent[] } {
  let current = world;
  const events: SimEventDraft[] = [];

  for (const proposal of world.pendingProposals) {
    if (proposal.expiresAt > atMs) continue;
    current = removePendingProposal(current, proposal.id);
    if (proposal.type === 'alliance') {
      events.push(allianceDeclinedEvent(proposal.from, proposal.to, proposal.to, atMs));
    } else {
      events.push(
        treatyDeclinedEvent(
          proposal.from,
          proposal.to,
          proposal.to,
          atMs,
          proposal.scope?.territoryIds,
        ),
      );
    }
  }

  return withEvents(current, events);
}

/**
 * Player proposes alliance — unconditional on player posture.
 * AI target evaluates via scoreAllianceAcceptance only.
 */
export function playerProposeAlliance(
  world: WorldState,
  playerId: Id,
  targetId: Id,
  atMs: Millis = world.nowMs,
): { world: WorldState; events: SimEvent[] } {
  assertPlayerFaction(world, playerId);
  if (playerId === targetId || areAllied(world, playerId, targetId)) {
    return { world, events: [] };
  }
  if (hasPendingProposalBetween(world, playerId, targetId, 'alliance')) {
    return { world, events: [] };
  }

  const acceptanceScore = scoreAllianceAcceptance(world, targetId, playerId);
  if (acceptanceScore >= ALLIANCE_ACCEPT_THRESHOLD) {
    const formed = formAlliance(world, playerId, targetId, atMs);
    return withEvents(formed.world, [
      ...formed.events,
      allianceFormedEvent(playerId, targetId, atMs, playerId),
    ]);
  }

  return withEvents(world, [allianceDeclinedEvent(playerId, targetId, targetId, atMs)]);
}

/** Player breaks alliance — reputation penalties via breakAlliance; no AI break heuristic. */
export function playerBreakAlliance(
  world: WorldState,
  playerId: Id,
  allyId: Id,
  atMs: Millis = world.nowMs,
): { world: WorldState; events: SimEvent[] } {
  assertPlayerFaction(world, playerId);
  if (!areAllied(world, playerId, allyId)) return { world, events: [] };

  return withEvents(breakAlliance(world, playerId, allyId), [
    allianceBrokenEvent(playerId, allyId, atMs),
  ]);
}

/**
 * Player proposes single-territory treaty — unconditional on player posture.
 * AI evaluates via scoreTreatyAcceptance (lower bar than alliances).
 */
export function playerProposeTreaty(
  world: WorldState,
  playerId: Id,
  targetId: Id,
  territoryId: Id,
  atMs: Millis = world.nowMs,
  durationMs: Millis = DEFAULT_TREATY_DURATION_MS,
): { world: WorldState; events: SimEvent[] } {
  assertPlayerFaction(world, playerId);
  if (playerId === targetId) return { world, events: [] };
  if (hasPendingProposalBetween(world, playerId, targetId, 'treaty')) {
    return { world, events: [] };
  }
  if (hasActiveTreatyOn(world, playerId, targetId, territoryId, atMs)) {
    return { world, events: [] };
  }

  const acceptanceScore = scoreTreatyAcceptance(world, targetId, playerId, territoryId);
  if (acceptanceScore >= TREATY_ACCEPT_THRESHOLD) {
    const next = formTreaty(world, {
      partyA: playerId,
      partyB: targetId,
      territoryIds: [territoryId],
      formedAt: atMs,
      expiresAt: atMs + durationMs,
    });
    const treaty = next.treaties.find(
      (row) =>
        (row.parties[0] === playerId || row.parties[1] === playerId) &&
        row.scope.territoryIds.includes(territoryId),
    );
    if (!treaty) return { world, events: [] };
    return withEvents(next, [treatyFormedEvent(treaty, atMs, playerId)]);
  }

  return withEvents(world, [
    treatyDeclinedEvent(playerId, targetId, targetId, atMs, [territoryId]),
  ]);
}

export function playerAcceptProposal(
  world: WorldState,
  playerId: Id,
  proposalId: Id,
  atMs: Millis = world.nowMs,
): { world: WorldState; events: SimEvent[] } {
  assertPlayerFaction(world, playerId);
  const proposal = findPendingProposal(world, proposalId);
  if (!proposal || proposal.to !== playerId) return { world, events: [] };

  let next = removePendingProposal(world, proposalId);
  const events: SimEventDraft[] = [];

  if (proposal.type === 'alliance') {
    const formed = formAlliance(next, proposal.from, proposal.to, atMs);
    next = formed.world;
    events.push(...formed.events, allianceFormedEvent(proposal.from, proposal.to, atMs, proposal.from));
  } else {
    const territoryIds = proposal.scope?.territoryIds ?? [];
    if (territoryIds.length !== 1) return { world, events: [] };
    const territoryId = territoryIds[0]!;
    if (hasActiveTreatyOn(next, proposal.from, proposal.to, territoryId, atMs)) {
      return withEvents(next, []);
    }
    const durationMs = proposal.durationMs ?? DEFAULT_TREATY_DURATION_MS;
    const beforeIds = new Set(next.treaties.map((treaty) => treaty.id));
    next = formTreaty(next, {
      partyA: proposal.from,
      partyB: proposal.to,
      territoryIds,
      formedAt: atMs,
      expiresAt: atMs + durationMs,
    });
    const formed = next.treaties.find((treaty) => !beforeIds.has(treaty.id));
    if (formed) {
      events.push(treatyFormedEvent(formed, atMs, proposal.from));
    }
  }

  return withEvents(next, events);
}

export function playerDeclineProposal(
  world: WorldState,
  playerId: Id,
  proposalId: Id,
  atMs: Millis = world.nowMs,
): { world: WorldState; events: SimEvent[] } {
  assertPlayerFaction(world, playerId);
  const proposal = findPendingProposal(world, proposalId);
  if (!proposal || proposal.to !== playerId) return { world, events: [] };

  const next = removePendingProposal(world, proposalId);
  if (proposal.type === 'alliance') {
    return withEvents(next, [
      allianceDeclinedEvent(proposal.from, proposal.to, playerId, atMs),
    ]);
  }
  return withEvents(next, [
    treatyDeclinedEvent(
      proposal.from,
      proposal.to,
      playerId,
      atMs,
      proposal.scope?.territoryIds,
    ),
  ]);
}

/** Queue an AI → player alliance proposal (used by diplomaticAi). */
export function queueAllianceProposal(
  world: WorldState,
  from: Id,
  to: Id,
  atMs: Millis,
): { world: WorldState; events: SimEvent[]; proposal: PendingProposal } {
  const proposalId = deterministicProposalId(from, to, atMs, 'alliance');
  const proposal: PendingProposal = {
    id: proposalId,
    from,
    to,
    type: 'alliance',
    proposedAt: atMs,
    expiresAt: proposalExpiresAt(atMs),
  };
  const stamped = stampEvents(world, [
    allianceProposedEvent(proposalId, from, to, atMs, proposal.expiresAt),
  ]);
  return {
    world: addPendingProposal(stamped.world, proposal),
    events: stamped.events,
    proposal,
  };
}

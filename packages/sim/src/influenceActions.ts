import { areAllied, formAlliance, formTreaty, getAlliancesFor } from './diplomacy';
import {
  allianceFormedEvent,
  DEFAULT_TREATY_DURATION_MS,
  treatyFormedEvent,
} from './diplomaticDispatch';
import { applyInfluenceDelta, ensureWorldInfluence, getInfluence } from './influence';
import { removePendingProposal } from './pendingProposals';
import type {
  Id,
  Millis,
  PendingProposal,
  PendingProposalType,
  PressureProposalKind,
  Reputation,
  SimEventDraft,
  WorldState,
} from './types';

export const DIPLOMATIC_PRESSURE_COST = 2000;
export const DIPLOMATIC_PRESSURE_INFLUENCE_COST = 20;
export const DIPLOMATIC_PRESSURE_MIN_INFLUENCE = 30;
export const DIPLOMATIC_PRESSURE_TARGET_REPUTATION_PENALTY = -15;
export const DIPLOMATIC_PRESSURE_OBSERVER_REPUTATION_PENALTY = -5;
export const DIPLOMATIC_PRESSURE_ALLY_OF_TARGET_REPUTATION_PENALTY = -10;

export type DiplomaticPressureRejectionReason =
  | 'insufficient-influence'
  | 'insufficient-gold'
  | 'no-pending-proposal'
  | 'unsupported-proposal-kind'
  | 'target-is-allied'
  | 'target-owner-defeated'
  | 'target-city-unknown'
  | 'target-country-mismatch';

const SUPPORTED_PROPOSAL_KINDS = new Set<PressureProposalKind>([
  'accept-alliance',
  'accept-treaty',
]);

function pendingProposalType(proposalKind: PressureProposalKind): PendingProposalType | null {
  switch (proposalKind) {
    case 'accept-alliance':
      return 'alliance';
    case 'accept-treaty':
      return 'treaty';
    default:
      return null;
  }
}

export function findPendingProposalForPressure(
  world: WorldState,
  actorId: Id,
  targetCountryId: Id,
  proposalKind: PressureProposalKind,
): PendingProposal | undefined {
  const type = pendingProposalType(proposalKind);
  if (!type) return undefined;
  return world.pendingProposals
    .filter(
      (proposal) =>
        proposal.from === actorId && proposal.to === targetCountryId && proposal.type === type,
    )
    .sort((left, right) => left.id.localeCompare(right.id))[0];
}

function isOwnerDefeated(world: WorldState, ownerId: Id | undefined): boolean {
  if (!ownerId) return true;
  return world.countries?.[ownerId]?.defeated === true;
}

export function validateDiplomaticPressure(
  world: WorldState,
  actorId: Id,
  targetCityId: Id,
  targetCountryId: Id,
  proposalKind: PressureProposalKind,
): { ok: true } | { ok: false; reason: DiplomaticPressureRejectionReason } {
  if (!SUPPORTED_PROPOSAL_KINDS.has(proposalKind)) {
    return { ok: false, reason: 'unsupported-proposal-kind' };
  }

  const city = world.territories[targetCityId];
  if (!city?.ownerId) return { ok: false, reason: 'target-city-unknown' };
  if (city.ownerId !== targetCountryId) return { ok: false, reason: 'target-country-mismatch' };
  if (areAllied(world, actorId, targetCountryId)) return { ok: false, reason: 'target-is-allied' };
  if (isOwnerDefeated(world, targetCountryId)) return { ok: false, reason: 'target-owner-defeated' };

  const influence = getInfluence(world, targetCityId, actorId);
  if (influence < DIPLOMATIC_PRESSURE_MIN_INFLUENCE) {
    return { ok: false, reason: 'insufficient-influence' };
  }

  const faction = world.factions[actorId];
  if (!faction || faction.funding < DIPLOMATIC_PRESSURE_COST) {
    return { ok: false, reason: 'insufficient-gold' };
  }

  if (!findPendingProposalForPressure(world, actorId, targetCountryId, proposalKind)) {
    return { ok: false, reason: 'no-pending-proposal' };
  }

  return { ok: true };
}

function deductGold(world: WorldState, factionId: Id, amount: number): WorldState {
  const faction = world.factions[factionId];
  if (!faction) return world;
  return {
    ...world,
    factions: {
      ...world.factions,
      [factionId]: { ...faction, funding: faction.funding - amount },
    },
  };
}

function applyDiplomaticPressureReputation(
  world: WorldState,
  actorId: Id,
  targetCountryId: Id,
): { world: WorldState; reputationDeltas: Record<Id, number> } {
  const reputationDeltas: Record<Id, number> = {};
  const reputation: Reputation = {};
  const targetAllies = new Set(getAlliancesFor(world, targetCountryId));

  for (const observer of Object.keys(world.reputation).sort()) {
    reputation[observer] = { ...world.reputation[observer] };
  }

  const applyDelta = (observer: Id, delta: number) => {
    if (observer === actorId) return;
    const row = reputation[observer];
    if (!row) return;
    row[actorId] = (row[actorId] ?? 0) + delta;
    reputationDeltas[observer] = (reputationDeltas[observer] ?? 0) + delta;
  };

  applyDelta(targetCountryId, DIPLOMATIC_PRESSURE_TARGET_REPUTATION_PENALTY);

  for (const observer of Object.keys(world.factions).sort()) {
    if (observer === actorId || observer === targetCountryId) continue;
    applyDelta(observer, DIPLOMATIC_PRESSURE_OBSERVER_REPUTATION_PENALTY);
    if (targetAllies.has(observer)) {
      applyDelta(observer, DIPLOMATIC_PRESSURE_ALLY_OF_TARGET_REPUTATION_PENALTY);
    }
  }

  return { world: { ...world, reputation }, reputationDeltas };
}

function forceAcceptPendingProposal(
  world: WorldState,
  proposal: PendingProposal,
  at: Millis,
): { world: WorldState; events: SimEventDraft[] } {
  let next = removePendingProposal(world, proposal.id);
  const events: SimEventDraft[] = [];

  if (proposal.type === 'alliance') {
    const formed = formAlliance(next, proposal.from, proposal.to, at);
    next = formed.world;
    events.push(...formed.events, allianceFormedEvent(proposal.from, proposal.to, at, proposal.from));
    return { world: next, events };
  }

  const territoryIds = proposal.scope?.territoryIds ?? [];
  if (territoryIds.length !== 1) {
    return { world, events: [] };
  }

  const durationMs = proposal.durationMs ?? DEFAULT_TREATY_DURATION_MS;
  const beforeIds = new Set(next.treaties.map((treaty) => treaty.id));
  next = formTreaty(next, {
    partyA: proposal.from,
    partyB: proposal.to,
    territoryIds,
    formedAt: at,
    expiresAt: at + durationMs,
  });
  const formed = next.treaties.find((treaty) => !beforeIds.has(treaty.id));
  if (formed) {
    events.push(treatyFormedEvent(formed, at, proposal.from));
  }

  return { world: next, events };
}

export function applyDiplomaticPressure(
  world: WorldState,
  actorId: Id,
  targetCityId: Id,
  targetCountryId: Id,
  proposalKind: PressureProposalKind,
  at: Millis,
): { world: WorldState; events: SimEventDraft[] } {
  const validation = validateDiplomaticPressure(
    world,
    actorId,
    targetCityId,
    targetCountryId,
    proposalKind,
  );
  if (!validation.ok) {
    return { world, events: [] };
  }

  const proposal = findPendingProposalForPressure(world, actorId, targetCountryId, proposalKind)!;
  let next = ensureWorldInfluence(world);
  next = deductGold(next, actorId, DIPLOMATIC_PRESSURE_COST);
  next = applyInfluenceDelta(
    next,
    targetCityId,
    actorId,
    -DIPLOMATIC_PRESSURE_INFLUENCE_COST,
    at,
  );

  const accepted = forceAcceptPendingProposal(next, proposal, at);
  next = accepted.world;

  const reputationResult = applyDiplomaticPressureReputation(next, actorId, targetCountryId);
  next = reputationResult.world;

  const events: SimEventDraft[] = [
    {
      kind: 'diplomaticPressureApplied',
      at,
      actorId,
      targetCityId,
      targetCountryId,
      proposalKind,
      influenceCost: DIPLOMATIC_PRESSURE_INFLUENCE_COST,
      goldCost: DIPLOMATIC_PRESSURE_COST,
      reputationDeltas: reputationResult.reputationDeltas,
      importance: 'high',
    },
    ...accepted.events,
  ];

  return { world: next, events };
}

export function formatDiplomaticPressureProposalLabel(proposalKind: PressureProposalKind): string {
  switch (proposalKind) {
    case 'accept-alliance':
      return 'alliance';
    case 'accept-treaty':
      return 'treaty';
    case 'concession-territory':
      return 'territory concession';
    case 'concession-resource':
      return 'resource concession';
  }
}

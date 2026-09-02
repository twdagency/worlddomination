import { areAllied, formAlliance, formTreaty, getAlliancesFor, hasActiveTreatyOn } from './diplomacy';
import { MS_PER_DAY, MS_PER_HOUR } from './constants';
import { findCountry } from './country';
import {
  allianceFormedEvent,
  DEFAULT_TREATY_DURATION_MS,
  treatyFormedEvent,
} from './diplomaticEvents';
import { captureCityForCoup } from './territoryOwnership';
import { extractionPerHour, incomePerHour } from './economy';
import {
  applyInfluenceDelta,
  clearInfluenceForCity,
  ensureWorldInfluence,
  ensureWorldTributes,
  getInfluence,
  setInfluence,
} from './influence';
import { intelligenceGarrisonCount } from './intelligenceGather';
import { removePendingProposal } from './pendingProposals';
import { nextRandom } from './rng';
import type {
  ActiveTribute,
  DiplomaticPosture,
  Id,
  Millis,
  PendingProposal,
  PendingProposalType,
  PressureProposalKind,
  Reputation,
  ResourceId,
  RngState,
  SimEventDraft,
  Territory,
  TributeAutoEndReason,
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
  | 'target-country-mismatch'
  | 'active-treaty-exists';

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

  if (proposalKind === 'accept-treaty') {
    const proposal = findPendingProposalForPressure(
      world,
      actorId,
      targetCountryId,
      proposalKind,
    );
    const territoryId = proposal?.scope?.territoryIds?.[0];
    if (
      territoryId &&
      hasActiveTreatyOn(world, actorId, targetCountryId, territoryId, world.nowMs)
    ) {
      return { ok: false, reason: 'active-treaty-exists' };
    }
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

  const territoryId = territoryIds[0]!;
  if (hasActiveTreatyOn(world, proposal.from, proposal.to, territoryId, at)) {
    return { world: next, events: [] };
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

export { cancelTributesForDefeatedCountry } from './tributeLifecycle';
export { formatDiplomaticPressureProposalLabel } from './influenceOrderMessages';

export const TRIBUTE_EXTRACTION_COST = 5000;
export const TRIBUTE_INFLUENCE_FLOOR = 50;
export const TRIBUTE_INFLUENCE_DRAIN_PER_DAY = 1;
export const TRIBUTE_GOLD_PERCENT = 0.25;
export const TRIBUTE_RESOURCE_PERCENT = 0.15;
export const TRIBUTE_RESENTMENT_MINOR_REBELLION = 40;
export const TRIBUTE_RESENTMENT_MAJOR_REBELLION = 80;
export const TRIBUTE_RESENTMENT_GROWTH_PER_DAY = 2;
export const TRIBUTE_MAJOR_REBELLION_TARGET_REPUTATION_PENALTY = -25;
export const TRIBUTE_MAJOR_REBELLION_OBSERVER_REPUTATION_PENALTY = -10;
const TRIBUTE_ACCRUAL_RESOURCES: ResourceId[] = ['food'];

export type TributeRejectionReason =
  | 'insufficient-influence'
  | 'insufficient-gold'
  | 'tribute-already-active'
  | 'no-active-tribute'
  | 'target-is-allied'
  | 'target-owner-defeated'
  | 'target-city-unknown'
  | 'target-is-own-city';

export function findActiveTribute(
  world: WorldState,
  actorId: Id,
  targetCityId: Id,
): ActiveTribute | undefined {
  return (world.activeTributes ?? []).find(
    (tribute) => tribute.actorId === actorId && tribute.targetCityId === targetCityId,
  );
}

function sortedActiveTributes(world: WorldState): ActiveTribute[] {
  return [...(world.activeTributes ?? [])].sort((left, right) => {
    const cityCmp = left.targetCityId.localeCompare(right.targetCityId);
    if (cityCmp !== 0) return cityCmp;
    return left.actorId.localeCompare(right.actorId);
  });
}

function leaderIncomeMult(world: WorldState, factionId: Id): number {
  const faction = world.factions[factionId];
  const leader = faction ? world.leaders[faction.leaderId] : undefined;
  return leader?.traits.incomeMult ?? 1;
}

function validateTributeTarget(
  world: WorldState,
  actorId: Id,
  targetCityId: Id,
): { ok: true; ownerId: Id } | { ok: false; reason: TributeRejectionReason } {
  const city = world.territories[targetCityId];
  if (!city?.ownerId) return { ok: false, reason: 'target-city-unknown' };
  if (city.ownerId === actorId) return { ok: false, reason: 'target-is-own-city' };
  if (areAllied(world, actorId, city.ownerId)) return { ok: false, reason: 'target-is-allied' };
  if (isOwnerDefeated(world, city.ownerId)) return { ok: false, reason: 'target-owner-defeated' };
  return { ok: true, ownerId: city.ownerId };
}

export function validateTributeExtraction(
  world: WorldState,
  actorId: Id,
  targetCityId: Id,
): { ok: true; targetCountryId: Id } | { ok: false; reason: TributeRejectionReason } {
  const targetCheck = validateTributeTarget(world, actorId, targetCityId);
  if (!targetCheck.ok) return targetCheck;

  if (findActiveTribute(world, actorId, targetCityId)) {
    return { ok: false, reason: 'tribute-already-active' };
  }

  const influence = getInfluence(world, targetCityId, actorId);
  if (influence < TRIBUTE_INFLUENCE_FLOOR) {
    return { ok: false, reason: 'insufficient-influence' };
  }

  const faction = world.factions[actorId];
  if (!faction || faction.funding < TRIBUTE_EXTRACTION_COST) {
    return { ok: false, reason: 'insufficient-gold' };
  }

  return { ok: true, targetCountryId: targetCheck.ownerId };
}

export function validateTributeCancel(
  world: WorldState,
  actorId: Id,
  targetCityId: Id,
): { ok: true } | { ok: false; reason: TributeRejectionReason } {
  if (!findActiveTribute(world, actorId, targetCityId)) {
    return { ok: false, reason: 'no-active-tribute' };
  }
  return { ok: true };
}

function addFactionResource(
  world: WorldState,
  factionId: Id,
  resourceId: ResourceId,
  amount: number,
): WorldState {
  if (amount <= 0) return world;
  const faction = world.factions[factionId];
  if (!faction) return world;
  const resources = { ...(faction.resources ?? {}) };
  resources[resourceId] = (resources[resourceId] ?? 0) + amount;
  return {
    ...world,
    factions: {
      ...world.factions,
      [factionId]: { ...faction, resources },
    },
  };
}

function transferFactionGold(
  world: WorldState,
  fromFactionId: Id,
  toFactionId: Id,
  amount: number,
): WorldState {
  if (amount <= 0) return world;
  const from = world.factions[fromFactionId];
  const to = world.factions[toFactionId];
  if (!from || !to) return world;
  const transfer = Math.min(amount, Math.max(0, from.funding));
  if (transfer <= 0) return world;
  return {
    ...world,
    factions: {
      ...world.factions,
      [fromFactionId]: { ...from, funding: from.funding - transfer },
      [toFactionId]: { ...to, funding: to.funding + transfer },
    },
  };
}

function deductTerritoryResource(
  world: WorldState,
  territoryId: Id,
  resourceId: ResourceId,
  amount: number,
): { world: WorldState; transferred: number } {
  if (amount <= 0) return { world, transferred: 0 };
  const territory = world.territories[territoryId];
  if (!territory) return { world, transferred: 0 };
  const available = territory.resources[resourceId] ?? 0;
  const transferred = Math.min(amount, available);
  if (transferred <= 0) return { world, transferred: 0 };
  const resources = { ...territory.resources };
  const nextAmount = available - transferred;
  if (nextAmount <= 0) {
    delete resources[resourceId];
  } else {
    resources[resourceId] = nextAmount;
  }
  return {
    world: {
      ...world,
      territories: {
        ...world.territories,
        [territoryId]: { ...territory, resources },
      },
    },
    transferred,
  };
}

function applyMajorRebellionReputation(
  world: WorldState,
  actorId: Id,
  targetCountryId: Id,
): { world: WorldState; reputationDeltas: Record<Id, number> } {
  const reputationDeltas: Record<Id, number> = {};
  const reputation: Reputation = {};

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

  applyDelta(targetCountryId, TRIBUTE_MAJOR_REBELLION_TARGET_REPUTATION_PENALTY);
  for (const observer of Object.keys(world.factions).sort()) {
    if (observer === actorId || observer === targetCountryId) continue;
    applyDelta(observer, TRIBUTE_MAJOR_REBELLION_OBSERVER_REPUTATION_PENALTY);
  }

  return { world: { ...world, reputation }, reputationDeltas };
}

function removeActiveTribute(world: WorldState, actorId: Id, targetCityId: Id): WorldState {
  return {
    ...world,
    activeTributes: (world.activeTributes ?? []).filter(
      (tribute) => !(tribute.actorId === actorId && tribute.targetCityId === targetCityId),
    ),
  };
}

function resolveTributeAutoEndReason(
  world: WorldState,
  tribute: ActiveTribute,
): TributeAutoEndReason | null {
  if (isOwnerDefeated(world, tribute.targetCountryId)) return 'target-defeated';
  const ownerId = world.territories[tribute.targetCityId]?.ownerId;
  if (!ownerId || ownerId !== tribute.targetCountryId) return 'ownership-changed';
  if (areAllied(world, tribute.actorId, tribute.targetCountryId)) return 'alliance-formed';
  if (getInfluence(world, tribute.targetCityId, tribute.actorId) < TRIBUTE_INFLUENCE_FLOOR) {
    return 'influence-floor';
  }
  return null;
}

export function applyTributeExtraction(
  world: WorldState,
  actorId: Id,
  targetCityId: Id,
  at: Millis,
): { world: WorldState; events: SimEventDraft[] } {
  const validation = validateTributeExtraction(world, actorId, targetCityId);
  if (!validation.ok) return { world, events: [] };

  let next = ensureWorldTributes(ensureWorldInfluence(world));
  next = deductGold(next, actorId, TRIBUTE_EXTRACTION_COST);
  const tribute: ActiveTribute = {
    actorId,
    targetCityId,
    targetCountryId: validation.targetCountryId,
    startedAt: at,
    lastAccrualAt: at,
    resentment: 0,
    minorRebellionEmitted: false,
    totalGoldExtracted: 0,
    totalResourceExtracted: {},
  };
  next = {
    ...next,
    activeTributes: [...(next.activeTributes ?? []), tribute],
  };

  return {
    world: next,
    events: [
      {
        kind: 'tributeStarted',
        at,
        actorId,
        targetCityId,
        targetCountryId: validation.targetCountryId,
        importance: 'high',
      },
    ],
  };
}

export function applyTributeCancel(
  world: WorldState,
  actorId: Id,
  targetCityId: Id,
  at: Millis,
): { world: WorldState; events: SimEventDraft[] } {
  const validation = validateTributeCancel(world, actorId, targetCityId);
  if (!validation.ok) return { world, events: [] };

  const next = removeActiveTribute(ensureWorldTributes(world), actorId, targetCityId);
  return {
    world: next,
    events: [
      {
        kind: 'tributeVoluntarilyEnded',
        at,
        actorId,
        targetCityId,
        importance: 'medium',
      },
    ],
  };
}

export function accrueTributes(
  world: WorldState,
  at: Millis,
): { world: WorldState; events: SimEventDraft[] } {
  let next = ensureWorldTributes(ensureWorldInfluence(world));
  const events: SimEventDraft[] = [];
  const remaining: ActiveTribute[] = [];

  for (const tribute of sortedActiveTributes(next)) {
    const autoEndBefore = resolveTributeAutoEndReason(next, tribute);
    if (autoEndBefore && autoEndBefore !== 'influence-floor') {
      events.push({
        kind: 'tributeAutoEnded',
        at,
        actorId: tribute.actorId,
        targetCityId: tribute.targetCityId,
        reason: autoEndBefore,
        importance: 'medium',
      });
      continue;
    }

    const elapsedMs = Math.max(0, at - tribute.lastAccrualAt);
    if (elapsedMs === 0) {
      remaining.push(tribute);
      continue;
    }

    const daysElapsed = elapsedMs / MS_PER_DAY;
    const territory = next.territories[tribute.targetCityId];
    if (!territory) {
      events.push({
        kind: 'tributeAutoEnded',
        at,
        actorId: tribute.actorId,
        targetCityId: tribute.targetCityId,
        reason: 'ownership-changed',
        importance: 'medium',
      });
      continue;
    }

    const incomeMult = leaderIncomeMult(next, tribute.targetCountryId);
    const dailyGoldIncome = incomePerHour(territory, incomeMult) * (MS_PER_DAY / MS_PER_HOUR);
    const goldTransfer = dailyGoldIncome * TRIBUTE_GOLD_PERCENT * daysElapsed;
    if (goldTransfer > 0) {
      next = transferFactionGold(next, tribute.targetCountryId, tribute.actorId, goldTransfer);
    }

    const resourcesTransferred: Partial<Record<ResourceId, number>> = {};
    for (const resourceId of TRIBUTE_ACCRUAL_RESOURCES) {
      const dailyProduction =
        extractionPerHour(territory, resourceId) * (MS_PER_DAY / MS_PER_HOUR);
      const requested = dailyProduction * TRIBUTE_RESOURCE_PERCENT * daysElapsed;
      if (requested <= 0) continue;
      const deducted = deductTerritoryResource(next, tribute.targetCityId, resourceId, requested);
      next = deducted.world;
      if (deducted.transferred > 0) {
        next = addFactionResource(next, tribute.actorId, resourceId, deducted.transferred);
        resourcesTransferred[resourceId] = deducted.transferred;
      }
    }

    next = applyInfluenceDelta(
      next,
      tribute.targetCityId,
      tribute.actorId,
      -TRIBUTE_INFLUENCE_DRAIN_PER_DAY * daysElapsed,
      at,
    );

    const resentment = Math.min(
      100,
      tribute.resentment + TRIBUTE_RESENTMENT_GROWTH_PER_DAY * daysElapsed,
    );
    const minorRebellionEmitted = tribute.minorRebellionEmitted;
    let updatedTribute: ActiveTribute = {
      ...tribute,
      lastAccrualAt: at,
      resentment,
      minorRebellionEmitted,
      totalGoldExtracted: tribute.totalGoldExtracted + goldTransfer,
      totalResourceExtracted: { ...tribute.totalResourceExtracted },
    };

    for (const [resourceId, amount] of Object.entries(resourcesTransferred)) {
      const key = resourceId as ResourceId;
      updatedTribute.totalResourceExtracted[key] =
        (updatedTribute.totalResourceExtracted[key] ?? 0) + amount;
    }

    if (goldTransfer > 0 || Object.keys(resourcesTransferred).length > 0) {
      events.push({
        kind: 'tributeAccrued',
        at,
        actorId: tribute.actorId,
        targetCityId: tribute.targetCityId,
        goldTransferred: goldTransfer,
        resourcesTransferred,
        importance: 'low',
      });
    }

    if (!minorRebellionEmitted && resentment >= TRIBUTE_RESENTMENT_MINOR_REBELLION) {
      events.push({
        kind: 'tributeMinorRebellion',
        at,
        actorId: tribute.actorId,
        targetCityId: tribute.targetCityId,
        importance: 'high',
      });
      updatedTribute = { ...updatedTribute, minorRebellionEmitted: true };
    }

    if (resentment >= TRIBUTE_RESENTMENT_MAJOR_REBELLION) {
      const reputationResult = applyMajorRebellionReputation(
        next,
        tribute.actorId,
        tribute.targetCountryId,
      );
      next = reputationResult.world;
      next = setInfluence(next, tribute.targetCityId, tribute.actorId, 0, at);
      events.push({
        kind: 'tributeMajorRebellion',
        at,
        actorId: tribute.actorId,
        targetCityId: tribute.targetCityId,
        targetCountryId: tribute.targetCountryId,
        reputationDeltas: reputationResult.reputationDeltas,
        importance: 'high',
      });
      continue;
    }

    const autoEndAfter = resolveTributeAutoEndReason(next, updatedTribute);
    if (autoEndAfter) {
      events.push({
        kind: 'tributeAutoEnded',
        at,
        actorId: tribute.actorId,
        targetCityId: tribute.targetCityId,
        reason: autoEndAfter,
        importance: 'medium',
      });
      continue;
    }

    remaining.push(updatedTribute);
  }

  return { world: { ...next, activeTributes: remaining }, events };
}

export const COUP_ATTEMPT_GOLD_COST = 8000;
export const COUP_ATTEMPT_MANPOWER_COST = 1;
export const COUP_INFLUENCE_FLOOR = 70;
export const COUP_INFLUENCE_COST_SUCCESS = 50;
export const COUP_INFLUENCE_COST_FAILURE = 70;
export const COUP_BASE_SUCCESS_RATE = 0.6;
export const COUP_FORTIFICATION_PENALTY_PER_TIER = -0.05;
export const COUP_LOYAL_POSTURE_PENALTY = -0.1;
export const COUP_OPPORTUNIST_POSTURE_BONUS = 0.1;
export const COUP_ALLIED_INSIDER_BONUS = 0.15;
export const COUP_SUCCESS_TARGET_REPUTATION_PENALTY = -30;
export const COUP_FAILURE_TARGET_REPUTATION_PENALTY = -20;
export const COUP_INTEL_WEAK_GARRISON_THRESHOLD = 10;
export const COUP_INTEL_WEAK_GARRISON_BONUS = 0.2;
export const COUP_INTEL_STRONG_GARRISON_THRESHOLD = 40;
export const COUP_INTEL_STRONG_GARRISON_PENALTY = -0.5;

export type CoupRejectionReason =
  | 'insufficient-influence'
  | 'insufficient-gold'
  | 'insufficient-manpower'
  | 'target-is-allied'
  | 'target-owner-defeated'
  | 'target-city-unknown'
  | 'target-is-own-city';

type TerritoryWithFortification = Territory & { fortificationLevel?: number };

function fortificationLevel(territory: Territory): number {
  return (territory as TerritoryWithFortification).fortificationLevel ?? 0;
}

function deductManpower(world: WorldState, factionId: Id, amount: number): WorldState {
  const faction = world.factions[factionId];
  if (!faction) return world;
  return {
    ...world,
    factions: {
      ...world.factions,
      [factionId]: { ...faction, manpower: faction.manpower - amount },
    },
  };
}

function validateCoupTarget(
  world: WorldState,
  actorId: Id,
  targetCityId: Id,
): { ok: true; ownerId: Id } | { ok: false; reason: CoupRejectionReason } {
  const city = world.territories[targetCityId];
  if (!city?.ownerId) return { ok: false, reason: 'target-city-unknown' };
  if (city.ownerId === actorId) return { ok: false, reason: 'target-is-own-city' };
  if (areAllied(world, actorId, city.ownerId)) return { ok: false, reason: 'target-is-allied' };
  if (isOwnerDefeated(world, city.ownerId)) return { ok: false, reason: 'target-owner-defeated' };
  return { ok: true, ownerId: city.ownerId };
}

export function validateCoupAttempt(
  world: WorldState,
  actorId: Id,
  targetCityId: Id,
): { ok: true; targetCountryId: Id } | { ok: false; reason: CoupRejectionReason } {
  const targetCheck = validateCoupTarget(world, actorId, targetCityId);
  if (!targetCheck.ok) return targetCheck;

  if (getInfluence(world, targetCityId, actorId) < COUP_INFLUENCE_FLOOR) {
    return { ok: false, reason: 'insufficient-influence' };
  }

  const faction = world.factions[actorId];
  if (!faction || faction.funding < COUP_ATTEMPT_GOLD_COST) {
    return { ok: false, reason: 'insufficient-gold' };
  }
  if (faction.manpower < COUP_ATTEMPT_MANPOWER_COST) {
    return { ok: false, reason: 'insufficient-manpower' };
  }

  return { ok: true, targetCountryId: targetCheck.ownerId };
}

export function calculateCoupSuccessRate(
  world: WorldState,
  actorId: Id,
  targetCityId: Id,
  at: Millis = world.nowMs,
): number {
  const city = world.territories[targetCityId];
  if (!city?.ownerId) return 0;

  const targetCountry = findCountry(world, city.ownerId);
  if (!targetCountry) return 0;

  let rate = COUP_BASE_SUCCESS_RATE;
  rate += fortificationLevel(city) * COUP_FORTIFICATION_PENALTY_PER_TIER;

  const posture: DiplomaticPosture | undefined =
    world.leaders[targetCountry.leaderId]?.weights.diplomaticPosture;
  if (posture === 'loyal') rate += COUP_LOYAL_POSTURE_PENALTY;
  if (posture === 'opportunist') rate += COUP_OPPORTUNIST_POSTURE_BONUS;
  if (areAllied(world, actorId, targetCountry.id)) rate += COUP_ALLIED_INSIDER_BONUS;

  const garrison = intelligenceGarrisonCount(world, actorId, targetCityId, at);
  if (garrison !== undefined) {
    if (garrison <= COUP_INTEL_WEAK_GARRISON_THRESHOLD) {
      rate += COUP_INTEL_WEAK_GARRISON_BONUS;
    } else if (garrison >= COUP_INTEL_STRONG_GARRISON_THRESHOLD) {
      rate += COUP_INTEL_STRONG_GARRISON_PENALTY;
    }
  }

  return Math.max(0, Math.min(1, rate));
}

export function rollCoupOutcome(
  rng: RngState,
  successRate: number,
): { success: boolean; rollValue: number; rng: RngState } {
  const roll = nextRandom(rng);
  return {
    success: roll.value < successRate,
    rollValue: roll.value,
    rng: roll.state,
  };
}

function applyCoupFailureReputation(
  world: WorldState,
  actorId: Id,
  targetCountryId: Id,
): { world: WorldState; reputationDeltas: Record<Id, number> } {
  const reputationDeltas: Record<Id, number> = {};
  const reputation: Reputation = {};

  for (const observer of Object.keys(world.reputation).sort()) {
    reputation[observer] = { ...world.reputation[observer] };
  }

  const row = reputation[targetCountryId];
  if (row) {
    row[actorId] = (row[actorId] ?? 0) + COUP_FAILURE_TARGET_REPUTATION_PENALTY;
    reputationDeltas[targetCountryId] = COUP_FAILURE_TARGET_REPUTATION_PENALTY;
  }

  return { world: { ...world, reputation }, reputationDeltas };
}

function applyCoupSuccessReputation(
  world: WorldState,
  actorId: Id,
  targetCountryId: Id,
): { world: WorldState; reputationDeltas: Record<Id, number> } {
  const reputationDeltas: Record<Id, number> = {};
  const reputation: Reputation = {};

  for (const observer of Object.keys(world.reputation).sort()) {
    reputation[observer] = { ...world.reputation[observer] };
  }

  const row = reputation[targetCountryId];
  if (row) {
    row[actorId] = (row[actorId] ?? 0) + COUP_SUCCESS_TARGET_REPUTATION_PENALTY;
    reputationDeltas[targetCountryId] = COUP_SUCCESS_TARGET_REPUTATION_PENALTY;
  }

  return { world: { ...world, reputation }, reputationDeltas };
}

function cancelTributesOnCity(
  world: WorldState,
  targetCityId: Id,
  at: Millis,
  reason: TributeAutoEndReason,
): { world: WorldState; events: SimEventDraft[] } {
  const events: SimEventDraft[] = [];
  const remaining: ActiveTribute[] = [];

  for (const tribute of world.activeTributes ?? []) {
    if (tribute.targetCityId === targetCityId) {
      events.push({
        kind: 'tributeAutoEnded',
        at,
        actorId: tribute.actorId,
        targetCityId,
        reason,
        importance: 'medium',
      });
      continue;
    }
    remaining.push(tribute);
  }

  if (events.length === 0) return { world, events };
  return { world: { ...world, activeTributes: remaining }, events };
}

function applyCoupSuccessInfluence(
  world: WorldState,
  targetCityId: Id,
  actorId: Id,
  at: Millis,
): WorldState {
  const prior = getInfluence(world, targetCityId, actorId);
  const next = clearInfluenceForCity(world, targetCityId);
  return setInfluence(next, targetCityId, actorId, prior - COUP_INFLUENCE_COST_SUCCESS, at);
}

export function applyCoupAttempt(
  world: WorldState,
  actorId: Id,
  targetCityId: Id,
  at: Millis,
): { world: WorldState; events: SimEventDraft[] } {
  const validation = validateCoupAttempt(world, actorId, targetCityId);
  if (!validation.ok) return { world, events: [] };

  const targetCountryId = validation.targetCountryId;
  const targetCountry = findCountry(world, targetCountryId);
  if (!targetCountry) return { world, events: [] };

  const priorInfluence = getInfluence(world, targetCityId, actorId);
  const successRate = calculateCoupSuccessRate(world, actorId, targetCityId);
  const roll = rollCoupOutcome(world.rng, successRate);

  let next = ensureWorldTributes(ensureWorldInfluence(world));
  next = deductGold(next, actorId, COUP_ATTEMPT_GOLD_COST);
  next = deductManpower(next, actorId, COUP_ATTEMPT_MANPOWER_COST);
  next = { ...next, rng: roll.rng };

  if (roll.success) {
    const captured = captureCityForCoup(next, targetCityId, actorId, targetCountryId, at);
    next = captured.world;
    next = applyCoupSuccessInfluence(next, targetCityId, actorId, at);
    const tributeCleanup = cancelTributesOnCity(next, targetCityId, at, 'ownership-changed');
    next = tributeCleanup.world;
    const reputationResult = applyCoupSuccessReputation(next, actorId, targetCountryId);
    next = reputationResult.world;

    return {
      world: next,
      events: [
        {
          kind: 'coupSuccess',
          at,
          actorId,
          targetCityId,
          targetCountryId,
          previousLeaderId: targetCountry.leaderId,
          successRate,
          rollValue: roll.rollValue,
          importance: 'high',
        },
        ...captured.events,
        ...tributeCleanup.events,
      ],
    };
  }

  next = setInfluence(next, targetCityId, actorId, 0, at);
  const reputationResult = applyCoupFailureReputation(next, actorId, targetCountryId);
  next = reputationResult.world;

  return {
    world: next,
    events: [
      {
        kind: 'coupFailure',
        at,
        actorId,
        targetCityId,
        targetCountryId,
        successRate,
        rollValue: roll.rollValue,
        influenceLost: priorInfluence,
        importance: 'high',
      },
    ],
  };
}

export const DEFECTION_INFLUENCE_REQUIRED = 100;
export const DEFECTION_INFLUENCE_COST = 100;
export const DEFECTION_GOLD_COST = 0;
export const DEFECTION_MANPOWER_COST = 0;
export const DEFECTION_TARGET_REPUTATION_PENALTY = -25;

export type DefectionRejectionReason =
  | 'insufficient-influence'
  | 'target-is-allied'
  | 'target-owner-defeated'
  | 'target-city-unknown'
  | 'target-is-own-city';

export function validateDefectionClaim(
  world: WorldState,
  actorId: Id,
  targetCityId: Id,
): { ok: true; targetCountryId: Id } | { ok: false; reason: DefectionRejectionReason } {
  const targetCheck = validateCoupTarget(world, actorId, targetCityId);
  if (!targetCheck.ok) {
    return {
      ok: false,
      reason: targetCheck.reason as DefectionRejectionReason,
    };
  }

  if (getInfluence(world, targetCityId, actorId) < DEFECTION_INFLUENCE_REQUIRED) {
    return { ok: false, reason: 'insufficient-influence' };
  }

  return { ok: true, targetCountryId: targetCheck.ownerId };
}

function applyDefectionReputation(
  world: WorldState,
  actorId: Id,
  targetCountryId: Id,
): WorldState {
  const reputation: Reputation = {};

  for (const observer of Object.keys(world.reputation).sort()) {
    reputation[observer] = { ...world.reputation[observer] };
  }

  const row = reputation[targetCountryId];
  if (row) {
    row[actorId] = (row[actorId] ?? 0) + DEFECTION_TARGET_REPUTATION_PENALTY;
  }

  return { ...world, reputation };
}

export function applyDefectionClaim(
  world: WorldState,
  actorId: Id,
  targetCityId: Id,
  at: Millis,
): { world: WorldState; events: SimEventDraft[] } {
  const validation = validateDefectionClaim(world, actorId, targetCityId);
  if (!validation.ok) return { world, events: [] };

  const targetCountryId = validation.targetCountryId;
  const targetCountry = findCountry(world, targetCountryId);
  if (!targetCountry) return { world, events: [] };

  let next = ensureWorldTributes(ensureWorldInfluence(world));
  const captured = captureCityForCoup(next, targetCityId, actorId, targetCountryId, at);
  next = captured.world;
  next = clearInfluenceForCity(next, targetCityId);
  const tributeCleanup = cancelTributesOnCity(next, targetCityId, at, 'ownership-changed');
  next = tributeCleanup.world;
  next = applyDefectionReputation(next, actorId, targetCountryId);

  return {
    world: next,
    events: [
      {
        kind: 'defectionOccurred',
        at,
        actorId,
        targetCityId,
        targetCountryId,
        previousLeaderId: targetCountry.leaderId,
        importance: 'high',
      },
      ...captured.events,
      ...tributeCleanup.events,
    ],
  };
}

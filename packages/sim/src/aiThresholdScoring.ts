import { resolvePlayerFactionId } from './aiInfluenceAgency';
import { affordsAccelerator, leaderPosture, isolationistShouldAct } from './aiInfluenceScoring';
import { areAllied } from './diplomacy';
import { findCountry } from './country';
import {
  calculateCoupSuccessRate,
  COUP_ATTEMPT_GOLD_COST,
  COUP_ATTEMPT_MANPOWER_COST,
  COUP_INFLUENCE_FLOOR,
  DEFECTION_INFLUENCE_REQUIRED,
  DIPLOMATIC_PRESSURE_COST,
  DIPLOMATIC_PRESSURE_MIN_INFLUENCE,
  findPendingProposalForPressure,
  TRIBUTE_EXTRACTION_COST,
  TRIBUTE_INFLUENCE_FLOOR,
  validateCoupAttempt,
  validateDefectionClaim,
  validateDiplomaticPressure,
  validateTributeExtraction,
} from './influenceActions';
import { getInfluence } from './influence';
import { validateInfluenceTarget } from './influenceOrderValidation';
import type {
  DiplomaticPosture,
  Id,
  InfluenceActionKind,
  Millis,
  PressureProposalKind,
  WorldState,
} from './types';
import type { ScoreRationale } from './aiInfluenceScoring';

export type AiThresholdKind = Extract<
  InfluenceActionKind,
  'diplomatic-pressure' | 'tribute-extraction' | 'coup-attempt' | 'defection-claim'
>;

export interface AiThresholdCandidate {
  targetCityId: Id;
  action: AiThresholdKind;
  targetCountryId?: Id;
  proposalKind?: PressureProposalKind;
}

export interface ScoredAiThresholdAction {
  candidate: AiThresholdCandidate;
  score: number;
  rationale: ScoreRationale;
}

const THRESHOLD_COSTS: Record<AiThresholdKind, number> = {
  'diplomatic-pressure': DIPLOMATIC_PRESSURE_COST,
  'tribute-extraction': TRIBUTE_EXTRACTION_COST,
  'coup-attempt': COUP_ATTEMPT_GOLD_COST,
  'defection-claim': 0,
};

const PRESSURE_PROPOSAL_KINDS: PressureProposalKind[] = ['accept-alliance', 'accept-treaty'];

function isPlayerCapital(world: WorldState, cityId: Id): boolean {
  const playerId = resolvePlayerFactionId(world);
  if (!playerId) return false;
  return findCountry(world, playerId)?.capitalTerritoryId === cityId;
}

function affordsThresholdAction(
  world: WorldState,
  actorId: Id,
  action: AiThresholdKind,
  posture: DiplomaticPosture,
): boolean {
  const cost = THRESHOLD_COSTS[action];
  if (!affordsAccelerator(world, actorId, cost, posture)) return false;
  if (action === 'coup-attempt') {
    const manpower = world.factions[actorId]?.manpower ?? 0;
    return manpower >= COUP_ATTEMPT_MANPOWER_COST;
  }
  return true;
}

function postureThresholdModifier(
  posture: DiplomaticPosture,
  action: AiThresholdKind,
  targetIsPlayerCapital: boolean,
): number {
  if (posture === 'opportunist') {
    if (action === 'coup-attempt') return targetIsPlayerCapital ? 1.5 : 0.8;
    if (action === 'defection-claim') return targetIsPlayerCapital ? 1.0 : 0.5;
    if (action === 'tribute-extraction') return 0.3;
    return -0.3;
  }
  if (posture === 'loyal') {
    if (action === 'diplomatic-pressure') return 1.2;
    if (action === 'tribute-extraction') return 0.8;
    if (action === 'coup-attempt') return -3.0;
    return 0.1;
  }
  if (action === 'diplomatic-pressure') return 0.4;
  if (action === 'coup-attempt' || action === 'defection-claim') return -0.6;
  return 0.2;
}

function thresholdFloorSignal(influence: number, floor: number): number {
  if (influence < floor) return -Infinity;
  if (influence >= floor + 10) return 1.2;
  return 0.8 + (influence - floor) / floor;
}

export function listAiThresholdCandidates(world: WorldState, actorId: Id): AiThresholdCandidate[] {
  const candidates: AiThresholdCandidate[] = [];

  for (const proposalKind of PRESSURE_PROPOSAL_KINDS) {
    const targets = new Set<Id>();
    for (const proposal of world.pendingProposals) {
      if (proposal.from !== actorId) continue;
      const type = proposalKind === 'accept-alliance' ? 'alliance' : 'treaty';
      if (proposal.type !== type) continue;
      targets.add(proposal.to);
    }
    for (const targetCountryId of [...targets].sort()) {
      for (const territory of Object.values(world.territories)) {
        if (territory.ownerId !== targetCountryId) continue;
        if (areAllied(world, actorId, targetCountryId)) continue;
        candidates.push({
          targetCityId: territory.id,
          action: 'diplomatic-pressure',
          targetCountryId,
          proposalKind,
        });
      }
    }
  }

  for (const territory of Object.values(world.territories)) {
    if (!territory.ownerId || territory.ownerId === actorId) continue;
    if (areAllied(world, actorId, territory.ownerId)) continue;
    if (world.countries?.[territory.ownerId]?.defeated) continue;
    if (!validateInfluenceTarget(world, actorId, territory.id).ok) continue;

    candidates.push({ targetCityId: territory.id, action: 'tribute-extraction' });
    candidates.push({ targetCityId: territory.id, action: 'coup-attempt' });
    candidates.push({ targetCityId: territory.id, action: 'defection-claim' });
  }

  return candidates.sort((left, right) => {
    const key = (candidate: AiThresholdCandidate) =>
      `${candidate.action}:${candidate.targetCityId}:${candidate.targetCountryId ?? ''}:${candidate.proposalKind ?? ''}`;
    return key(left).localeCompare(key(right));
  });
}

export function scoreAiThresholdAction(
  world: WorldState,
  actorId: Id,
  candidate: AiThresholdCandidate,
  at: Millis,
): ScoredAiThresholdAction {
  const signals: Record<string, number> = {};
  const posture = leaderPosture(world, actorId);
  const { targetCityId, action } = candidate;

  if (posture === 'isolationist' && !isolationistShouldAct(world, actorId)) {
    return { candidate, score: -Infinity, rationale: { signals: { isolationistDormant: -1 } } };
  }
  if (posture === 'isolationist' && (action === 'coup-attempt' || action === 'defection-claim')) {
    return { candidate, score: -Infinity, rationale: { signals: { isolationistDefensiveOnly: -1 } } };
  }

  if (!affordsThresholdAction(world, actorId, action, posture)) {
    return { candidate, score: -Infinity, rationale: { signals: { insufficientReserve: -1 } } };
  }

  const city = world.territories[targetCityId];
  if (!city?.ownerId) {
    return { candidate, score: -Infinity, rationale: { signals: { invalidTarget: -1 } } };
  }

  const influence = getInfluence(world, targetCityId, actorId);
  const playerCapital = isPlayerCapital(world, targetCityId);

  if (action === 'diplomatic-pressure') {
    const targetCountryId = candidate.targetCountryId;
    const proposalKind = candidate.proposalKind;
    if (!targetCountryId || !proposalKind) {
      return { candidate, score: -Infinity, rationale: { signals: { invalidPressure: -1 } } };
    }
    const validation = validateDiplomaticPressure(
      world,
      actorId,
      targetCityId,
      targetCountryId,
      proposalKind,
    );
    if (!validation.ok) {
      return { candidate, score: -Infinity, rationale: { signals: { invalidPressure: -1 } } };
    }
    if (!findPendingProposalForPressure(world, actorId, targetCountryId, proposalKind)) {
      return { candidate, score: -Infinity, rationale: { signals: { noProposal: -1 } } };
    }
    signals.thresholdFloor = thresholdFloorSignal(influence, DIPLOMATIC_PRESSURE_MIN_INFLUENCE);
    signals.strategicValue = city.infraLevel * 0.3;
    signals.posture = postureThresholdModifier(posture, action, playerCapital);
  } else if (action === 'tribute-extraction') {
    const validation = validateTributeExtraction(world, actorId, targetCityId);
    if (!validation.ok) {
      return { candidate, score: -Infinity, rationale: { signals: { invalidTribute: -1 } } };
    }
    signals.thresholdFloor = thresholdFloorSignal(influence, TRIBUTE_INFLUENCE_FLOOR);
    signals.strategicValue = city.infraLevel * 0.5;
    signals.posture = postureThresholdModifier(posture, action, playerCapital);
  } else if (action === 'coup-attempt') {
    const validation = validateCoupAttempt(world, actorId, targetCityId);
    if (!validation.ok) {
      return { candidate, score: -Infinity, rationale: { signals: { invalidCoup: -1 } } };
    }
    signals.thresholdFloor = thresholdFloorSignal(influence, COUP_INFLUENCE_FLOOR);
    signals.strategicValue = city.infraLevel * 0.6;
    signals.playerCapital = playerCapital ? 2.0 : 0;
    signals.coupSuccessRate = calculateCoupSuccessRate(world, actorId, targetCityId, at) * 2;
    signals.posture = postureThresholdModifier(posture, action, playerCapital);
  } else {
    const validation = validateDefectionClaim(world, actorId, targetCityId);
    if (!validation.ok) {
      return { candidate, score: -Infinity, rationale: { signals: { invalidDefection: -1 } } };
    }
    signals.thresholdFloor = thresholdFloorSignal(influence, DEFECTION_INFLUENCE_REQUIRED);
    signals.strategicValue = city.infraLevel * 0.7;
    signals.playerCapital = playerCapital ? 2.0 : 0;
    signals.defectionReady = influence >= DEFECTION_INFLUENCE_REQUIRED ? 1.5 : 0;
    signals.posture = postureThresholdModifier(posture, action, playerCapital);
  }

  const score = Object.values(signals).reduce((sum, value) => sum + value, 0);
  return { candidate, score, rationale: { signals } };
}

export function pickBestAiThresholdAction(
  world: WorldState,
  actorId: Id,
  at: Millis,
): ScoredAiThresholdAction | null {
  let best: ScoredAiThresholdAction | null = null;

  for (const candidate of listAiThresholdCandidates(world, actorId)) {
    const scored = scoreAiThresholdAction(world, actorId, candidate, at);
    if (scored.score < 0 || !Number.isFinite(scored.score)) continue;
    if (!best || scored.score > best.score) best = scored;
  }

  return best;
}

import { MS_PER_DAY } from './constants';
import { resolvePlayerFactionId } from './aiInfluenceAgency';
import { affordsAccelerator, goldReserveFraction, leaderPosture } from './aiInfluenceScoring';
import {
  COUP_INFLUENCE_FLOOR,
  calculateCoupSuccessRate,
  DIPLOMATIC_PRESSURE_MIN_INFLUENCE,
} from './influenceActions';
import { getInfluence } from './influence';
import { validateInfluenceTarget } from './influenceOrderValidation';
import {
  hasFreshIntelligence,
  INTELLIGENCE_GATHER_COST,
  INTELLIGENCE_MIN_INFLUENCE,
  isIntelligenceOnCooldown,
  latestIntelligenceRecord,
  validateGatherIntelligence,
} from './intelligenceGather';
import { areAllied } from './diplomacy';
import type { Id, Millis, WorldState } from './types';
import type { ScoreRationale } from './aiInfluenceScoring';

export const AI_INTELLIGENCE_MIN_SCORE = 1.0;

export interface ScoredAiIntelligenceAction {
  targetCityId: Id;
  score: number;
  rationale: ScoreRationale;
}

function isPlayerCapital(world: WorldState, cityId: Id): boolean {
  const playerId = resolvePlayerFactionId(world);
  if (!playerId) return false;
  return world.countries?.[playerId]?.capitalTerritoryId === cityId;
}

function listForeignTargetCities(world: WorldState, actorId: Id): Id[] {
  return Object.values(world.territories)
    .filter((territory) => {
      if (!territory.ownerId || territory.ownerId === actorId) return false;
      if (areAllied(world, actorId, territory.ownerId)) return false;
      if (world.countries?.[territory.ownerId]?.defeated) return false;
      return validateInfluenceTarget(world, actorId, territory.id).ok;
    })
    .map((territory) => territory.id)
    .sort((a, b) => a.localeCompare(b));
}

export function scoreAiIntelligenceAction(
  world: WorldState,
  actorId: Id,
  targetCityId: Id,
  at: Millis,
): ScoredAiIntelligenceAction {
  const signals: Record<string, number> = {};
  const posture = leaderPosture(world, actorId);

  const validation = validateGatherIntelligence(world, actorId, targetCityId, at);
  if (!validation.ok) {
    if (validation.reason === 'intelligence-fresh') {
      return { targetCityId, score: -Infinity, rationale: { signals: { freshIntel: -1 } } };
    }
    return { targetCityId, score: -Infinity, rationale: { signals: { invalid: -1 } } };
  }

  if (!affordsAccelerator(world, actorId, INTELLIGENCE_GATHER_COST, posture)) {
    return { targetCityId, score: -Infinity, rationale: { signals: { insufficientReserve: -1 } } };
  }

  const influence = getInfluence(world, targetCityId, actorId);
  const playerCapital = isPlayerCapital(world, targetCityId);
  const city = world.territories[targetCityId]!;

  signals.foothold = influence >= INTELLIGENCE_MIN_INFLUENCE ? 0.6 : -Infinity;
  signals.coupCandidate =
    influence >= COUP_INFLUENCE_FLOOR - 5 ? 1.0 : influence >= DIPLOMATIC_PRESSURE_MIN_INFLUENCE ? 0.4 : 0;
  signals.playerCapital = playerCapital ? 1.2 : 0;
  signals.strategicValue = city.infraLevel * 0.3;

  const existing = latestIntelligenceRecord(world, actorId, targetCityId, at);
  if (!existing) {
    signals.intelGap = 1.0;
  } else if (at - existing.observationTime > MS_PER_DAY) {
    signals.intelGap = 0.5;
  } else {
    signals.intelGap = -Infinity;
  }

  const blindCoupRate = calculateCoupSuccessRate(
    stripIntelligenceForCity(world, actorId, targetCityId),
    actorId,
    targetCityId,
    at,
  );
  const informedPotential = calculateCoupSuccessRate(world, actorId, targetCityId, at);
  signals.decisionSharpening = Math.abs(informedPotential - blindCoupRate) * 2;

  if (posture === 'opportunist') signals.posture = playerCapital ? 0.4 : 0.2;
  else if (posture === 'loyal') signals.posture = 0.3;
  else signals.posture = 0.1;

  const score = Object.values(signals).reduce((sum, value) => sum + value, 0);
  return { targetCityId, score, rationale: { signals } };
}

function stripIntelligenceForCity(world: WorldState, actorId: Id, targetCityId: Id): WorldState {
  const store = world.intel ?? {};
  const records = (store[actorId] ?? []).filter(
    (record) => !(record.territoryId === targetCityId && record.source === 'intelligence'),
  );
  return { ...world, intel: { ...store, [actorId]: records } };
}

export function pickBestAiIntelligenceAction(
  world: WorldState,
  actorId: Id,
  at: Millis,
): ScoredAiIntelligenceAction | null {
  let best: ScoredAiIntelligenceAction | null = null;

  for (const targetCityId of listForeignTargetCities(world, actorId)) {
    if (isIntelligenceOnCooldown(world, actorId, targetCityId, at)) continue;
    if (hasFreshIntelligence(world, actorId, targetCityId, at)) continue;

    const scored = scoreAiIntelligenceAction(world, actorId, targetCityId, at);
    if (scored.score < AI_INTELLIGENCE_MIN_SCORE) continue;
    if (!best || scored.score > best.score) best = scored;
  }

  return best;
}

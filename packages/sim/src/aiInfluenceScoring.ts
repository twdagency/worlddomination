import { MS_PER_DAY } from './constants';
import { findCountry } from './country';
import { areAllied } from './diplomacy';
import { resolvePlayerFactionId } from './aiInfluenceAgency';
import { DIPLOMATIC_PRESSURE_MIN_INFLUENCE } from './influenceActions';
import {
  CULTURAL_CAMPAIGN_COST,
  DIPLOMATIC_MISSION_COST,
  hasActiveDiplomaticMission,
  INFLUENCE_SUBVERSION_COST,
  INFLUENCE_SUBVERSION_MANPOWER_COST,
  isCulturalCampaignOnCooldown,
} from './influenceAccelerators';
import { getInfluence } from './influence';
import { validateInfluenceTarget } from './influenceOrderValidation';
import type { DiplomaticPosture, Id, Millis, WorldState } from './types';

export const AI_INFLUENCE_MIN_SCORE = 1.0;
export const AI_SUBVERSION_SUPPRESSION_MS = 30 * MS_PER_DAY;

export type AiAcceleratorKind =
  | 'diplomatic-mission'
  | 'cultural-campaign'
  | 'influence-subversion';

export interface AiInfluenceCandidate {
  targetCityId: Id;
  accelerator: AiAcceleratorKind;
}

export interface ScoreRationale {
  signals: Record<string, number>;
}

export interface ScoredAiInfluenceAction {
  candidate: AiInfluenceCandidate;
  score: number;
  rationale: ScoreRationale;
}

const ACCELERATOR_COSTS: Record<AiAcceleratorKind, number> = {
  'diplomatic-mission': DIPLOMATIC_MISSION_COST,
  'cultural-campaign': CULTURAL_CAMPAIGN_COST,
  'influence-subversion': INFLUENCE_SUBVERSION_COST,
};

export function leaderPosture(world: WorldState, actorId: Id): DiplomaticPosture {
  const leaderId = world.factions[actorId]?.leaderId;
  return world.leaders[leaderId ?? '']?.weights.diplomaticPosture ?? 'opportunist';
}

export function goldReserveFraction(posture: DiplomaticPosture): number {
  if (posture === 'opportunist') return 0.1;
  if (posture === 'loyal') return 0.3;
  return 0.25;
}

export function affordsAccelerator(
  world: WorldState,
  actorId: Id,
  cost: number,
  posture: DiplomaticPosture,
): boolean {
  const treasury =
    world.factions[actorId]?.funding ?? findCountry(world, actorId)?.funding ?? 0;
  const reserve = treasury * goldReserveFraction(posture);
  return treasury - cost >= reserve;
}

function isPlayerCapital(world: WorldState, cityId: Id): boolean {
  const playerId = resolvePlayerFactionId(world);
  if (!playerId) return false;
  const capital = findCountry(world, playerId)?.capitalTerritoryId;
  return capital === cityId;
}

function foreignInfluenceInOwnCities(world: WorldState, actorId: Id): number {
  let peak = 0;
  for (const territory of Object.values(world.territories)) {
    if (territory.ownerId !== actorId) continue;
    const store = world.influence?.[territory.id];
    if (!store) continue;
    for (const [otherActorId, state] of Object.entries(store)) {
      if (otherActorId === actorId) continue;
      peak = Math.max(peak, state.value);
    }
  }
  return peak;
}

export function isolationistShouldAct(world: WorldState, actorId: Id): boolean {
  return foreignInfluenceInOwnCities(world, actorId) >= DIPLOMATIC_PRESSURE_MIN_INFLUENCE;
}

export function isSubversionSuppressedForActor(world: WorldState, actorId: Id, at: Millis): boolean {
  const cutoff = at - AI_SUBVERSION_SUPPRESSION_MS;
  return (world.aiSubversionDiscoveryLog ?? []).some(
    (entry) => entry.actorId === actorId && entry.at >= cutoff,
  );
}

function acceleratorBlocked(
  world: WorldState,
  actorId: Id,
  targetCityId: Id,
  accelerator: AiAcceleratorKind,
  at: Millis,
): boolean {
  if (accelerator === 'diplomatic-mission') {
    return hasActiveDiplomaticMission(world, actorId, targetCityId, at);
  }
  if (accelerator === 'cultural-campaign') {
    return isCulturalCampaignOnCooldown(world, actorId, targetCityId, at);
  }
  if (accelerator === 'influence-subversion') {
    if (isSubversionSuppressedForActor(world, actorId, at)) return true;
    const manpower = world.factions[actorId]?.manpower ?? 0;
    return manpower < INFLUENCE_SUBVERSION_MANPOWER_COST;
  }
  return false;
}

function postureAcceleratorModifier(
  posture: DiplomaticPosture,
  accelerator: AiAcceleratorKind,
  targetIsPlayerCapital: boolean,
): number {
  if (posture === 'opportunist') {
    if (accelerator === 'influence-subversion') return targetIsPlayerCapital ? 1.2 : 0.6;
    if (accelerator === 'cultural-campaign') return 0.3;
    return -0.2;
  }
  if (posture === 'loyal') {
    if (accelerator === 'diplomatic-mission') return 0.8;
    if (accelerator === 'influence-subversion') return -0.8;
    return 0.2;
  }
  if (accelerator === 'diplomatic-mission') return 0.4;
  if (accelerator === 'influence-subversion') return -0.5;
  return 0;
}

export function scoreAiInfluenceAction(
  world: WorldState,
  actorId: Id,
  candidate: AiInfluenceCandidate,
  at: Millis,
): ScoredAiInfluenceAction {
  const signals: Record<string, number> = {};
  const posture = leaderPosture(world, actorId);
  const { targetCityId, accelerator } = candidate;

  const targetCheck = validateInfluenceTarget(world, actorId, targetCityId);
  if (!targetCheck.ok) {
    return { candidate, score: -Infinity, rationale: { signals: { invalidTarget: -1 } } };
  }

  if (posture === 'isolationist' && !isolationistShouldAct(world, actorId)) {
    return { candidate, score: -Infinity, rationale: { signals: { isolationistDormant: -1 } } };
  }

  const cost = ACCELERATOR_COSTS[accelerator];
  if (!affordsAccelerator(world, actorId, cost, posture)) {
    return { candidate, score: -Infinity, rationale: { signals: { insufficientReserve: -1 } } };
  }

  if (acceleratorBlocked(world, actorId, targetCityId, accelerator, at)) {
    return { candidate, score: -Infinity, rationale: { signals: { acceleratorBlocked: -1 } } };
  }

  const city = world.territories[targetCityId]!;
  const influence = getInfluence(world, targetCityId, actorId);
  const playerCapital = isPlayerCapital(world, targetCityId);

  signals.strategicValue = city.infraLevel * 0.4;
  signals.playerCapital = playerCapital ? 1.5 : 0;
  signals.thresholdProximity =
    influence >= DIPLOMATIC_PRESSURE_MIN_INFLUENCE
      ? 0.5
      : (influence / DIPLOMATIC_PRESSURE_MIN_INFLUENCE) * 1.2;
  signals.posture = postureAcceleratorModifier(posture, accelerator, playerCapital);

  if (
    accelerator === 'cultural-campaign' &&
    influence >= DIPLOMATIC_PRESSURE_MIN_INFLUENCE - 5 &&
    influence < DIPLOMATIC_PRESSURE_MIN_INFLUENCE
  ) {
    signals.timePressure = 0.8;
  }

  if (accelerator === 'influence-subversion' && isSubversionSuppressedForActor(world, actorId, at)) {
    signals.subversionSuppressed = -Infinity;
  }

  const score = Object.values(signals).reduce((sum, value) => sum + value, 0);
  return { candidate, score, rationale: { signals } };
}

export function listForeignTargetCities(world: WorldState, actorId: Id): Id[] {
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

const ACCELERATOR_KINDS: AiAcceleratorKind[] = [
  'diplomatic-mission',
  'cultural-campaign',
  'influence-subversion',
];

export function pickBestAiInfluenceAction(
  world: WorldState,
  actorId: Id,
  at: Millis,
): ScoredAiInfluenceAction | null {
  let best: ScoredAiInfluenceAction | null = null;

  for (const targetCityId of listForeignTargetCities(world, actorId)) {
    for (const accelerator of ACCELERATOR_KINDS) {
      const scored = scoreAiInfluenceAction(world, actorId, { targetCityId, accelerator }, at);
      if (scored.score < AI_INFLUENCE_MIN_SCORE) continue;
      if (!best || scored.score > best.score) best = scored;
    }
  }

  return best;
}

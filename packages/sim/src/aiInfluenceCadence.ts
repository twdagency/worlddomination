import type { Id, Millis, SimEventDraft, WorldState } from './types';
import { AI_INFLUENCE_MIN_SCORE, pickBestAiInfluenceAction } from './aiInfluenceScoring';
import { pickBestAiThresholdAction } from './aiThresholdScoring';

export type AiInfluenceChannel = 'accelerator' | 'threshold' | 'none';

/** Shared success events that consume the per-actor daily influence-agency slot. */
export const AI_INFLUENCE_AGENCY_SUCCESS_KINDS = new Set([
  'diplomaticMissionStarted',
  'culturalCampaignApplied',
  'subversionApplied',
  'diplomaticPressureApplied',
  'tributeStarted',
  'coupSuccess',
  'defectionOccurred',
]);

/**
 * One influence-agency action per actor per day — accelerators and threshold actions
 * compete for the same slot. Higher score wins; ties favor threshold (spend influence).
 */
export function resolveAiDailyInfluenceChannel(
  world: WorldState,
  actorId: Id,
  at: Millis,
): AiInfluenceChannel {
  const accelerator = pickBestAiInfluenceAction(world, actorId, at);
  const threshold = pickBestAiThresholdAction(world, actorId, at);

  const acceleratorScore =
    accelerator && accelerator.score >= AI_INFLUENCE_MIN_SCORE ? accelerator.score : -Infinity;
  const thresholdScore =
    threshold && threshold.score >= AI_INFLUENCE_MIN_SCORE ? threshold.score : -Infinity;

  if (acceleratorScore === -Infinity && thresholdScore === -Infinity) return 'none';
  if (thresholdScore > acceleratorScore) return 'threshold';
  if (acceleratorScore > thresholdScore) return 'accelerator';
  return 'threshold';
}

export function applyAiInfluenceCooldownsFromEvents(
  world: WorldState,
  events: SimEventDraft[],
  at: Millis,
  isAiActor: (actorId: Id) => boolean,
): WorldState {
  const cooldowns = { ...(world.aiInfluenceCooldowns ?? {}) };
  let changed = false;

  for (const event of events) {
    if (!AI_INFLUENCE_AGENCY_SUCCESS_KINDS.has(event.kind)) continue;
    const actorId =
      'ownerId' in event && typeof event.ownerId === 'string'
        ? event.ownerId
        : 'actorId' in event && typeof event.actorId === 'string'
          ? event.actorId
          : undefined;
    if (!actorId || !isAiActor(actorId)) continue;
    cooldowns[actorId] = at;
    changed = true;
  }

  return changed ? { ...world, aiInfluenceCooldowns: cooldowns } : world;
}

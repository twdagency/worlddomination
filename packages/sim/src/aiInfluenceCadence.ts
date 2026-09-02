import type { Id, Millis, WorldState } from './types';
import { AI_INFLUENCE_MIN_SCORE, pickBestAiInfluenceAction } from './aiInfluenceScoring';
import { pickBestAiThresholdAction } from './aiThresholdScoring';

export type AiInfluenceChannel = 'accelerator' | 'threshold' | 'none';

export {
  AI_INFLUENCE_AGENCY_SUCCESS_KINDS,
  applyAiInfluenceCooldownsFromEvents,
  canActorIssueInfluenceOrder,
  INFLUENCE_CHANNEL_ORDER_KINDS,
  isInfluenceChannelOrderKind,
} from './influenceChannel';

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

import { MS_PER_DAY } from './constants';
import type { Id, Millis, Order, SimEventDraft, WorldState } from './types';

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

/** Player and AI share this channel. Intelligence and tribute-cancel stay outside it. */
export const INFLUENCE_CHANNEL_ORDER_KINDS = new Set<Order['kind']>([
  'diplomatic-mission',
  'cultural-campaign',
  'influence-subversion',
  'diplomatic-pressure',
  'tribute-extraction',
  'coup-attempt',
  'defection-claim',
]);

export function isInfluenceChannelOrderKind(kind: Order['kind']): boolean {
  return INFLUENCE_CHANNEL_ORDER_KINDS.has(kind);
}

/**
 * One channel action per actor per game-day after a success.
 * Player may act from t=0; AI still waits until the first full day.
 */
export function canActorIssueInfluenceOrder(world: WorldState, actorId: Id, at: Millis): boolean {
  const last = world.aiInfluenceCooldowns?.[actorId];
  if (last === undefined) {
    if (world.factions[actorId]?.isPlayer) return true;
    return at - world.startMs >= MS_PER_DAY;
  }
  return at - last >= MS_PER_DAY;
}

export function applyAiInfluenceCooldownsFromEvents(
  world: WorldState,
  events: SimEventDraft[],
  at: Millis,
  isEligibleActor: (actorId: Id) => boolean = () => true,
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
    if (!actorId || !isEligibleActor(actorId)) continue;
    cooldowns[actorId] = at;
    changed = true;
  }

  return changed ? { ...world, aiInfluenceCooldowns: cooldowns } : world;
}

import { findCountry } from './country';
import { taggedOrderFields } from './dispatch';
import { isAiInfluenceAgencyActive } from './aiInfluenceAgency';
import {
  applyAiInfluenceCooldownsFromEvents,
  resolveAiDailyInfluenceChannel,
} from './aiInfluenceCadence';
import { canActorIssueInfluenceOrder } from './aiInfluenceOrders';
import { AI_INFLUENCE_MIN_SCORE } from './aiInfluenceScoring';
import {
  pickBestAiThresholdAction,
  type AiThresholdCandidate,
} from './aiThresholdScoring';
import { applyInfluenceOrders } from './influenceAccelerators';
import type { Id, Millis, Order, SimEventDraft, WorldState } from './types';

export {
  listAiThresholdCandidates,
  pickBestAiThresholdAction,
  scoreAiThresholdAction,
} from './aiThresholdScoring';
export type {
  AiThresholdCandidate,
  AiThresholdKind,
  ScoredAiThresholdAction,
} from './aiThresholdScoring';
export { resolveAiDailyInfluenceChannel } from './aiInfluenceCadence';
export type { AiInfluenceChannel } from './aiInfluenceCadence';

function isAiActor(world: WorldState, actorId: Id): boolean {
  const faction = world.factions[actorId];
  return Boolean(faction && !faction.isPlayer);
}

function isFactionDefeated(world: WorldState, factionId: Id): boolean {
  return findCountry(world, factionId)?.defeated === true;
}

function buildThresholdOrder(
  actorId: Id,
  candidate: AiThresholdCandidate,
  at: Millis,
): Order {
  const base = {
    ownerId: actorId,
    targetCityId: candidate.targetCityId,
    ...taggedOrderFields(actorId, at, 'expand'),
  };

  if (candidate.action === 'diplomatic-pressure') {
    return {
      kind: 'diplomatic-pressure',
      ...base,
      targetCountryId: candidate.targetCountryId!,
      proposalKind: candidate.proposalKind!,
    };
  }

  return {
    kind: candidate.action,
    ...base,
  };
}

/**
 * Pure — at most one threshold action per eligible AI country per day.
 * Competes with accelerators via resolveAiDailyInfluenceChannel; shared cooldown.
 */
export function collectAiThresholdOrders(world: WorldState, at: Millis): Order[] {
  if (!isAiInfluenceAgencyActive(world)) return [];

  const orders: Order[] = [];
  const actorIds = Object.keys(world.factions).sort();

  for (const actorId of actorIds) {
    const faction = world.factions[actorId];
    if (!faction || faction.isPlayer) continue;
    if (isFactionDefeated(world, actorId)) continue;
    if (!canActorIssueInfluenceOrder(world, actorId, at)) continue;
    if (resolveAiDailyInfluenceChannel(world, actorId, at) !== 'threshold') continue;

    const best = pickBestAiThresholdAction(world, actorId, at);
    if (!best || best.score < AI_INFLUENCE_MIN_SCORE) continue;

    orders.push(buildThresholdOrder(actorId, best.candidate, at));
  }

  return orders;
}

/** Apply AI threshold orders and update shared agency cooldown state. */
export function applyAiThresholdOrders(
  world: WorldState,
  at: Millis,
): { world: WorldState; events: SimEventDraft[] } {
  const orders = collectAiThresholdOrders(world, at);
  if (orders.length === 0) {
    return { world, events: [] };
  }

  const result = applyInfluenceOrders(world, orders, at);
  const next = applyAiInfluenceCooldownsFromEvents(result.world, result.events, at, (actorId) =>
    isAiActor(world, actorId),
  );
  return { world: next, events: result.events };
}

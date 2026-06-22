import { MS_PER_DAY } from './constants';
import { findCountry } from './country';
import { taggedOrderFields } from './dispatch';
import { isAiInfluenceAgencyActive } from './aiInfluenceAgency';
import { canActorIssueInfluenceOrder } from './aiInfluenceOrders';
import {
  AI_INTELLIGENCE_MIN_SCORE,
  pickBestAiIntelligenceAction,
} from './aiIntelligenceScoring';
import { applyInfluenceOrders } from './influenceAccelerators';
import type { Id, Millis, Order, SimEventDraft, WorldState } from './types';

export {
  AI_INTELLIGENCE_MIN_SCORE,
  pickBestAiIntelligenceAction,
  scoreAiIntelligenceAction,
} from './aiIntelligenceScoring';
export type { ScoredAiIntelligenceAction } from './aiIntelligenceScoring';

function isAiActor(world: WorldState, actorId: Id): boolean {
  const faction = world.factions[actorId];
  return Boolean(faction && !faction.isPlayer);
}

function isFactionDefeated(world: WorldState, factionId: Id): boolean {
  return findCountry(world, factionId)?.defeated === true;
}

function buildIntelligenceOrder(actorId: Id, targetCityId: Id, at: Millis): Order {
  return {
    kind: 'gather-intelligence',
    ownerId: actorId,
    targetCityId,
    ...taggedOrderFields(actorId, at, 'expand'),
  };
}

/** First intelligence order requires one game-day since world start (mirrors influence agency). */
export function canActorGatherIntelligence(world: WorldState, actorId: Id, at: Millis): boolean {
  if (at - world.startMs < MS_PER_DAY) return false;
  return true;
}

/**
 * Pure — at most one intelligence gather per eligible AI actor per tick.
 * Outside the daily influence-channel budget; uses per-(actor, city) cooldown.
 */
export function collectAiIntelligenceOrders(world: WorldState, at: Millis): Order[] {
  if (!isAiInfluenceAgencyActive(world)) return [];

  const orders: Order[] = [];
  const actorIds = Object.keys(world.factions).sort();

  for (const actorId of actorIds) {
    const faction = world.factions[actorId];
    if (!faction || faction.isPlayer) continue;
    if (isFactionDefeated(world, actorId)) continue;
    if (!canActorGatherIntelligence(world, actorId, at)) continue;

    const best = pickBestAiIntelligenceAction(world, actorId, at);
    if (!best || best.score < AI_INTELLIGENCE_MIN_SCORE) continue;

    orders.push(buildIntelligenceOrder(actorId, best.targetCityId, at));
  }

  return orders;
}

export function applyAiIntelligenceOrders(
  world: WorldState,
  at: Millis,
): { world: WorldState; events: SimEventDraft[] } {
  const orders = collectAiIntelligenceOrders(world, at);
  if (orders.length === 0) {
    return { world, events: [] };
  }

  const result = applyInfluenceOrders(world, orders, at);
  return { world: result.world, events: result.events };
}

/** Exported for tests — intelligence does not consume aiInfluenceCooldowns. */
export function intelligenceUsesSeparateCadenceFromInfluenceChannel(
  world: WorldState,
  actorId: Id,
  at: Millis,
): boolean {
  return canActorIssueInfluenceOrder(world, actorId, at);
}

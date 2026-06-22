import { MS_PER_DAY } from './constants';
import { findCountry } from './country';
import { taggedOrderFields } from './dispatch';
import { isInfluenceAgencyDisabled } from './aiInfluenceAgency';
import {
  AI_INFLUENCE_MIN_SCORE,
  pickBestAiInfluenceAction,
  type AiAcceleratorKind,
} from './aiInfluenceScoring';
import { applyInfluenceOrders } from './influenceAccelerators';
import type { Id, Millis, Order, SimEventDraft, WorldState } from './types';

export { AI_INFLUENCE_MIN_SCORE, AI_SUBVERSION_SUPPRESSION_MS } from './aiInfluenceScoring';
export {
  affordsAccelerator,
  goldReserveFraction,
  isSubversionSuppressedForActor,
  leaderPosture,
  pickBestAiInfluenceAction,
  scoreAiInfluenceAction,
} from './aiInfluenceScoring';
export type { AiAcceleratorKind, AiInfluenceCandidate, ScoreRationale, ScoredAiInfluenceAction } from './aiInfluenceScoring';

const AI_ACCELERATOR_SUCCESS_KINDS = new Set([
  'diplomaticMissionStarted',
  'culturalCampaignApplied',
  'subversionApplied',
]);

export function ensureWorldAiInfluenceAgency(world: WorldState): WorldState {
  return {
    ...world,
    aiInfluenceCooldowns: world.aiInfluenceCooldowns ?? {},
    aiSubversionDiscoveryLog: world.aiSubversionDiscoveryLog ?? [],
  };
}

export function canActorIssueInfluenceOrder(world: WorldState, actorId: Id, at: Millis): boolean {
  const last = world.aiInfluenceCooldowns?.[actorId];
  if (last === undefined) {
    return at - world.startMs >= MS_PER_DAY;
  }
  return at - last >= MS_PER_DAY;
}

function isAiActor(world: WorldState, actorId: Id): boolean {
  const faction = world.factions[actorId];
  return Boolean(faction && !faction.isPlayer);
}

function buildInfluenceOrder(
  actorId: Id,
  accelerator: AiAcceleratorKind,
  targetCityId: Id,
  at: Millis,
): Order {
  return {
    kind: accelerator,
    ownerId: actorId,
    targetCityId,
    ...taggedOrderFields(actorId, at, 'expand'),
  };
}

function isFactionDefeated(world: WorldState, factionId: Id): boolean {
  return findCountry(world, factionId)?.defeated === true;
}

/**
 * Pure — at most one influence accelerator order per eligible AI country.
 * Respects tutorial suppression and per-actor daily cooldown.
 */
export function collectAiInfluenceOrders(world: WorldState, at: Millis): Order[] {
  if (isInfluenceAgencyDisabled(world)) return [];

  const orders: Order[] = [];
  const actorIds = Object.keys(world.factions).sort();

  for (const actorId of actorIds) {
    const faction = world.factions[actorId];
    if (!faction || faction.isPlayer) continue;
    if (isFactionDefeated(world, actorId)) continue;
    if (!canActorIssueInfluenceOrder(world, actorId, at)) continue;

    const best = pickBestAiInfluenceAction(world, actorId, at);
    if (!best || best.score < AI_INFLUENCE_MIN_SCORE) continue;

    orders.push(
      buildInfluenceOrder(actorId, best.candidate.accelerator, best.candidate.targetCityId, at),
    );
  }

  return orders;
}

function applyCooldownsFromEvents(world: WorldState, events: SimEventDraft[], at: Millis): WorldState {
  const cooldowns = { ...(world.aiInfluenceCooldowns ?? {}) };
  let changed = false;

  for (const event of events) {
    if (!AI_ACCELERATOR_SUCCESS_KINDS.has(event.kind)) continue;
    if (!('ownerId' in event) || typeof event.ownerId !== 'string') continue;
    if (!isAiActor(world, event.ownerId)) continue;
    cooldowns[event.ownerId] = at;
    changed = true;
  }

  return changed ? { ...world, aiInfluenceCooldowns: cooldowns } : world;
}

function applySubversionDiscoveryLog(
  world: WorldState,
  events: SimEventDraft[],
  orders: Order[],
): WorldState {
  const log = [...(world.aiSubversionDiscoveryLog ?? [])];
  let changed = false;

  for (const event of events) {
    if (event.kind !== 'subversionDiscovered') continue;
    const order = orders.find(
      (candidate) =>
        candidate.kind === 'influence-subversion' && candidate.ownerId === event.ownerId,
    );
    if (!order || order.kind !== 'influence-subversion') continue;
    log.push({ actorId: event.ownerId, targetCityId: order.targetCityId, at: event.at });
    changed = true;
  }

  return changed ? { ...world, aiSubversionDiscoveryLog: log } : world;
}

/** Apply AI-collected influence accelerator orders and update agency state. */
export function applyAiInfluenceOrders(
  world: WorldState,
  at: Millis,
): { world: WorldState; events: SimEventDraft[] } {
  const orders = collectAiInfluenceOrders(world, at);
  if (orders.length === 0) {
    return { world, events: [] };
  }

  const result = applyInfluenceOrders(world, orders, at);
  let next = applyCooldownsFromEvents(result.world, result.events, at);
  next = applySubversionDiscoveryLog(next, result.events, orders);
  return { world: next, events: result.events };
}

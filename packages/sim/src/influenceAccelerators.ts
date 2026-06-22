import { MS_PER_DAY } from './constants';
import { areAllied, getAlliancesFor } from './diplomacy';
import {
  applyInfluenceDelta,
  ensureWorldInfluence,
  getInfluence,
  INFLUENCE_CAP,
} from './influence';
import {
  isInfluenceOrder,
  validateInfluenceTarget,
  type InfluenceOrderRejectionReason,
} from './influenceOrderValidation';
import { nextRandom } from './rng';
import {
  applyDiplomaticPressure,
  applyCoupAttempt,
  applyDefectionClaim,
  applyTributeCancel,
  applyTributeExtraction,
  validateCoupAttempt,
  validateDefectionClaim,
  validateDiplomaticPressure,
  validateTributeCancel,
  validateTributeExtraction,
} from './influenceActions';
import type {
  ActiveDiplomaticMission,
  CulturalCampaignRecord,
  Id,
  InfluenceOrderKind,
  Millis,
  Order,
  Reputation,
  SimEventDraft,
  WorldState,
} from './types';

export {
  formatInfluenceOrderRejectedMessage,
} from './influenceOrderMessages';
export {
  isInfluenceOrder,
  type InfluenceOrderRejectionReason,
} from './influenceOrderValidation';

export const DIPLOMATIC_MISSION_COST = 1500;
export const DIPLOMATIC_MISSION_DURATION_MS = 14 * MS_PER_DAY;

export const CULTURAL_CAMPAIGN_COST = 3000;
export const CULTURAL_CAMPAIGN_BURST = 10;
export const CULTURAL_CAMPAIGN_COOLDOWN_MS = 30 * MS_PER_DAY;

export const INFLUENCE_SUBVERSION_COST = 4000;
export const INFLUENCE_SUBVERSION_MANPOWER_COST = 1;
export const INFLUENCE_SUBVERSION_BURST = 20;
export const INFLUENCE_SUBVERSION_DISCOVERY_RATE = 0.3;
export const INFLUENCE_SUBVERSION_REPUTATION_PENALTY = -25;
export const INFLUENCE_SUBVERSION_REPUTATION_BOLD_BONUS = 5;

function targetOwnerId(world: WorldState, cityId: Id): Id | undefined {
  return world.territories[cityId]?.ownerId;
}

function isOwnerDefeated(world: WorldState, ownerId: Id | undefined): boolean {
  if (!ownerId) return true;
  return world.countries?.[ownerId]?.defeated === true;
}

function hasActiveMission(
  world: WorldState,
  ownerId: Id,
  targetCityId: Id,
  at: Millis,
): boolean {
  return (world.activeDiplomaticMissions ?? []).some(
    (mission) =>
      mission.ownerId === ownerId &&
      mission.targetCityId === targetCityId &&
      at < mission.expiresAt,
  );
}

export function hasActiveDiplomaticMission(
  world: WorldState,
  ownerId: Id,
  targetCityId: Id,
  at: Millis = world.nowMs,
): boolean {
  return hasActiveMission(world, ownerId, targetCityId, at);
}

function culturalCampaignOnCooldown(
  world: WorldState,
  ownerId: Id,
  targetCityId: Id,
  at: Millis,
): boolean {
  return (world.culturalCampaigns ?? []).some(
    (record) =>
      record.ownerId === ownerId &&
      record.targetCityId === targetCityId &&
      at < record.cooldownUntil,
  );
}

function rejectInfluenceOrder(
  world: WorldState,
  order: Extract<Order, { ownerId: Id; targetCityId: Id }>,
  reason: InfluenceOrderRejectionReason,
  events: SimEventDraft[],
): void {
  if (!world.factions[order.ownerId]?.isPlayer) return;
  const influenceOrderKind =
    order.kind === 'cancel-diplomatic-mission'
      ? 'cancel-diplomatic-mission'
      : order.kind === 'diplomatic-pressure' ||
          order.kind === 'tribute-extraction' ||
          order.kind === 'tribute-cancel' ||
          order.kind === 'coup-attempt' ||
          order.kind === 'defection-claim'
        ? order.kind
        : order.kind;
  events.push({
    kind: 'orderRejected',
    at: world.nowMs,
    factionId: order.ownerId,
    influenceOrderKind,
    targetCityId: order.targetCityId,
    reason,
    importance: 'medium',
  });
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

function applySubversionDiscoveryReputation(
  world: WorldState,
  actorId: Id,
  targetCountryId: Id,
): { world: WorldState; reputationDeltas: Record<Id, number> } {
  const reputationDeltas: Record<Id, number> = {};
  const reputation: Reputation = {};

  for (const observer of Object.keys(world.reputation).sort()) {
    reputation[observer] = { ...world.reputation[observer] };
  }

  const targetRow = reputation[targetCountryId];
  if (targetRow) {
    targetRow[actorId] =
      (targetRow[actorId] ?? 0) + INFLUENCE_SUBVERSION_REPUTATION_PENALTY;
    reputationDeltas[targetCountryId] = INFLUENCE_SUBVERSION_REPUTATION_PENALTY;
  }

  for (const allyId of getAlliancesFor(world, actorId)) {
    const allyRow = reputation[allyId];
    if (!allyRow) continue;
    allyRow[actorId] = (allyRow[actorId] ?? 0) + INFLUENCE_SUBVERSION_REPUTATION_BOLD_BONUS;
    reputationDeltas[allyId] = INFLUENCE_SUBVERSION_REPUTATION_BOLD_BONUS;
  }

  return {
    world: { ...world, reputation },
    reputationDeltas,
  };
}

function clippedBurst(current: number, burst: number): number {
  return Math.min(burst, INFLUENCE_CAP - current);
}

function hasActiveAssaultAgainstOwner(
  world: WorldState,
  actorId: Id,
  targetOwnerId: Id,
): boolean {
  for (const unit of Object.values(world.units)) {
    if (unit.ownerId !== actorId) continue;
    if (unit.transit?.stanceOnArrival !== 'assault') continue;
    const destinationId = unit.transit.toTerritoryId;
    if (!destinationId) continue;
    if (world.territories[destinationId]?.ownerId === targetOwnerId) return true;
  }
  return false;
}

function missionExpulsionReason(
  world: WorldState,
  mission: ActiveDiplomaticMission,
  at: Millis,
): 'alliance-broken' | 'war-declared' | 'target-defeated' | null {
  const ownerId = targetOwnerId(world, mission.targetCityId);
  if (!ownerId || isOwnerDefeated(world, ownerId)) return 'target-defeated';
  if (areAllied(world, mission.ownerId, ownerId)) return 'alliance-broken';
  if (hasActiveAssaultAgainstOwner(world, mission.ownerId, ownerId)) return 'war-declared';
  return null;
}

export function applyInfluenceOrders(
  world: WorldState,
  orders: Order[],
  at: Millis,
): { world: WorldState; events: SimEventDraft[] } {
  let next = ensureWorldInfluence(world);
  const events: SimEventDraft[] = [];

  for (const order of orders) {
    if (!isInfluenceOrder(order)) continue;
    if (!('ownerId' in order) || !('targetCityId' in order)) continue;

    const ownerId = order.ownerId;
    const targetCityId = order.targetCityId;

    if (order.kind === 'diplomatic-pressure') {
      const validation = validateDiplomaticPressure(
        next,
        ownerId,
        targetCityId,
        order.targetCountryId,
        order.proposalKind,
      );
      if (!validation.ok) {
        rejectInfluenceOrder(next, order, validation.reason, events);
        continue;
      }

      const result = applyDiplomaticPressure(
        next,
        ownerId,
        targetCityId,
        order.targetCountryId,
        order.proposalKind,
        at,
      );
      next = result.world;
      events.push(...result.events);
      continue;
    }

    if (order.kind === 'tribute-extraction') {
      const validation = validateTributeExtraction(next, ownerId, targetCityId);
      if (!validation.ok) {
        rejectInfluenceOrder(next, order, validation.reason, events);
        continue;
      }
      const result = applyTributeExtraction(next, ownerId, targetCityId, at);
      next = result.world;
      events.push(...result.events);
      continue;
    }

    if (order.kind === 'tribute-cancel') {
      const validation = validateTributeCancel(next, ownerId, targetCityId);
      if (!validation.ok) {
        rejectInfluenceOrder(next, order, validation.reason, events);
        continue;
      }
      const result = applyTributeCancel(next, ownerId, targetCityId, at);
      next = result.world;
      events.push(...result.events);
      continue;
    }

    if (order.kind === 'coup-attempt') {
      const validation = validateCoupAttempt(next, ownerId, targetCityId);
      if (!validation.ok) {
        rejectInfluenceOrder(next, order, validation.reason, events);
        continue;
      }
      const result = applyCoupAttempt(next, ownerId, targetCityId, at);
      next = result.world;
      events.push(...result.events);
      continue;
    }

    if (order.kind === 'defection-claim') {
      const validation = validateDefectionClaim(next, ownerId, targetCityId);
      if (!validation.ok) {
        rejectInfluenceOrder(next, order, validation.reason, events);
        continue;
      }
      const result = applyDefectionClaim(next, ownerId, targetCityId, at);
      next = result.world;
      events.push(...result.events);
      continue;
    }

    if (order.kind === 'cancel-diplomatic-mission') {
      if (!hasActiveMission(next, ownerId, targetCityId, at)) {
        rejectInfluenceOrder(next, order, 'no-active-mission', events);
        continue;
      }
      next = {
        ...next,
        activeDiplomaticMissions: (next.activeDiplomaticMissions ?? []).filter(
          (mission) =>
            !(mission.ownerId === ownerId && mission.targetCityId === targetCityId),
        ),
      };
      continue;
    }

    const targetCheck = validateInfluenceTarget(next, ownerId, targetCityId);
    if (!targetCheck.ok) {
      rejectInfluenceOrder(next, order, targetCheck.reason, events);
      continue;
    }

    if (order.kind === 'diplomatic-mission') {
      const faction = next.factions[ownerId];
      if (!faction || faction.funding < DIPLOMATIC_MISSION_COST) {
        rejectInfluenceOrder(next, order, 'insufficient-gold', events);
        continue;
      }
      if (hasActiveMission(next, ownerId, targetCityId, at)) {
        rejectInfluenceOrder(next, order, 'mission-already-active', events);
        continue;
      }

      next = deductGold(next, ownerId, DIPLOMATIC_MISSION_COST);
      const mission: ActiveDiplomaticMission = {
        ownerId,
        targetCityId,
        startedAt: at,
        expiresAt: at + DIPLOMATIC_MISSION_DURATION_MS,
      };
      next = {
        ...next,
        activeDiplomaticMissions: [...(next.activeDiplomaticMissions ?? []), mission],
      };
      events.push({
        kind: 'diplomaticMissionStarted',
        at,
        ownerId,
        targetCityId,
        expiresAt: mission.expiresAt,
        importance: 'medium',
      });
      continue;
    }

    if (order.kind === 'cultural-campaign') {
      const faction = next.factions[ownerId];
      if (!faction || faction.funding < CULTURAL_CAMPAIGN_COST) {
        rejectInfluenceOrder(next, order, 'insufficient-gold', events);
        continue;
      }
      if (culturalCampaignOnCooldown(next, ownerId, targetCityId, at)) {
        rejectInfluenceOrder(next, order, 'cultural-campaign-cooldown', events);
        continue;
      }

      const before = getInfluence(next, targetCityId, ownerId);
      const delta = clippedBurst(before, CULTURAL_CAMPAIGN_BURST);
      next = deductGold(next, ownerId, CULTURAL_CAMPAIGN_COST);
      next = applyInfluenceDelta(next, targetCityId, ownerId, delta, at);
      const record: CulturalCampaignRecord = {
        ownerId,
        targetCityId,
        appliedAt: at,
        cooldownUntil: at + CULTURAL_CAMPAIGN_COOLDOWN_MS,
      };
      next = {
        ...next,
        culturalCampaigns: [...(next.culturalCampaigns ?? []), record],
      };
      events.push({
        kind: 'culturalCampaignApplied',
        at,
        ownerId,
        targetCityId,
        influenceDelta: delta,
        importance: 'medium',
      });
      continue;
    }

    if (order.kind === 'influence-subversion') {
      const faction = next.factions[ownerId];
      if (!faction || faction.funding < INFLUENCE_SUBVERSION_COST) {
        rejectInfluenceOrder(next, order, 'insufficient-gold', events);
        continue;
      }
      if (faction.manpower < INFLUENCE_SUBVERSION_MANPOWER_COST) {
        rejectInfluenceOrder(next, order, 'insufficient-manpower', events);
        continue;
      }

      const before = getInfluence(next, targetCityId, ownerId);
      const delta = clippedBurst(before, INFLUENCE_SUBVERSION_BURST);
      next = deductGold(next, ownerId, INFLUENCE_SUBVERSION_COST);
      next = deductManpower(next, ownerId, INFLUENCE_SUBVERSION_MANPOWER_COST);
      next = applyInfluenceDelta(next, targetCityId, ownerId, delta, at);

      const roll = nextRandom(next.rng);
      next = { ...next, rng: roll.state };
      const discovered = roll.value < INFLUENCE_SUBVERSION_DISCOVERY_RATE;

      events.push({
        kind: 'subversionApplied',
        at,
        ownerId,
        targetCityId,
        influenceDelta: delta,
        importance: 'medium',
      });

      if (discovered) {
        const targetCountryId = targetCheck.ownerId;
        const reputationResult = applySubversionDiscoveryReputation(next, ownerId, targetCountryId);
        next = reputationResult.world;
        events.push({
          kind: 'subversionDiscovered',
          at,
          ownerId,
          targetCountryId,
          reputationDeltas: reputationResult.reputationDeltas,
          importance: 'high',
        });
      }
    }
  }

  return { world: next, events };
}

export function expireActiveInfluenceEffects(
  world: WorldState,
  at: Millis,
): { world: WorldState; events: SimEventDraft[] } {
  let next = ensureWorldInfluence(world);
  const events: SimEventDraft[] = [];
  const remainingMissions: ActiveDiplomaticMission[] = [];

  for (const mission of next.activeDiplomaticMissions ?? []) {
    if (at >= mission.expiresAt) {
      events.push({
        kind: 'diplomaticMissionExpired',
        at,
        ownerId: mission.ownerId,
        targetCityId: mission.targetCityId,
        importance: 'low',
      });
      continue;
    }

    const expulsion = missionExpulsionReason(next, mission, at);
    if (expulsion) {
      events.push({
        kind: 'diplomaticMissionExpelled',
        at,
        ownerId: mission.ownerId,
        targetCityId: mission.targetCityId,
        reason: expulsion,
        importance: 'medium',
      });
      continue;
    }

    remainingMissions.push(mission);
  }

  const remainingCampaigns = (next.culturalCampaigns ?? []).filter(
    (record) => at < record.cooldownUntil,
  );

  next = {
    ...next,
    activeDiplomaticMissions: remainingMissions,
    culturalCampaigns: remainingCampaigns,
  };

  return { world: next, events };
}

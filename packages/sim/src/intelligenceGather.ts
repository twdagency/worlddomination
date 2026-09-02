import { MS_PER_DAY } from './constants';
import { areAllied } from './diplomacy';
import { computeBeatId } from './beatId';
import { getInfluence } from './influence';
import { INTELLIGENCE_MIN_INFLUENCE } from './influenceConstants';
import { validateInfluenceTarget } from './influenceOrderValidation';
import {
  ensureIntelStore,
  factionIntelRecords,
  pruneExpiredRecords,
} from './intel';
import type {
  Id,
  IntelligenceGatherRecord,
  IntelRecord,
  Millis,
  SimEventDraft,
  TerritorySnapshot,
  WorldState,
} from './types';

export { INTELLIGENCE_MIN_INFLUENCE } from './influenceConstants';

export const INTELLIGENCE_GATHER_COST = 2500;
export const INTELLIGENCE_COOLDOWN_MS = 30 * MS_PER_DAY;
export const INTELLIGENCE_FRESH_WINDOW_MS = MS_PER_DAY;

export type IntelligenceRejectionReason =
  | 'insufficient-influence'
  | 'insufficient-gold'
  | 'target-is-allied'
  | 'target-owner-defeated'
  | 'target-city-unknown'
  | 'target-is-own-city'
  | 'intelligence-on-cooldown'
  | 'intelligence-fresh';

function isOwnerDefeated(world: WorldState, ownerId: Id | undefined): boolean {
  if (!ownerId) return true;
  return world.countries?.[ownerId]?.defeated === true;
}

export function ensureWorldIntelligenceGathers(world: WorldState): WorldState {
  return {
    ...world,
    intelligenceGathers: world.intelligenceGathers ?? [],
  };
}

export function isIntelligenceOnCooldown(
  world: WorldState,
  ownerId: Id,
  targetCityId: Id,
  at: Millis,
): boolean {
  return (world.intelligenceGathers ?? []).some(
    (record) =>
      record.ownerId === ownerId &&
      record.targetCityId === targetCityId &&
      at < record.cooldownUntil,
  );
}

export function hasFreshIntelligence(
  world: WorldState,
  ownerId: Id,
  targetCityId: Id,
  at: Millis,
): boolean {
  const records = pruneExpiredRecords(ensureIntelStore(world)[ownerId] ?? [], at);
  return records.some(
    (record) =>
      record.territoryId === targetCityId &&
      record.source === 'intelligence' &&
      at - record.observationTime < INTELLIGENCE_FRESH_WINDOW_MS,
  );
}

export function captureIntelligenceSnapshot(
  world: WorldState,
  observerId: Id,
  targetCityId: Id,
): TerritorySnapshot {
  const territory = world.territories[targetCityId];
  const byTypeId: Record<Id, number> = {};
  let defenderTotal = 0;
  let inTransitCount = 0;

  for (const unit of Object.values(world.units)) {
    if (unit.locationId === targetCityId && unit.ownerId && unit.ownerId !== observerId) {
      defenderTotal += unit.count;
      byTypeId[unit.typeId] = (byTypeId[unit.typeId] ?? 0) + unit.count;
    }
    if (
      unit.transit?.toTerritoryId === targetCityId &&
      unit.ownerId &&
      unit.ownerId !== observerId
    ) {
      inTransitCount += unit.count;
    }
  }

  return {
    ownerId: territory?.ownerId,
    infraLevel: territory?.infraLevel ?? 0,
    garrisonCount: 0,
    visibleEnemyGarrison: 0,
    inTransitCount,
    enriched: {
      garrisonDetail: { totalCount: defenderTotal, byTypeId },
      productionQueue: territory?.buildQueue ? [...territory.buildQueue] : [],
      standingBreakdown: {},
    },
  };
}

export function latestIntelligenceRecord(
  world: WorldState,
  actorId: Id,
  targetCityId: Id,
  at: Millis,
): IntelRecord | undefined {
  const records = factionIntelRecords({ ...world, nowMs: at }, actorId).filter(
    (record) => record.territoryId === targetCityId && record.source === 'intelligence',
  );
  if (records.length === 0) return undefined;
  return records.reduce((latest, record) =>
    record.observationTime > latest.observationTime ? record : latest,
  );
}

export function intelligenceGarrisonCount(
  world: WorldState,
  actorId: Id,
  targetCityId: Id,
  at: Millis,
): number | undefined {
  return latestIntelligenceRecord(world, actorId, targetCityId, at)?.snapshot.enriched
    ?.garrisonDetail.totalCount;
}

export function validateGatherIntelligence(
  world: WorldState,
  actorId: Id,
  targetCityId: Id,
  at: Millis,
): { ok: true } | { ok: false; reason: IntelligenceRejectionReason } {
  const targetCheck = validateInfluenceTarget(world, actorId, targetCityId);
  if (!targetCheck.ok) {
    return {
      ok: false,
      reason:
        targetCheck.reason === 'target-is-own-city'
          ? 'target-is-own-city'
          : targetCheck.reason === 'target-is-allied'
            ? 'target-is-allied'
            : targetCheck.reason === 'target-owner-defeated'
              ? 'target-owner-defeated'
              : 'target-city-unknown',
    };
  }

  if (getInfluence(world, targetCityId, actorId) < INTELLIGENCE_MIN_INFLUENCE) {
    return { ok: false, reason: 'insufficient-influence' };
  }

  const faction = world.factions[actorId];
  if (!faction || faction.funding < INTELLIGENCE_GATHER_COST) {
    return { ok: false, reason: 'insufficient-gold' };
  }

  if (isIntelligenceOnCooldown(world, actorId, targetCityId, at)) {
    return { ok: false, reason: 'intelligence-on-cooldown' };
  }

  if (hasFreshIntelligence(world, actorId, targetCityId, at)) {
    return { ok: false, reason: 'intelligence-fresh' };
  }

  const ownerId = world.territories[targetCityId]?.ownerId;
  if (ownerId && areAllied(world, actorId, ownerId)) {
    return { ok: false, reason: 'target-is-allied' };
  }
  if (isOwnerDefeated(world, ownerId)) {
    return { ok: false, reason: 'target-owner-defeated' };
  }

  return { ok: true };
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

export function applyGatherIntelligence(
  world: WorldState,
  actorId: Id,
  targetCityId: Id,
  at: Millis,
): { world: WorldState; events: SimEventDraft[] } {
  const validation = validateGatherIntelligence(world, actorId, targetCityId, at);
  if (!validation.ok) return { world, events: [] };

  let next = ensureWorldIntelligenceGathers(world);
  next = deductGold(next, actorId, INTELLIGENCE_GATHER_COST);

  const snapshot = captureIntelligenceSnapshot(next, actorId, targetCityId);
  const record: IntelRecord = {
    observerFaction: actorId,
    territoryId: targetCityId,
    observationTime: at,
    snapshot,
    source: 'intelligence',
    expiresAt: null,
    confidence: 1.0,
  };

  const store = ensureIntelStore(next);
  const records = [...(store[actorId] ?? []), record];
  next = { ...next, intel: { ...store, [actorId]: records } };

  const gatherRecord: IntelligenceGatherRecord = {
    ownerId: actorId,
    targetCityId,
    gatheredAt: at,
    cooldownUntil: at + INTELLIGENCE_COOLDOWN_MS,
  };
  next = {
    ...next,
    intelligenceGathers: [...(next.intelligenceGathers ?? []), gatherRecord],
  };

  const ownerId = next.territories[targetCityId]?.ownerId;
  const events: SimEventDraft[] = [
    {
      kind: 'intelReport',
      at,
      observerFaction: actorId,
      receiverFaction: actorId,
      territoryId: targetCityId,
      source: 'intelligence',
      variant: snapshot.enriched?.garrisonDetail.totalCount ? 'massing' : 'activity',
      subjectFactionId: ownerId,
      garrisonDescriptor: `${snapshot.enriched?.garrisonDetail.totalCount ?? 0} troops (intelligence)`,
      intent: 'attack',
      beatId: computeBeatId(actorId, at, 'intelligence'),
      decisionTickMs: at,
      importance: 'medium',
    },
  ];

  return { world: next, events };
}

import { MS_PER_DAY } from './constants';
import { activeDirectSight } from './sight';
import type {
  Id,
  IntelRecord,
  IntelSource,
  IntelStore,
  Millis,
  TerritorySnapshot,
  TerritoryVisibilityState,
  WorldState,
} from './types';

/** Simulated time after which a record is stale unless `expiresAt` is sooner. Pruned on read. */
export const INTEL_DECAY_WINDOW_MS = MS_PER_DAY;

export function emptyIntelStore(): IntelStore {
  return {};
}

export function ensureIntelStore(world: WorldState): IntelStore {
  return world.intel ?? emptyIntelStore();
}

export function isRecordExpired(record: IntelRecord, nowMs: Millis): boolean {
  if (record.expiresAt !== null && nowMs >= record.expiresAt) return true;
  return nowMs - record.observationTime > INTEL_DECAY_WINDOW_MS;
}

/** Drops expired records. Call at read boundaries — never eagerly on write. */
export function pruneExpiredRecords(records: IntelRecord[], nowMs: Millis): IntelRecord[] {
  return records.filter((record) => !isRecordExpired(record, nowMs));
}

export function factionIntelRecords(world: WorldState, factionId: Id): IntelRecord[] {
  return pruneExpiredRecords(ensureIntelStore(world)[factionId] ?? [], world.nowMs);
}

function recordsForTerritory(records: IntelRecord[], territoryId: Id): IntelRecord[] {
  return records.filter((record) => record.territoryId === territoryId);
}

function latestRecord(records: IntelRecord[]): IntelRecord | undefined {
  if (records.length === 0) return undefined;
  return records.reduce((latest, record) =>
    record.observationTime > latest.observationTime ? record : latest,
  );
}

function snapshotEqual(a: TerritorySnapshot, b: TerritorySnapshot): boolean {
  return (
    a.ownerId === b.ownerId &&
    a.infraLevel === b.infraLevel &&
    a.garrisonCount === b.garrisonCount &&
    a.visibleEnemyGarrison === b.visibleEnemyGarrison &&
    a.inTransitCount === b.inTransitCount
  );
}

function shouldAppendDirectRecord(
  latest: IntelRecord | undefined,
  snapshot: TerritorySnapshot,
  nowMs: Millis,
): boolean {
  if (!latest) return true;
  if (latest.observationTime === nowMs) return false;
  if (latest.source !== 'direct') return true;
  return !snapshotEqual(latest.snapshot, snapshot);
}

/** Snapshot territory state visible to `observerFaction` at the current moment. */
export function captureTerritorySnapshot(
  world: WorldState,
  observerFaction: Id,
  territoryId: Id,
  visibleUnitIds: Set<Id>,
): TerritorySnapshot {
  const territory = world.territories[territoryId];
  let garrisonCount = 0;
  let visibleEnemyGarrison = 0;
  let inTransitCount = 0;

  for (const unit of Object.values(world.units)) {
    if (unit.locationId === territoryId) {
      if (unit.ownerId === observerFaction) {
        garrisonCount += unit.count;
      } else if (visibleUnitIds.has(unit.id)) {
        visibleEnemyGarrison += unit.count;
      }
    }
    if (
      unit.transit?.toTerritoryId === territoryId &&
      unit.ownerId !== observerFaction &&
      visibleUnitIds.has(unit.id)
    ) {
      inTransitCount += unit.count;
    }
  }

  return {
    ownerId: territory?.ownerId,
    infraLevel: territory?.infraLevel ?? 0,
    garrisonCount,
    visibleEnemyGarrison,
    inTransitCount,
  };
}

/**
 * Records direct observations for every faction at `world.nowMs`.
 * Single write path for geometric sight — called once per tick boundary.
 *
 * SPRINT-6: a unit that observes then dies in the same tick (e.g. arrival combat)
 * does not contribute to direct sight on that tick — post-resolution snapshot only.
 * A future "final report on death" would need an explicit pre-combat observation pass.
 */
export function recordDirectObservations(world: WorldState): IntelStore {
  const nowMs = world.nowMs;
  const store: IntelStore = { ...ensureIntelStore(world) };

  for (const factionId of Object.keys(world.factions)) {
    const sight = activeDirectSight(world, factionId);
    let records = [...(store[factionId] ?? [])];

    for (const territoryId of sight.territoryIds) {
      const snapshot = captureTerritorySnapshot(world, factionId, territoryId, sight.unitIds);
      const territoryRecords = recordsForTerritory(records, territoryId);
      const latest = latestRecord(territoryRecords);

      if (!shouldAppendDirectRecord(latest, snapshot, nowMs)) continue;

      records.push({
        observerFaction: factionId,
        territoryId,
        observationTime: nowMs,
        snapshot,
        source: 'direct',
        expiresAt: null,
        confidence: 1.0,
      });
    }

    store[factionId] = records;
  }

  return store;
}

function sourcesFromRecords(records: IntelRecord[]): IntelSource[] {
  return [...new Set(records.map((record) => record.source))];
}

/** Merge active geometric sight with stored records for one territory. */
export function mergeTerritoryVisibility(
  world: WorldState,
  factionId: Id,
  territoryId: Id,
  activeTerritoryIds: Set<Id>,
  visibleUnitIds: Set<Id>,
): TerritoryVisibilityState {
  if (activeTerritoryIds.has(territoryId)) {
    const snapshot = captureTerritorySnapshot(world, factionId, territoryId, visibleUnitIds);
    return { state: 'live', snapshot, sources: ['direct'] };
  }

  const records = recordsForTerritory(factionIntelRecords(world, factionId), territoryId);
  if (records.length === 0) return { state: 'unknown' };

  const latest = latestRecord(records)!;
  return {
    state: 'stale',
    snapshot: latest.snapshot,
    sources: sourcesFromRecords(records),
    lastObservedAt: latest.observationTime,
  };
}

export function mergeAllTerritoryVisibility(
  world: WorldState,
  factionId: Id,
): Record<Id, TerritoryVisibilityState> {
  const sight = activeDirectSight(world, factionId);
  const states: Record<Id, TerritoryVisibilityState> = {};

  for (const territory of Object.values(world.territories)) {
    states[territory.id] = mergeTerritoryVisibility(
      world,
      factionId,
      territory.id,
      sight.territoryIds,
      sight.unitIds,
    );
  }

  return states;
}

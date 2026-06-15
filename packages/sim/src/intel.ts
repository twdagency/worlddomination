import { MS_PER_DAY } from './constants';
import { isScoutUnit } from './scout';
import { activeSight, territoriesObservedByScoutUnit, type ActiveSight } from './sight';
import type {
  Id,
  IntelRecord,
  IntelSource,
  IntelStore,
  Millis,
  TerritorySnapshot,
  TerritoryVisibilityState,
  Unit,
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

function latestRecordForSource(
  records: IntelRecord[],
  territoryId: Id,
  source: IntelSource,
): IntelRecord | undefined {
  const matching = recordsForTerritory(records, territoryId).filter((record) => record.source === source);
  if (matching.length === 0) return undefined;
  return matching.reduce((latest, record) =>
    record.observationTime > latest.observationTime ? record : latest,
  );
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

function shouldAppendRecord(
  latest: IntelRecord | undefined,
  snapshot: TerritorySnapshot,
  source: IntelSource,
  nowMs: Millis,
): boolean {
  if (!latest) return true;
  if (latest.observationTime === nowMs && latest.source === source) return false;
  if (latest.source !== source) return true;
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

function appendRecord(
  records: IntelRecord[],
  record: IntelRecord,
): IntelRecord[] {
  return [...records, record];
}

function recordSourceObservations(
  world: WorldState,
  factionId: Id,
  records: IntelRecord[],
  territoryIds: Set<Id>,
  visibleUnitIds: Set<Id>,
  source: IntelSource,
  observationTime: Millis = world.nowMs,
): IntelRecord[] {
  let next = records;

  for (const territoryId of territoryIds) {
    const snapshot = captureTerritorySnapshot(world, factionId, territoryId, visibleUnitIds);
    const latest = latestRecordForSource(next, territoryId, source);
    if (latest && latest.observationTime === observationTime && latest.source === source) continue;
    if (shouldAppendRecord(latest, snapshot, source, observationTime)) {
      next = appendRecord(next, {
        observerFaction: factionId,
        territoryId,
        observationTime,
        snapshot,
        source,
        expiresAt: null,
        confidence: 1.0,
      });
    }
  }

  return next;
}

/**
 * Records direct and scout observations for every faction at `world.nowMs`.
 * Single write path for geometric sight — called once per tick boundary.
 *
 * SPRINT-6: a unit that observes then dies in the same tick (e.g. arrival combat)
 * does not contribute to tick-end sight — use `recordScoutFinalObservations` on death.
 *
 * SPRINT-6: scouts in transit observe only at tick boundaries; sub-tick passes through
 * small zones may not record.
 */
export function recordIntelObservations(world: WorldState): IntelStore {
  const store: IntelStore = { ...ensureIntelStore(world) };

  for (const factionId of Object.keys(world.factions)) {
    const sight = activeSight(world, factionId);
    let records = [...(store[factionId] ?? [])];

    records = recordSourceObservations(
      world,
      factionId,
      records,
      sight.directTerritoryIds,
      sight.unitIds,
      'direct',
    );
    records = recordSourceObservations(
      world,
      factionId,
      records,
      sight.scoutTerritoryIds,
      sight.unitIds,
      'scout',
    );

    store[factionId] = records;
  }

  return store;
}

const SHAREABLE_SOURCES: ReadonlySet<IntelSource> = new Set(['direct', 'scout']);

function shareableAllyRecords(
  records: IntelRecord[],
  sharingFaction: Id,
  nowMs: Millis,
): IntelRecord[] {
  return pruneExpiredRecords(records, nowMs).filter(
    (record) =>
      SHAREABLE_SOURCES.has(record.source) && record.observerFaction === sharingFaction,
  );
}

function toAlliedRecord(record: IntelRecord): IntelRecord {
  return {
    observerFaction: record.observerFaction,
    territoryId: record.territoryId,
    observationTime: record.observationTime,
    snapshot: record.snapshot,
    source: 'allied',
    expiresAt: null,
    confidence: record.confidence,
  };
}

function hasAlliedCopy(records: IntelRecord[], candidate: IntelRecord): boolean {
  return records.some(
    (record) =>
      record.source === 'allied' &&
      record.observerFaction === candidate.observerFaction &&
      record.territoryId === candidate.territoryId &&
      record.observationTime === candidate.observationTime,
  );
}

function appendAlliedShares(
  receiverRecords: IntelRecord[],
  shares: IntelRecord[],
): IntelRecord[] {
  let next = receiverRecords;
  for (const share of shares) {
    const allied = toAlliedRecord(share);
    if (!hasAlliedCopy(next, allied)) {
      next = appendRecord(next, allied);
    }
  }
  return next;
}

/**
 * Copies each ally's own direct/scout records into the other's intel store as 'allied'.
 * Non-transitive: allied/treaty records are never re-shared.
 *
 * Dedup at emission: skip if an identical allied copy already exists (same
 * observer, territory, observationTime). Near-duplicates from successive ticks
 * with newer observationTime are retained; merge picks the freshest at read time.
 */
export function recordAlliedObservations(world: WorldState, gameTime: Millis = world.nowMs): IntelStore {
  const store: IntelStore = { ...ensureIntelStore(world) };

  for (const pair of world.alliances) {
    const { factionA, factionB } = pair;
    const aRecords = store[factionA] ?? [];
    const bRecords = store[factionB] ?? [];

    const aShares = shareableAllyRecords(aRecords, factionA, gameTime);
    const bShares = shareableAllyRecords(bRecords, factionB, gameTime);

    const nextA = appendAlliedShares(aRecords, bShares);
    const nextB = appendAlliedShares(bRecords, aShares);

    if (nextA !== aRecords) store[factionA] = nextA;
    if (nextB !== bRecords) store[factionB] = nextB;
  }

  return store;
}

/** Removes allied records attributed to `observerFactionId` from a faction's record list. */
export function pruneRecordsByObserver(
  records: IntelRecord[],
  observerFactionId: Id,
): IntelRecord[] {
  return records.filter(
    (record) => !(record.source === 'allied' && record.observerFaction === observerFactionId),
  );
}

/** Immediately drops allied intel from a former ally on both sides of a break. */
export function pruneAlliedIntelOnBreak(
  world: WorldState,
  factionA: Id,
  factionB: Id,
): WorldState {
  const store: IntelStore = { ...ensureIntelStore(world) };
  let changed = false;

  for (const [factionId, otherId] of [
    [factionA, factionB],
    [factionB, factionA],
  ] as const) {
    const records = store[factionId] ?? [];
    const pruned = pruneRecordsByObserver(records, otherId);
    if (pruned.length !== records.length) {
      store[factionId] = pruned;
      changed = true;
    }
  }

  if (!changed) return world;
  return { ...world, intel: store };
}

function shareableInScope(
  records: IntelRecord[],
  sharingFaction: Id,
  scopedTerritoryIds: Set<Id>,
  gameTime: Millis,
): IntelRecord[] {
  return shareableAllyRecords(records, sharingFaction, gameTime).filter((record) =>
    scopedTerritoryIds.has(record.territoryId),
  );
}

function toTreatyRecord(record: IntelRecord, treatyExpiresAt: Millis): IntelRecord {
  return {
    observerFaction: record.observerFaction,
    territoryId: record.territoryId,
    observationTime: record.observationTime,
    snapshot: record.snapshot,
    source: 'treaty',
    expiresAt: treatyExpiresAt,
    confidence: record.confidence,
  };
}

function hasTreatyCopy(records: IntelRecord[], candidate: IntelRecord): boolean {
  return records.some(
    (record) =>
      record.source === 'treaty' &&
      record.observerFaction === candidate.observerFaction &&
      record.territoryId === candidate.territoryId &&
      record.observationTime === candidate.observationTime &&
      record.expiresAt === candidate.expiresAt,
  );
}

function appendTreatyShares(
  receiverRecords: IntelRecord[],
  shares: IntelRecord[],
  treatyExpiresAt: Millis,
): IntelRecord[] {
  let next = receiverRecords;
  for (const share of shares) {
    const treatyRecord = toTreatyRecord(share, treatyExpiresAt);
    if (!hasTreatyCopy(next, treatyRecord)) {
      next = appendRecord(next, treatyRecord);
    }
  }
  return next;
}

/**
 * Copies scoped direct/scout records between treaty parties as 'treaty'-sourced intel.
 * Record expiresAt is the treaty's expiry (decay window may prune sooner).
 */
export function recordTreatyObservations(world: WorldState, gameTime: Millis = world.nowMs): IntelStore {
  const store: IntelStore = { ...ensureIntelStore(world) };
  const activeTreaties = world.treaties.filter((treaty) => gameTime < treaty.expiresAt);

  for (const treaty of activeTreaties) {
    const [partyA, partyB] = treaty.parties;
    const scope = new Set(treaty.scope.territoryIds);
    const pairs: ReadonlyArray<readonly [Id, Id]> = [
      [partyA, partyB],
      [partyB, partyA],
    ];

    for (const [sharer, receiver] of pairs) {
      const receiverRecords = store[receiver] ?? [];
      const shares = shareableInScope(store[sharer] ?? [], sharer, scope, gameTime);
      const next = appendTreatyShares(receiverRecords, shares, treaty.expiresAt);
      if (next !== receiverRecords) store[receiver] = next;
    }
  }

  return store;
}

/** @deprecated Use `recordIntelObservations`. */
export function recordDirectObservations(world: WorldState): IntelStore {
  return recordIntelObservations(world);
}

/**
 * Final scout snapshot at destruction — live scout sight ends immediately and stale
 * intel is available on the next read without waiting for tick-end recording.
 */
export function recordScoutFinalObservations(
  world: WorldState,
  scoutUnit: Unit,
  atMs: Millis,
  store: IntelStore = ensureIntelStore(world),
): IntelStore {
  if (!isScoutUnit(world, scoutUnit)) return store;

  const factionId = scoutUnit.ownerId;
  const worldAt = { ...world, nowMs: atMs, intel: store };
  const observed = territoriesObservedByScoutUnit(worldAt, scoutUnit);
  let records = [...(store[factionId] ?? [])];

  records = recordSourceObservations(
    worldAt,
    factionId,
    records,
    observed.territoryIds,
    observed.unitIds,
    'scout',
    atMs,
  );

  return { ...store, [factionId]: records };
}

function activeSourcesForTerritory(sight: ActiveSight, territoryId: Id): IntelSource[] {
  const sources: IntelSource[] = [];
  if (sight.directTerritoryIds.has(territoryId)) sources.push('direct');
  if (sight.scoutTerritoryIds.has(territoryId)) sources.push('scout');
  return sources;
}

function sourcesFromRecords(records: IntelRecord[]): IntelSource[] {
  return [...new Set(records.map((record) => record.source))];
}

function uniqueSources(sources: IntelSource[]): IntelSource[] {
  return [...new Set(sources)];
}

function alliedOrTreatyRecords(records: IntelRecord[]): IntelRecord[] {
  return records.filter((record) => record.source === 'allied' || record.source === 'treaty');
}

/** Merge active geometric sight with stored records for one territory. */
export function mergeTerritoryVisibility(
  world: WorldState,
  factionId: Id,
  territoryId: Id,
  sight: ActiveSight,
): TerritoryVisibilityState {
  const geoSources = activeSourcesForTerritory(sight, territoryId);
  const records = recordsForTerritory(factionIntelRecords(world, factionId), territoryId);
  const alliedTreaty = alliedOrTreatyRecords(records);

  if (geoSources.length > 0) {
    const snapshot = captureTerritorySnapshot(world, factionId, territoryId, sight.unitIds);
    const sources = uniqueSources([
      ...geoSources,
      ...alliedTreaty.map((record) => record.source),
    ]);
    return { state: 'live', snapshot, sources };
  }

  if (alliedTreaty.length > 0) {
    const latest = latestRecord(alliedTreaty)!;
    return {
      state: 'live',
      snapshot: latest.snapshot,
      sources: sourcesFromRecords(records),
    };
  }

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
  const sight = activeSight(world, factionId);
  const states: Record<Id, TerritoryVisibilityState> = {};

  for (const territory of Object.values(world.territories)) {
    states[territory.id] = mergeTerritoryVisibility(world, factionId, territory.id, sight);
  }

  return states;
}

export function recordDestroyedScoutIntel(
  world: WorldState,
  unitsBefore: WorldState['units'],
  unitsAfter: WorldState['units'],
  atMs: Millis,
  store: IntelStore,
): IntelStore {
  let intel = store;
  const worldBefore = { ...world, units: unitsBefore };

  for (const unit of Object.values(unitsBefore)) {
    if (!isScoutUnit(worldBefore, unit)) continue;
    const after = unitsAfter[unit.id];
    if (after && after.count > 0) continue;
    intel = recordScoutFinalObservations(worldBefore, unit, atMs, intel);
  }

  return intel;
}

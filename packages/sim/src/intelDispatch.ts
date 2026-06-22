import { computeBeatId } from './beatId';
import { garrisonDescriptor } from './diplomaticDispatch';
import type {
  Id,
  IntelRecord,
  IntelSource,
  IntelStore,
  Millis,
  OrderIntent,
  SimEvent,
  SimEventDraft,
  WorldState,
} from './types';

export type IntelReportVariant = 'activity' | 'massing' | 'construction';

export function resolveIntelReportVariant(
  world: WorldState,
  territoryId: Id,
  record: IntelRecord,
): IntelReportVariant {
  const territory = world.territories[territoryId];
  if ((territory?.buildQueue ?? []).length > 0) return 'construction';
  if (record.snapshot.visibleEnemyGarrison > 0 || record.snapshot.inTransitCount > 0) {
    return 'massing';
  }
  if ((record.snapshot.enriched?.garrisonDetail.totalCount ?? 0) > 0) {
    return 'massing';
  }
  return 'activity';
}

export function inferIntelReportIntent(
  world: WorldState,
  territoryId: Id,
  record: IntelRecord,
): OrderIntent {
  const variant = resolveIntelReportVariant(world, territoryId, record);
  if (variant === 'construction') return 'build';
  if (variant === 'massing') return 'attack';
  return 'defend';
}

export function intelReportFromRecord(
  world: WorldState,
  receiverFactionId: Id,
  record: IntelRecord,
): SimEventDraft | undefined {
  const territory = world.territories[record.territoryId];
  if (territory?.ownerId === receiverFactionId) return undefined;

  const variant = resolveIntelReportVariant(world, record.territoryId, record);
  const subjectFactionId =
    record.snapshot.ownerId && record.snapshot.ownerId !== receiverFactionId
      ? record.snapshot.ownerId
      : record.snapshot.ownerId;

  if (record.source === 'scout') {
    if (record.observerFaction !== receiverFactionId) return undefined;
    return {
      kind: 'intelReport',
      at: record.observationTime,
      observerFaction: receiverFactionId,
      receiverFaction: receiverFactionId,
      territoryId: record.territoryId,
      source: 'scout',
      variant,
      subjectFactionId,
      intent: inferIntelReportIntent(world, record.territoryId, record),
      beatId: computeBeatId(receiverFactionId, record.observationTime, 'scout'),
      decisionTickMs: record.observationTime,
      importance: 'medium',
    };
  }

  if (record.source === 'allied' || record.source === 'treaty') {
    return {
      kind: 'intelReport',
      at: record.observationTime,
      observerFaction: record.observerFaction,
      receiverFaction: receiverFactionId,
      territoryId: record.territoryId,
      source: record.source,
      variant,
      subjectFactionId,
      garrisonDescriptor: garrisonDescriptor(record.snapshot),
      intent: inferIntelReportIntent(world, record.territoryId, record),
      beatId: computeBeatId(receiverFactionId, record.observationTime, record.source),
      decisionTickMs: record.observationTime,
      importance: 'medium',
    };
  }

  if (record.source === 'intelligence') {
    if (record.observerFaction !== receiverFactionId) return undefined;
    return {
      kind: 'intelReport',
      at: record.observationTime,
      observerFaction: receiverFactionId,
      receiverFaction: receiverFactionId,
      territoryId: record.territoryId,
      source: 'intelligence',
      variant,
      subjectFactionId,
      garrisonDescriptor: garrisonDescriptor(record.snapshot),
      intent: inferIntelReportIntent(world, record.territoryId, record),
      beatId: computeBeatId(receiverFactionId, record.observationTime, 'intelligence'),
      decisionTickMs: record.observationTime,
      importance: 'medium',
    };
  }

  return undefined;
}

function recordKey(record: IntelRecord): string {
  return `${record.territoryId}:${record.source}:${record.observationTime}`;
}

function newRecordsAtTime(
  prior: IntelRecord[],
  next: IntelRecord[],
  observationTime: Millis,
): IntelRecord[] {
  const priorKeys = new Set(prior.map(recordKey));
  return next.filter(
    (record) => record.observationTime === observationTime && !priorKeys.has(recordKey(record)),
  );
}

function pickScoutReportRecord(records: IntelRecord[]): IntelRecord | undefined {
  const scoutRecords = records.filter((record) => record.source === 'scout');
  if (scoutRecords.length === 0) return undefined;
  return scoutRecords[0];
}

/**
 * Emit intel dispatches for records added this tick.
 * Scout: one line per territory; direct suppresses duplicate scout.
 * Allied/treaty: receiver feed uses ally/treaty phrasing with preserved observerFaction.
 */
export function emitIntelReportEvents(
  world: WorldState,
  priorStore: IntelStore,
  nextStore: IntelStore,
  observationTime: Millis = world.nowMs,
): SimEventDraft[] {
  const events: SimEventDraft[] = [];

  for (const factionId of Object.keys(world.factions)) {
    const added = newRecordsAtTime(
      priorStore[factionId] ?? [],
      nextStore[factionId] ?? [],
      observationTime,
    );
    if (added.length === 0) continue;

    const byTerritory = new Map<Id, IntelRecord[]>();
    for (const record of added) {
      const list = byTerritory.get(record.territoryId) ?? [];
      list.push(record);
      byTerritory.set(record.territoryId, list);
    }

    for (const [, records] of byTerritory) {
      const hasDirect = records.some((record) => record.source === 'direct');
      const scoutRecord = pickScoutReportRecord(records);
      if (hasDirect && scoutRecord) {
        // direct observation supersedes scout line for same territory
      } else if (scoutRecord) {
        const event = intelReportFromRecord(world, factionId, scoutRecord);
        if (event) events.push(event);
      }

      for (const record of records) {
        if (record.source !== 'allied' && record.source !== 'treaty') continue;
        const event = intelReportFromRecord(world, factionId, record);
        if (event) events.push(event);
      }
    }
  }

  return events;
}

export function intelReportsFromRecords(
  world: WorldState,
  factionId: Id,
  records: IntelRecord[],
): SimEventDraft[] {
  const events: SimEventDraft[] = [];
  for (const record of records) {
    const event = intelReportFromRecord(world, factionId, record);
    if (event) events.push(event);
  }
  return events;
}

import { computeBeatId } from './dispatch';
import type {
  Id,
  IntelRecord,
  IntelSource,
  IntelStore,
  Millis,
  OrderIntent,
  SimEvent,
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
  factionId: Id,
  record: IntelRecord,
): SimEvent | undefined {
  if (record.source !== 'scout') return undefined;
  if (record.observerFaction !== factionId) return undefined;

  const territory = world.territories[record.territoryId];
  if (territory?.ownerId === factionId) return undefined;

  const variant = resolveIntelReportVariant(world, record.territoryId, record);
  const subjectFactionId =
    record.snapshot.ownerId && record.snapshot.ownerId !== factionId
      ? record.snapshot.ownerId
      : record.snapshot.ownerId;

  return {
    kind: 'intelReport',
    at: record.observationTime,
    observerFaction: factionId,
    territoryId: record.territoryId,
    source: 'scout',
    variant,
    subjectFactionId,
    intent: inferIntelReportIntent(world, record.territoryId, record),
    beatId: computeBeatId(factionId, record.observationTime, 'scout'),
    decisionTickMs: record.observationTime,
    importance: 'medium',
  };
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

function pickIntelReportRecord(records: IntelRecord[]): IntelRecord | undefined {
  if (records.length === 0) return undefined;
  const rank: Record<IntelSource, number> = { direct: 2, scout: 1, allied: 0, treaty: 0 };
  return records.reduce((best, record) =>
    rank[record.source] > rank[best.source] ? record : best,
  );
}

/**
 * Emit scout intel dispatches for records added this tick.
 * When direct and scout both observe a territory, only the richer direct path applies — no duplicate scout line.
 */
export function emitIntelReportEvents(
  world: WorldState,
  priorStore: IntelStore,
  nextStore: IntelStore,
  observationTime: Millis = world.nowMs,
): SimEvent[] {
  const events: SimEvent[] = [];

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
      const scoutRecords = records.filter((record) => record.source === 'scout');
      if (hasDirect && scoutRecords.length > 0) continue;

      const chosen = pickIntelReportRecord(records);
      if (!chosen || chosen.source !== 'scout') continue;

      const event = intelReportFromRecord(world, factionId, chosen);
      if (event) events.push(event);
    }
  }

  return events;
}

export function intelReportsFromRecords(
  world: WorldState,
  factionId: Id,
  records: IntelRecord[],
): SimEvent[] {
  const events: SimEvent[] = [];
  for (const record of records) {
    const event = intelReportFromRecord(world, factionId, record);
    if (event) events.push(event);
  }
  return events;
}

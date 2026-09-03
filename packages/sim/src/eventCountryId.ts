import type { Id, PendingDilemma, SimEvent } from './types';

/** Canonical actor id on dispatch events and pending dilemmas. */
export function payloadCountryId(record: {
  countryId?: Id;
  factionId?: Id;
}): Id | undefined {
  return record.countryId ?? record.factionId;
}

/**
 * Copy legacy `factionId` → `countryId` and drop the old key.
 * Safe on records that already have `countryId` or have neither field.
 */
export function migrateLegacyCountryIdFields<T extends object>(record: T): T {
  const row = record as T & { factionId?: unknown; countryId?: unknown };
  if (typeof row.factionId !== 'string') return record;
  const countryId = typeof row.countryId === 'string' ? row.countryId : row.factionId;
  const { factionId: _legacy, ...rest } = row;
  return { ...rest, countryId } as T;
}

export function migrateDispatchEventCountryIds(events: unknown[]): SimEvent[] {
  return events.map((event) =>
    event && typeof event === 'object'
      ? (migrateLegacyCountryIdFields(event) as SimEvent)
      : (event as SimEvent),
  );
}

export function migratePendingDilemmaCountryIds(
  entries: Array<PendingDilemma | (PendingDilemma & { factionId?: Id })> | undefined,
): PendingDilemma[] | undefined {
  if (!entries) return entries;
  return entries.map((entry) => migrateLegacyCountryIdFields(entry) as PendingDilemma);
}

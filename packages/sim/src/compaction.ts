import { buildDispatchFeed, dispatchLineForEvent } from './dispatch';
import type { DispatchFeedItem } from './dispatch';
import {
  COMPACTION_THRESHOLD_MS,
  DISPATCH_LINE_CAP,
  factionIdFromEvent,
  mediumCompactionCategory,
  resolveEventImportance,
  type MediumCompactionCategory,
} from './importance';
import type { Id, Millis, SimEvent, WorldState } from './types';

interface MediumBucket {
  factionId: Id;
  category: MediumCompactionCategory;
  count: number;
  firstAt: Millis;
  firstIndex: number;
}

function factionName(world: WorldState, factionId: Id): string {
  const leaderId = world.factions[factionId]?.leaderId;
  return world.leaders[leaderId ?? '']?.name ?? factionId;
}

function isPlayerFaction(world: WorldState, factionId: Id): boolean {
  return world.factions[factionId]?.isPlayer === true;
}

function formatMediumSummary(world: WorldState, bucket: MediumBucket): string {
  const who = isPlayerFaction(world, bucket.factionId) ? 'Your forces' : factionName(world, bucket.factionId);
  const prefix = isPlayerFaction(world, bucket.factionId) ? 'PRODUCTION' : 'INTEL';

  switch (bucket.category) {
    case 'construction':
      return `${prefix} — ${bucket.count} construction projects begun (${who})`;
    case 'infrastructure':
      return `${prefix} — ${bucket.count} infrastructure upgrades (${who})`;
    case 'production':
      return `${prefix} — ${bucket.count} production completions (${who})`;
    case 'repositioning':
      return `${prefix} — ${bucket.count} force repositionings (${who})`;
    case 'blocked':
      return `${prefix} — ${bucket.count} blocked build attempts (${who})`;
  }
}

function countFeedLines(items: DispatchFeedItem[]): number {
  return items.reduce((total, item) => total + (item.header ? 2 : 1), 0);
}

function eventAt(event: SimEvent): Millis {
  return 'at' in event ? event.at : 0;
}

function bucketKeyFromFeedKey(key: string): string {
  return key.startsWith('compact-') ? key.slice('compact-'.length) : key;
}

const SUMMARY_DROP_PRIORITY: Record<MediumCompactionCategory, number> = {
  repositioning: 0,
  blocked: 1,
  production: 2,
  construction: 3,
  infrastructure: 4,
};

/**
 * Deterministic catch-up compaction for skips longer than 12h.
 * High-importance events (attacks, battles, assault posture) stay full.
 * Medium-importance events fold into per-faction summaries.
 * Low-importance noise is suppressed; overflow line reports folded count.
 */
export function compactDispatchFeed(
  world: WorldState,
  events: SimEvent[],
  windowMs: number,
  formatLine: (event: SimEvent, world: WorldState) => string = (event, w) =>
    dispatchLineForEvent(w, event),
): DispatchFeedItem[] {
  if (windowMs <= COMPACTION_THRESHOLD_MS) {
    return buildDispatchFeed(world, events, formatLine);
  }

  const highEvents: SimEvent[] = [];
  const mediumBuckets = new Map<string, MediumBucket>();
  let incomeFunding = 0;
  let incomeAt: Millis = 0;
  let suppressedLow = 0;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const importance = resolveEventImportance(world, event);

    if (importance === 'high') {
      highEvents.push(event);
      continue;
    }

    if (importance === 'medium') {
      const category = mediumCompactionCategory(event);
      const factionId = factionIdFromEvent(event);
      if (!category || !factionId) continue;

      const key = `${factionId}:${category}`;
      const existing = mediumBuckets.get(key);
      if (existing) {
        existing.count += 1;
        continue;
      }

      mediumBuckets.set(key, {
        factionId,
        category,
        count: 1,
        firstAt: eventAt(event),
        firstIndex: i,
      });
      continue;
    }

    if (event.kind === 'income') {
      incomeFunding += event.funding;
      incomeAt = eventAt(event);
      continue;
    }

    suppressedLow += 1;
  }

  const highFeed = buildDispatchFeed(world, highEvents, formatLine);

  type TimedItem = { at: Millis; index: number; item: DispatchFeedItem };
  const timed: TimedItem[] = highFeed.map((item, index) => ({
    at: eventAt(item.event),
    index,
    item,
  }));

  for (const bucket of mediumBuckets.values()) {
    timed.push({
      at: bucket.firstAt,
      index: bucket.firstIndex,
      item: {
        key: `compact-${bucket.factionId}:${bucket.category}`,
        event: events[bucket.firstIndex],
        line: formatMediumSummary(world, bucket),
      },
    });
  }

  if (incomeFunding > 0) {
    timed.push({
      at: incomeAt,
      index: events.length,
      item: {
        key: 'compact-income',
        event: {
          kind: 'income',
          at: incomeAt,
          funding: incomeFunding,
          resourcesByTerritory: {},
          importance: 'low',
        },
        line: `INCOME — +$${Math.floor(incomeFunding).toLocaleString()} funding accrued while away`,
      },
    });
  }

  timed.sort((a, b) => a.at - b.at || a.index - b.index);

  let items = timed.map((entry) => entry.item);
  let foldedCount = suppressedLow;
  for (const bucket of mediumBuckets.values()) {
    foldedCount += bucket.count - 1;
  }
  const incomeEventCount = events.filter((event) => event.kind === 'income').length;
  if (incomeEventCount > 1) {
    foldedCount += incomeEventCount - 1;
  }

  if (countFeedLines(items) > DISPATCH_LINE_CAP) {
    const summaries = timed.filter(
      (entry) => entry.item.key.startsWith('compact-') && entry.item.key !== 'compact-income',
    );
    summaries.sort((a, b) => {
      const bucketA = mediumBuckets.get(bucketKeyFromFeedKey(a.item.key));
      const bucketB = mediumBuckets.get(bucketKeyFromFeedKey(b.item.key));
      return (
        SUMMARY_DROP_PRIORITY[bucketA?.category ?? 'repositioning'] -
        SUMMARY_DROP_PRIORITY[bucketB?.category ?? 'repositioning']
      );
    });

    while (countFeedLines(items) > DISPATCH_LINE_CAP - 1 && summaries.length > 0) {
      const removed = summaries.shift();
      if (!removed) break;
      const bucketKey = bucketKeyFromFeedKey(removed.item.key);
      const bucket = mediumBuckets.get(bucketKey);
      if (bucket) {
        foldedCount += bucket.count;
        mediumBuckets.delete(bucketKey);
      }
      items = items.filter((item) => item.key !== removed.item.key);
    }
  }

  if (foldedCount > 0 && countFeedLines(items) < DISPATCH_LINE_CAP) {
    const anchor = events[events.length - 1];
    items.push({
      key: 'compact-overflow',
      event: anchor,
      line: `…and ${foldedCount} other movements`,
    });
  }

  return items;
}

export function renderCompactDigestText(
  world: WorldState,
  events: SimEvent[],
  windowMs: number,
  formatLine?: (event: SimEvent, world: WorldState) => string,
): string {
  const feed = compactDispatchFeed(world, events, windowMs, formatLine);
  return feed.flatMap((item) => (item.header ? [item.header, item.line] : [item.line])).join('\n');
}

export function renderDigestText(
  world: WorldState,
  events: SimEvent[],
  windowMs?: number,
): string {
  const feed =
    windowMs !== undefined && windowMs > COMPACTION_THRESHOLD_MS
      ? compactDispatchFeed(world, events, windowMs)
      : buildDispatchFeed(world, events);
  return feed.flatMap((item) => (item.header ? [item.header, item.line] : [item.line])).join('\n');
}

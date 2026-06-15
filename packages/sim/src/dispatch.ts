import type { Id, Millis, Order, OrderIntent, SimEvent, WorldState } from './types';
import { isTerritoryVisible } from './visibility';
import {
  formatBattleNarrative,
  formatProductionNarrative,
  formatSecuredNarrative,
  formatWithdrawalNarrative,
} from './reports';

const ACTIONABLE_KINDS = new Set<Order['kind']>(['move', 'build', 'upgradeInfra']);

/** Deterministic beat id from faction + AI decision tick + intel source (seed-safe). */
export function computeBeatId(
  factionId: Id,
  decisionTickMs: Millis,
  source: IntelSource = 'direct',
): string {
  let hash = 2_166_136_261;
  const input = `${factionId}:${decisionTickMs}:${source}`;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 1_677_761_9);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function intentFromMoveStance(
  stance: 'assault' | 'secure' | 'hold',
  ownerId: Id,
  toTerritoryId: Id,
  world: WorldState,
): OrderIntent {
  if (stance === 'assault') return 'attack';
  if (stance === 'secure') return 'expand';
  const destOwner = world.territories[toTerritoryId]?.ownerId;
  if (destOwner && destOwner !== ownerId) return 'attack';
  return 'defend';
}

export function assertActionableOrderTagged(order: Order): void {
  if (!ACTIONABLE_KINDS.has(order.kind)) return;
  const tagged = order as Order & { intent?: OrderIntent; beatId?: string; decisionTickMs?: Millis };
  if (!tagged.intent) {
    throw new Error(`Order missing required intent: ${order.kind}`);
  }
  if (!tagged.beatId) {
    throw new Error(`Order missing required beatId: ${order.kind}`);
  }
  if (tagged.decisionTickMs === undefined) {
    throw new Error(`Order missing required decisionTickMs: ${order.kind}`);
  }
}

function factionName(world: WorldState, factionId: Id): string {
  const leaderId = world.factions[factionId]?.leaderId;
  return world.leaders[leaderId ?? '']?.name ?? factionId;
}

function territoryName(world: WorldState, territoryId: Id): string {
  return world.territories[territoryId]?.name ?? territoryId;
}

function isPlayerFaction(world: WorldState, factionId: Id): boolean {
  return world.factions[factionId]?.isPlayer === true;
}

function subject(world: WorldState, factionId: Id): string {
  return isPlayerFaction(world, factionId) ? 'Your' : factionName(world, factionId);
}

/** Mechanical intent phrasing for move departures. */
export function formatIntentDepartureLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'departure' }>,
): string {
  const who = subject(world, event.ownerId);
  const from = territoryName(world, event.fromTerritoryId);
  const to = territoryName(world, event.toTerritoryId);
  const prefix = isPlayerFaction(world, event.ownerId) ? 'DEPARTURE' : 'INTEL';

  switch (event.intent) {
    case 'attack':
      return `${prefix} — ${who} forces advancing from ${from} toward ${to}`;
    case 'defend':
      return `${prefix} — ${who} forces repositioning to ${to}`;
    case 'expand':
      return `${prefix} — ${who} forces moving to claim ${to}`;
    case 'build':
      return `${prefix} — ${who} forces redeploying to ${to}`;
  }
}

export function formatIntentArrivalLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'arrival' }>,
): string {
  const who = subject(world, event.ownerId);
  const place = territoryName(world, event.territoryId);
  const prefix = isPlayerFaction(world, event.ownerId) ? 'ARRIVAL' : 'INTEL';

  switch (event.intent) {
    case 'attack':
      return `${prefix} — ${who} forces arrived at ${place} — contact expected`;
    case 'defend':
      return `${prefix} — ${who} forces arrived at ${place}`;
    case 'expand':
      return `${prefix} — ${who} forces arrived to claim ${place}`;
    case 'build':
      return `${prefix} — ${who} forces arrived at ${place}`;
  }
}

export function formatBuildStartedLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'buildStarted' }>,
): string {
  const place = territoryName(world, event.territoryId);
  const who = subject(world, event.factionId);
  const prefix = isPlayerFaction(world, event.factionId) ? 'PRODUCTION' : 'INTEL';
  return `${prefix} — Construction begun at ${place} (${who})`;
}

export function formatInfraUpgradedLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'infraUpgraded' }>,
): string {
  const place = territoryName(world, event.territoryId);
  const who = subject(world, event.factionId);
  const prefix = isPlayerFaction(world, event.factionId) ? 'BUILD' : 'INTEL';
  return `${prefix} — Infrastructure upgraded at ${place} (${who})`;
}

/** Mechanical scout phrasing — predictable forms for cold-read tests. */
export function formatIntelReportLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'intelReport' }>,
): string {
  const place = territoryName(world, event.territoryId);
  const prefix = 'INTEL';

  switch (event.variant) {
    case 'construction':
      return `${prefix} — Scouts report construction at ${place}`;
    case 'massing': {
      const who = event.subjectFactionId
        ? factionName(world, event.subjectFactionId)
        : 'enemy';
      return `${prefix} — Scouts report ${who} forces massing at ${place}`;
    }
    case 'activity': {
      const who = event.subjectFactionId
        ? factionName(world, event.subjectFactionId)
        : 'enemy';
      return `${prefix} — Scouts report ${who} activity at ${place}`;
    }
  }
}

export interface DispatchFeedItem {
  key: string;
  header?: string;
  event: SimEvent;
  line: string;
}

export function dispatchLineForEvent(world: WorldState, event: SimEvent): string {
  switch (event.kind) {
    case 'departure':
      return formatIntentDepartureLine(world, event);
    case 'arrival':
      return formatIntentArrivalLine(world, event);
    case 'buildStarted':
      return formatBuildStartedLine(world, event);
    case 'infraUpgraded':
      return formatInfraUpgradedLine(world, event);
    case 'intelReport':
      return formatIntelReportLine(world, event);
    case 'battle':
      return event.report.narrative || formatBattleNarrative(event.report, world, event.territoryId);
    case 'withdrawal':
      return formatWithdrawalNarrative(
        world,
        event.territoryId,
        event.factionId,
        event.toTerritoryId,
        event.destroyed,
        event.defenderLosses,
        event.attackerLosses,
        event.underFire,
      );
    case 'secured':
      return formatSecuredNarrative(world, event.territoryId, event.factionId, event.enemyWithdrew);
    case 'income':
      return `INCOME — funding ${event.funding}`;
    case 'production':
      return formatProductionNarrative(world, event);
    case 'buildBlocked':
      return `BLOCKED — ${event.reason}`;
    default:
      return `${event.kind} event`;
  }
}

/** Flatten events into render rows; beat-tagged events share a header on first row. */
export function buildDispatchFeed(
  world: WorldState,
  events: SimEvent[],
  formatLine: (event: SimEvent, world: WorldState) => string = (event, w) =>
    dispatchLineForEvent(w, event),
): DispatchFeedItem[] {
  const beats = groupEventsByBeat(world, events);
  const beatById = new Map(beats.map((beat) => [beat.beatId, beat]));
  const beatHeaderShown = new Set<string>();
  const items: DispatchFeedItem[] = [];

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const line = formatLine(event, world);
    const beatId = 'beatId' in event ? event.beatId : undefined;
    const beat = beatId ? beatById.get(beatId) : undefined;
    let header: string | undefined;

    if (beat && beatId && !beatHeaderShown.has(beatId)) {
      header = beat.header;
      beatHeaderShown.add(beatId);
    }

    items.push({
      key: `${i}-${event.kind}-${'at' in event ? event.at : i}`,
      header,
      event,
      line,
    });
  }

  return items;
}

export function beatHeader(world: WorldState, factionId: Id, decisionTickMs: Millis): string {
  const who = factionName(world, factionId);
  return `${who} — tick ${decisionTickMs}`;
}

export interface DispatchBeatGroup {
  beatId: string;
  factionId: Id;
  decisionTickMs: Millis;
  header: string;
  events: SimEvent[];
}

export function groupEventsByBeat(world: WorldState, events: SimEvent[]): DispatchBeatGroup[] {
  const groups = new Map<string, DispatchBeatGroup>();

  for (const event of events) {
    if (!('beatId' in event) || !event.beatId) continue;
    const beatId = event.beatId;
    const factionId =
      'observerFaction' in event
        ? event.observerFaction
        : 'ownerId' in event
          ? event.ownerId
          : 'factionId' in event
            ? event.factionId
            : undefined;
    const decisionTickMs = 'decisionTickMs' in event ? event.decisionTickMs : undefined;
    if (!factionId || decisionTickMs === undefined) continue;

    const existing = groups.get(beatId);
    if (existing) {
      existing.events.push(event);
      continue;
    }
    groups.set(beatId, {
      beatId,
      factionId,
      decisionTickMs,
      header: beatHeader(world, factionId, decisionTickMs),
      events: [event],
    });
  }

  return [...groups.values()];
}

export function taggedOrderFields(
  factionId: Id,
  decisionTickMs: Millis,
  intent: OrderIntent,
): { intent: OrderIntent; beatId: string; decisionTickMs: Millis } {
  return {
    intent,
    beatId: computeBeatId(factionId, decisionTickMs),
    decisionTickMs,
  };
}

export function playerFactionId(world: WorldState): Id | undefined {
  return Object.values(world.factions).find((faction) => faction.isPlayer)?.id;
}

/**
 * Whether a dispatch line is legible to `factionId`.
 * Private intel reports stay with the observing faction; enemy activity requires sight.
 */
export function isDispatchVisibleToFaction(
  world: WorldState,
  event: SimEvent,
  factionId: Id,
): boolean {
  switch (event.kind) {
    case 'intelReport':
      return event.observerFaction === factionId;

    case 'income':
      return true;

    case 'departure':
      if (event.ownerId === factionId) return true;
      return (
        isTerritoryVisible(world, factionId, event.fromTerritoryId) ||
        isTerritoryVisible(world, factionId, event.toTerritoryId)
      );

    case 'arrival':
      if (event.ownerId === factionId) return true;
      return (
        isTerritoryVisible(world, factionId, event.territoryId) ||
        isTerritoryVisible(world, factionId, event.fromTerritoryId)
      );

    case 'buildStarted':
    case 'infraUpgraded':
    case 'production':
    case 'buildBlocked':
      if ('factionId' in event && event.factionId === factionId) return true;
      return isTerritoryVisible(world, factionId, event.territoryId);

    case 'battle':
    case 'withdrawal':
    case 'secured':
      return isTerritoryVisible(world, factionId, event.territoryId);

    default:
      return true;
  }
}

/** Player/AI-facing dispatch feed — not the global sim event log. */
export function filterDispatchesForFaction(
  world: WorldState,
  events: SimEvent[],
  factionId: Id,
): SimEvent[] {
  return events.filter((event) => isDispatchVisibleToFaction(world, event, factionId));
}

import type { Id, IntelSource, Millis, Order, OrderIntent, SimEvent, WorldState } from './types';
import { findCountry } from './country';
import { formatOrderRejectedMessage } from './movement';
import { isTerritoryVisible } from './visibility';
import { isTreatyParty, otherParty } from './diplomaticDispatch';
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

/** Territory name with owning country (or unclaimed) for dispatch readability. */
function territoryLabelWithOwner(world: WorldState, territoryId: Id): string {
  const name = territoryName(world, territoryId);
  const ownerId = world.territories[territoryId]?.ownerId;
  if (!ownerId) return `${name} (unclaimed)`;
  const country = findCountry(world, ownerId);
  if (country) return `${name} (${country.name})`;
  const leaderId = world.factions[ownerId]?.leaderId;
  const region = world.leaders[leaderId ?? '']?.region;
  if (region) return `${name} (${region})`;
  return name;
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
  const from = territoryLabelWithOwner(world, event.fromTerritoryId);
  const to = territoryLabelWithOwner(world, event.toTerritoryId);
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
  const place = territoryLabelWithOwner(world, event.territoryId);
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
  const place = territoryLabelWithOwner(world, event.territoryId);
  const who = subject(world, event.factionId);
  const prefix = isPlayerFaction(world, event.factionId) ? 'PRODUCTION' : 'INTEL';
  return `${prefix} — Construction begun at ${place} (${who})`;
}

export function formatInfraUpgradedLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'infraUpgraded' }>,
): string {
  const place = territoryLabelWithOwner(world, event.territoryId);
  const who = subject(world, event.factionId);
  const prefix = isPlayerFaction(world, event.factionId) ? 'BUILD' : 'INTEL';
  return `${prefix} — Infrastructure upgraded at ${place} (${who})`;
}

/** Mechanical scout / allied / treaty phrasing — predictable forms for cold-read tests. */
export function formatIntelReportLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'intelReport' }>,
): string {
  const place = territoryLabelWithOwner(world, event.territoryId);
  const prefix = 'INTEL';

  if (event.source === 'allied') {
    const ally = factionName(world, event.observerFaction);
    const who = event.subjectFactionId
      ? factionName(world, event.subjectFactionId)
      : 'enemy';
    switch (event.variant) {
      case 'construction':
        return `${prefix} — ${ally}'s forces report construction at ${place}`;
      case 'massing':
        return `${prefix} — ${ally}'s forces report ${who} forces massing at ${place}`;
      case 'activity':
        return `${prefix} — ${ally}'s forces report ${who} activity at ${place}`;
    }
  }

  if (event.source === 'treaty') {
    const who = event.subjectFactionId
      ? factionName(world, event.subjectFactionId)
      : 'enemy';
    const descriptor = event.garrisonDescriptor ?? 'activity';
    if (event.variant === 'massing' || event.variant === 'construction') {
      return `${prefix} — Per treaty, ${who} activity at ${place}: ${descriptor}`;
    }
    return `${prefix} — Per treaty, ${who} garrison at ${place}: ${descriptor}`;
  }

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

export function formatAllianceFormedLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'allianceFormed' }>,
  viewingFaction?: Id,
): string {
  const [a, b] = event.parties;
  if (viewingFaction && (viewingFaction === a || viewingFaction === b)) {
    const other = otherParty(event.parties, viewingFaction);
    return `DIPLOMACY — Alliance formed with ${factionName(world, other)}.`;
  }
  return `DIPLOMACY — ${factionName(world, a)} and ${factionName(world, b)} have formed an alliance.`;
}

export function formatAllianceBrokenLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'allianceBroken' }>,
  viewingFaction?: Id,
): string {
  const breaker = factionName(world, event.breaker);
  const betrayed = factionName(world, event.betrayed);
  if (viewingFaction === event.betrayed) {
    return `DIPLOMACY — ${breaker} has broken our alliance.`;
  }
  return `DIPLOMACY — ${breaker} has broken alliance with ${betrayed}.`;
}

export function formatTreatyFormedLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'treatyFormed' }>,
  viewingFaction?: Id,
): string {
  const scopeCount = event.territoryIds.length;
  const hours = Math.round((event.expiresAt - event.at) / 3_600_000);
  if (viewingFaction && (viewingFaction === event.parties[0] || viewingFaction === event.parties[1])) {
    const other = otherParty(event.parties, viewingFaction);
    return `DIPLOMACY — Treaty formed with ${factionName(world, other)} covering ${scopeCount} ${scopeCount === 1 ? 'territory' : 'territories'} until +${hours}h.`;
  }
  return `DIPLOMACY — Treaty formed (${scopeCount} territories, +${hours}h).`;
}

export function formatTreatyExpiredLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'treatyExpired' }>,
  viewingFaction?: Id,
): string {
  if (viewingFaction && (viewingFaction === event.parties[0] || viewingFaction === event.parties[1])) {
    const other = otherParty(event.parties, viewingFaction);
    return `DIPLOMACY — Treaty with ${factionName(world, other)} has expired.`;
  }
  return `DIPLOMACY — Treaty has expired.`;
}

function hoursUntil(expiresAt: Millis, at: Millis): number {
  return Math.max(1, Math.round((expiresAt - at) / 3_600_000));
}

function formatAllyArrivalPeacefulLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'allyArrivalPeaceful' }>,
): string {
  const allyName = factionName(world, event.allyFactionId);
  const place = territoryLabelWithOwner(world, event.territoryId);
  const origin = territoryLabelWithOwner(world, event.fromTerritoryId);
  return `DIPLOMACY — Forces from ${allyName} arrived at ${place} — peaceful, returned to ${origin}.`;
}

function formatDispatchCancelledByAllianceLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'dispatchCancelledByAlliance' }>,
): string {
  const allyName = factionName(world, event.allyFactionId);
  return `DIPLOMACY — Order cancelled — alliance with ${allyName} formed mid-transit.`;
}

function formatOrderRedirectedToAllyLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'orderRedirectedToAlly' }>,
): string {
  const allyName = factionName(world, event.newOwnerId);
  const place = territoryLabelWithOwner(world, event.territoryId);
  return `DIPLOMACY — Assault cancelled — ${place} now held by allied ${allyName}.`;
}

export function formatAllianceProposedLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'allianceProposed' }>,
): string {
  const proposer = factionName(world, event.from);
  const hours = hoursUntil(event.expiresAt, event.at);
  return `DIPLOMACY — ${proposer} proposes alliance. (Expires in ${hours}h.)`;
}

export function formatAllianceDeclinedLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'allianceDeclined' }>,
  viewingFaction?: Id,
): string {
  const other = event.declinedBy === event.from ? event.to : event.from;
  const otherName = factionName(world, other);
  if (viewingFaction === event.declinedBy) {
    return `DIPLOMACY — You declined alliance with ${otherName}.`;
  }
  return `DIPLOMACY — ${factionName(world, event.declinedBy)} declined alliance with ${otherName}.`;
}

export function formatTreatyProposedLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'treatyProposed' }>,
): string {
  const proposer = factionName(world, event.from);
  const place = territoryLabelWithOwner(world, event.territoryIds[0] ?? '');
  const hours = hoursUntil(event.expiresAt, event.at);
  return `DIPLOMACY — ${proposer} proposes intel treaty on ${place}. (Expires in ${hours}h.)`;
}

export function formatTreatyDeclinedLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'treatyDeclined' }>,
  viewingFaction?: Id,
): string {
  const other = event.declinedBy === event.from ? event.to : event.from;
  const otherName = factionName(world, other);
  if (viewingFaction === event.declinedBy) {
    return `DIPLOMACY — You declined treaty with ${otherName}.`;
  }
  return `DIPLOMACY — ${factionName(world, event.declinedBy)} declined treaty with ${otherName}.`;
}

export function formatCapitalRelocatedLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'capitalRelocated' }>,
): string {
  const country = findCountry(world, event.countryId);
  const countryLabel = country?.name ?? event.countryId;
  const oldName = territoryLabelWithOwner(world, event.oldCapitalTerritoryId);
  const newName = territoryLabelWithOwner(world, event.newCapitalTerritoryId);
  return `Capital of ${countryLabel} relocated from ${oldName} to ${newName}.`;
}

export function formatCountryDefeatedLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'countryDefeated' }>,
): string {
  const country = findCountry(world, event.countryId);
  const countryLabel = country?.name ?? event.countryId;
  const leader = world.factions[event.countryId]?.leaderId
    ? (world.leaders[world.factions[event.countryId]!.leaderId]?.name ??
      factionName(world, event.countryId))
    : factionName(world, event.countryId);
  const finalCity = territoryLabelWithOwner(world, event.finalTerritoryId);
  return `${countryLabel} has fallen. ${leader}'s reign ends at ${finalCity}.`;
}

export interface DispatchFeedItem {
  key: string;
  header?: string;
  event: SimEvent;
  line: string;
}

export function dispatchLineForEvent(
  world: WorldState,
  event: SimEvent,
  viewingFaction?: Id,
): string {
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
    case 'allianceFormed':
      return formatAllianceFormedLine(world, event, viewingFaction);
    case 'allianceBroken':
      return formatAllianceBrokenLine(world, event, viewingFaction);
    case 'treatyFormed':
      return formatTreatyFormedLine(world, event, viewingFaction);
    case 'treatyExpired':
      return formatTreatyExpiredLine(world, event, viewingFaction);
    case 'allianceProposed':
      return formatAllianceProposedLine(world, event);
    case 'allianceDeclined':
      return formatAllianceDeclinedLine(world, event, viewingFaction);
    case 'treatyProposed':
      return formatTreatyProposedLine(world, event);
    case 'treatyDeclined':
      return formatTreatyDeclinedLine(world, event, viewingFaction);
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
    case 'orderRejected':
      return `REJECTED — ${formatOrderRejectedMessage(event.reason)}`;
    case 'tutorialGraduated':
      return 'Your tutorial is complete. Your full campaign begins now.';
    case 'allyArrivalPeaceful':
      return formatAllyArrivalPeacefulLine(world, event);
    case 'dispatchCancelledByAlliance':
      return formatDispatchCancelledByAllianceLine(world, event);
    case 'orderRedirectedToAlly':
      return formatOrderRedirectedToAllyLine(world, event);
    case 'capitalRelocated':
      return formatCapitalRelocatedLine(world, event);
    case 'countryDefeated':
      return formatCountryDefeatedLine(world, event);
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
  viewingFaction?: Id,
): DispatchFeedItem[] {
  const beats = groupEventsByBeat(world, events);
  const beatById = new Map(beats.map((beat) => [beat.beatId, beat]));
  const beatHeaderShown = new Set<string>();
  const items: DispatchFeedItem[] = [];
  const lineFor = formatLine;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const line =
      viewingFaction !== undefined
        ? dispatchLineForEvent(world, event, viewingFaction)
        : lineFor(event, world);
    const beatId = 'beatId' in event ? event.beatId : undefined;
    const beat = beatId ? beatById.get(beatId) : undefined;
    let header: string | undefined;

    if (beat && beatId && !beatHeaderShown.has(beatId)) {
      header = beat.header;
      beatHeaderShown.add(beatId);
    }

    items.push({
      key: event.eventId,
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
    let factionId: Id | undefined;
    switch (event.kind) {
      case 'intelReport':
        factionId = event.receiverFaction ?? event.observerFaction;
        break;
      case 'allianceFormed':
        factionId = event.initiatingFaction;
        break;
      case 'allianceBroken':
        factionId = event.breaker;
        break;
      case 'treatyFormed':
        factionId = event.initiatingFaction;
        break;
      case 'treatyExpired':
        factionId = event.parties[0];
        break;
      case 'allianceProposed':
      case 'treatyProposed':
        factionId = event.from;
        break;
      case 'allianceDeclined':
      case 'treatyDeclined':
        factionId = event.declinedBy;
        break;
      default: {
        const tagged = event as SimEvent & {
          observerFaction?: Id;
          ownerId?: Id;
          factionId?: Id;
        };
        factionId = tagged.observerFaction ?? tagged.ownerId ?? tagged.factionId;
      }
    }
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
      return (event.receiverFaction ?? event.observerFaction) === factionId;

    case 'allianceFormed':
    case 'allianceBroken':
    case 'capitalRelocated':
    case 'countryDefeated':
      return true;

    case 'treatyFormed':
    case 'treatyExpired':
      return isTreatyParty(event, factionId);

    case 'allianceProposed':
    case 'treatyProposed':
      return event.to === factionId;

    case 'allianceDeclined':
    case 'treatyDeclined':
      return event.from === factionId || event.to === factionId;

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

    case 'orderRejected':
      return event.factionId === factionId;

    case 'battle':
    case 'withdrawal':
    case 'secured':
      return isTerritoryVisible(world, factionId, event.territoryId);

    case 'allyArrivalPeaceful':
    case 'dispatchCancelledByAlliance':
      return event.factionId === factionId;

    case 'orderRedirectedToAlly':
      return event.orderingFactionId === factionId;

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

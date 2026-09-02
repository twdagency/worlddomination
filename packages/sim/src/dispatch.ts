import type { Id, Millis, Order, OrderIntent, ResourceId, SimEvent, WorldState } from './types';
import { computeBeatId } from './beatId';
import { isTreatyParty } from './diplomaticEvents';
import {
  formatAllianceBrokenLine,
  formatAllianceDeclinedLine,
  formatAllianceFormedLine,
  formatAllianceProposedLine,
  formatAllyArrivalPeacefulLine,
  formatBuildStartedLine,
  formatCapitalRelocatedLine,
  formatCountryDefeatedLine,
  formatVictoryLine,
  formatCoupFailureLine,
  formatCoupSuccessLine,
  formatCulturalCampaignLine,
  formatDefectionOccurredLine,
  formatDiplomaticMissionExpiredLine,
  formatDiplomaticMissionExpelledLine,
  formatDiplomaticMissionLine,
  formatDiplomaticPressureLine,
  formatDispatchCancelledByAllianceLine,
  formatInfraUpgradedLine,
  formatIntelReportLine,
  formatIntentArrivalLine,
  formatIntentDepartureLine,
  formatOrderRedirectedToAllyLine,
  formatSubversionAppliedLine,
  formatSubversionDiscoveredLine,
  formatTreatyDeclinedLine,
  formatTreatyExpiredLine,
  formatTreatyFormedLine,
  formatTreatyProposedLine,
  formatTributeAccruedLine,
  formatTributeAutoEndedLine,
  formatTributeMajorRebellionLine,
  formatTributeMinorRebellionLine,
  formatTributeStartedLine,
  formatTributeVoluntarilyEndedLine,
} from './diplomaticDispatchLines';
import { factionName } from './dispatchFormatHelpers';
import {
  formatDiplomaticPressureProposalLabel,
  formatInfluenceOrderRejectedMessage,
} from './influenceOrderMessages';
import { formatOrderRejectedMessage } from './movement';
import { isTerritoryVisible } from './visibility';
import {
  formatBattleNarrative,
  formatProductionNarrative,
  formatSecuredNarrative,
  formatWithdrawalNarrative,
} from './reports';

export { computeBeatId } from './beatId';
export {
  formatAllianceBrokenLine,
  formatAllianceDeclinedLine,
  formatAllianceFormedLine,
  formatAllianceProposedLine,
  formatBuildStartedLine,
  formatInfraUpgradedLine,
  formatIntelReportLine,
  formatIntentArrivalLine,
  formatIntentDepartureLine,
  formatTreatyDeclinedLine,
  formatTreatyExpiredLine,
  formatTreatyFormedLine,
  formatTreatyProposedLine,
} from './diplomaticDispatchLines';

const ACTIONABLE_KINDS = new Set<Order['kind']>(['move', 'build', 'upgradeInfra']);

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

export interface DispatchFeedItem {
  key: string;
  header?: string;
  event: SimEvent;
  line: string;
}

export function hasDisplayableResourceAccrual(
  byTerritory: Record<Id, Partial<Record<ResourceId, number>>>,
): boolean {
  for (const territoryResources of Object.values(byTerritory)) {
    if (!territoryResources) continue;
    for (const amount of Object.values(territoryResources)) {
      if (amount && Math.floor(amount) > 0) return true;
    }
  }
  return false;
}

export function formatResourceAccruals(
  byTerritory: Record<Id, Partial<Record<ResourceId, number>>>,
): string[] {
  const aggregated: Record<string, number> = {};
  for (const territoryResources of Object.values(byTerritory)) {
    if (!territoryResources) continue;
    for (const [resource, amount] of Object.entries(territoryResources)) {
      if (!amount || amount <= 0) continue;
      aggregated[resource] = (aggregated[resource] ?? 0) + amount;
    }
  }

  return Object.entries(aggregated)
    .map(([resource, amount]) => ({ resource, floored: Math.floor(amount) }))
    .filter(({ floored }) => floored > 0)
    .map(({ resource, floored }) => `+${floored} ${resource}`);
}

export function hasDisplayableIncome(event: Extract<SimEvent, { kind: 'income' }>): boolean {
  if (Math.floor(event.funding) > 0) return true;
  return hasDisplayableResourceAccrual(event.resourcesByTerritory);
}

export function formatIncomeDispatchLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'income' }>,
): string {
  void world;
  const fundingFloor = Math.floor(event.funding);
  const parts: string[] = [];

  if (fundingFloor > 0) {
    parts.push(`+$${fundingFloor.toLocaleString()} funding`);
  }

  parts.push(...formatResourceAccruals(event.resourcesByTerritory));

  if (parts.length === 0) {
    return 'INCOME — minimal accrual';
  }

  return `INCOME — ${parts.join(', ')} accrued while away`;
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
      return formatIncomeDispatchLine(world, event);
    case 'production':
      return formatProductionNarrative(world, event);
    case 'buildBlocked':
      return `BLOCKED — ${event.reason}`;
    case 'orderRejected': {
      const formatter = event.influenceOrderKind
        ? formatInfluenceOrderRejectedMessage
        : formatOrderRejectedMessage;
      return `REJECTED — ${formatter(event.reason)}`;
    }
    case 'diplomaticMissionStarted':
      return formatDiplomaticMissionLine(world, event);
    case 'diplomaticMissionExpired':
      return formatDiplomaticMissionExpiredLine(world, event);
    case 'diplomaticMissionExpelled':
      return formatDiplomaticMissionExpelledLine(world, event);
    case 'culturalCampaignApplied':
      return formatCulturalCampaignLine(world, event);
    case 'subversionApplied':
      return formatSubversionAppliedLine(world, event);
    case 'subversionDiscovered':
      return formatSubversionDiscoveredLine(world, event);
    case 'diplomaticPressureApplied':
      return formatDiplomaticPressureLine(
        world,
        event,
        formatDiplomaticPressureProposalLabel(event.proposalKind),
      );
    case 'tributeStarted':
      return formatTributeStartedLine(world, event);
    case 'tributeAccrued':
      return formatTributeAccruedLine(world, event);
    case 'tributeMinorRebellion':
      return formatTributeMinorRebellionLine(world, event);
    case 'tributeMajorRebellion':
      return formatTributeMajorRebellionLine(world, event);
    case 'tributeAutoEnded':
      return formatTributeAutoEndedLine(world, event);
    case 'tributeVoluntarilyEnded':
      return formatTributeVoluntarilyEndedLine(world, event);
    case 'coupSuccess':
      return formatCoupSuccessLine(world, event);
    case 'coupFailure':
      return formatCoupFailureLine(world, event);
    case 'defectionOccurred':
      return formatDefectionOccurredLine(world, event);
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
    case 'victory':
      return formatVictoryLine(world, event);
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
    case 'victory':
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

    case 'subversionApplied':
      return event.ownerId === factionId;

    case 'diplomaticMissionStarted':
    case 'diplomaticMissionExpired':
    case 'diplomaticMissionExpelled':
    case 'culturalCampaignApplied':
    case 'subversionDiscovered':
      return true;

    case 'diplomaticPressureApplied':
      return true;

    case 'tributeAccrued':
      return event.actorId === factionId;

    case 'tributeStarted':
    case 'tributeMinorRebellion':
    case 'tributeMajorRebellion':
    case 'tributeAutoEnded':
    case 'tributeVoluntarilyEnded':
      return true;

    case 'coupSuccess':
    case 'coupFailure':
    case 'defectionOccurred':
      return true;

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

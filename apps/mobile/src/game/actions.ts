import {
  advanceTo,
  buildDispatchFeed,
  compactDispatchFeed,
  COMPACTION_THRESHOLD_MS,
  dispatchLineForEvent,
  filterDispatchesForFaction,
  formatBattleNarrative,
  formatBuildStartedLine,
  formatInfraUpgradedLine,
  formatIntentArrivalLine,
  formatIntentDepartureLine,
  formatIntelReportLine,
  formatProductionNarrative,
  formatSecuredNarrative,
  formatWithdrawalNarrative,
  intentFromMoveStance,
  nextEventMs,
  taggedOrderFields,
  tick,
} from 'sim';
import type { DispatchFeedItem, SimEvent, WorldState } from 'sim';
import type { TransitOrder } from 'sim';
import { resolvePlayerFactionId } from 'shared';
import { resolvePressureOrderFields, type InfluenceOrderActionKind } from './influenceSelector';

export { type InfluenceOrderActionKind };

export function mergeDispatches(
  world: WorldState,
  existing: SimEvent[],
  incoming: SimEvent[],
): SimEvent[] {
  const playerId = resolvePlayerFactionId(world);
  if (!playerId) return existing;
  const visible = filterDispatchesForFaction(world, incoming, playerId);
  return [...existing, ...visible].slice(-100);
}

export function catchUp(world: WorldState, targetMs: number = Date.now()): {
  world: WorldState;
  events: SimEvent[];
} {
  return advanceTo(world, targetMs);
}

export function issueMove(
  world: WorldState,
  unitId: string,
  toTerritoryId: string,
  stanceOnArrival: TransitOrder['stanceOnArrival'] = 'assault',
): { world: WorldState; events: SimEvent[] } {
  const playerId = resolvePlayerFactionId(world);
  if (!playerId) return { world, events: [] };

  const unit = world.units[unitId];
  const intent = intentFromMoveStance(
    stanceOnArrival,
    unit?.ownerId ?? playerId,
    toTerritoryId,
    world,
  );
  return tick(
    world,
    [
      {
        kind: 'move',
        unitId,
        toTerritoryId,
        stanceOnArrival,
        ...taggedOrderFields(playerId, world.nowMs, intent),
      },
    ],
    0,
  );
}

export function issueBuild(
  world: WorldState,
  territoryId: string,
  unitTypeId: string,
  count: number = 1,
): { world: WorldState; events: SimEvent[] } {
  const playerId = resolvePlayerFactionId(world);
  if (!playerId) return { world, events: [] };

  return tick(
    world,
    [
      {
        kind: 'build',
        territoryId,
        unitTypeId,
        count,
        ...taggedOrderFields(playerId, world.nowMs, 'build'),
      },
    ],
    0,
  );
}

export function issueUpgradeInfra(
  world: WorldState,
  territoryId: string,
): { world: WorldState; events: SimEvent[] } {
  const playerId = resolvePlayerFactionId(world);
  if (!playerId) return { world, events: [] };

  return tick(
    world,
    [
      {
        kind: 'upgradeInfra',
        territoryId,
        ...taggedOrderFields(playerId, world.nowMs, 'build'),
      },
    ],
    0,
  );
}

export function issueInfluenceOrder(
  world: WorldState,
  kind: InfluenceOrderActionKind,
  targetCityId: string,
): { world: WorldState; events: SimEvent[] } {
  const playerId = resolvePlayerFactionId(world);
  if (!playerId) return { world, events: [] };

  const tags = taggedOrderFields(playerId, world.nowMs, 'expand');

  if (kind === 'diplomatic-pressure') {
    const fields = resolvePressureOrderFields(world, playerId, targetCityId);
    if (!fields) return { world, events: [] };
    return tick(
      world,
      [
        {
          kind: 'diplomatic-pressure',
          ownerId: playerId,
          targetCityId,
          targetCountryId: fields.targetCountryId,
          proposalKind: fields.proposalKind,
          ...tags,
        },
      ],
      0,
    );
  }

  return tick(
    world,
    [
      {
        kind,
        ownerId: playerId,
        targetCityId,
        ...tags,
      },
    ],
    0,
  );
}

export function skipToNextEvent(world: WorldState): {
  world: WorldState;
  events: SimEvent[];
} | null {
  const target = nextEventMs(world);
  if (target === null) return null;
  return advanceTo(world, target);
}

function formatIncomeLine(
  event: Extract<SimEvent, { kind: 'income' }>,
  world: WorldState,
): string {
  const parts = [`+$${Math.floor(event.funding).toLocaleString()} funding`];
  for (const [territoryId, resources] of Object.entries(event.resourcesByTerritory)) {
    const place = world.territories[territoryId]?.name ?? territoryId;
    for (const [key, value] of Object.entries(resources)) {
      if (!value || value <= 0) continue;
      parts.push(`+${Math.floor(value)} ${key} at ${place}`);
    }
  }
  return `INCOME — ${parts.join(', ')} accrued while away`;
}

export function formatDispatchLine(event: SimEvent, world: WorldState): string {
  if (
    event.kind === 'allianceFormed' ||
    event.kind === 'allianceBroken' ||
    event.kind === 'treatyFormed' ||
    event.kind === 'treatyExpired' ||
    event.kind === 'allianceProposed' ||
    event.kind === 'allianceDeclined' ||
    event.kind === 'treatyProposed' ||
    event.kind === 'treatyDeclined'
  ) {
    const playerId = resolvePlayerFactionId(world);
    return dispatchLineForEvent(world, event, playerId);
  }

  if (event.kind === 'departure') {
    return formatIntentDepartureLine(world, event);
  }

  if (event.kind === 'arrival') {
    return formatIntentArrivalLine(world, event);
  }

  if (event.kind === 'buildStarted') {
    return formatBuildStartedLine(world, event);
  }

  if (event.kind === 'infraUpgraded') {
    return formatInfraUpgradedLine(world, event);
  }

  if (event.kind === 'intelReport') {
    return formatIntelReportLine(world, event);
  }

  if (event.kind === 'battle') {
    return event.report.narrative || formatBattleNarrative(event.report, world, event.territoryId);
  }

  if (event.kind === 'withdrawal') {
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
  }

  if (event.kind === 'secured') {
    return formatSecuredNarrative(world, event.territoryId, event.factionId, event.enemyWithdrew);
  }

  if (event.kind === 'income') {
    return formatIncomeLine(event, world);
  }

  if (event.kind === 'production') {
    return formatProductionNarrative(world, event);
  }

  if (event.kind === 'buildBlocked') {
    return `BLOCKED — ${event.reason}`;
  }

  if (event.kind === 'orderRejected') {
    return `REJECTED — ${event.reason === 'cannot-assault-own-territory' ? 'Cannot issue assault on own territory.' : event.reason}`;
  }

  const playerId = resolvePlayerFactionId(world);
  return dispatchLineForEvent(world, event, playerId ?? undefined);
}

export { buildDispatchFeed, compactDispatchFeed, COMPACTION_THRESHOLD_MS };
export type { DispatchFeedItem };

export function buildDisplayDispatchFeed(
  world: WorldState,
  events: SimEvent[],
  awayMs: number,
): DispatchFeedItem[] {
  const playerId = resolvePlayerFactionId(world);
  if (!playerId) return [];
  const visible = filterDispatchesForFaction(world, events, playerId);
  if (awayMs > COMPACTION_THRESHOLD_MS) {
    return compactDispatchFeed(world, visible, awayMs, formatDispatchLine);
  }
  return buildDispatchFeed(world, visible, formatDispatchLine);
}

export function isDispatchDetailEvent(
  event: SimEvent,
): event is Extract<SimEvent, { kind: 'battle' | 'withdrawal' | 'secured' }> {
  return event.kind === 'battle' || event.kind === 'withdrawal' || event.kind === 'secured';
}

export function isTimestampedDispatch(event: SimEvent): event is Extract<SimEvent, { at: number }> {
  return 'at' in event;
}

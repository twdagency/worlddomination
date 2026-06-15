import {
  advanceTo,
  buildDispatchFeed,
  formatBattleNarrative,
  formatBuildStartedLine,
  formatInfraUpgradedLine,
  formatIntentArrivalLine,
  formatIntentDepartureLine,
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

export function mergeDispatches(existing: SimEvent[], incoming: SimEvent[]): SimEvent[] {
  const combined = [...existing, ...incoming];
  return combined.slice(-100);
}

export function catchUp(world: WorldState, targetMs: number = Date.now()): {
  world: WorldState;
  events: SimEvent[];
} {
  return advanceTo(world, targetMs);
}

const PLAYER_FACTION = 'faction-player';

export function issueMove(
  world: WorldState,
  unitId: string,
  toTerritoryId: string,
  stanceOnArrival: TransitOrder['stanceOnArrival'] = 'assault',
): { world: WorldState; events: SimEvent[] } {
  const unit = world.units[unitId];
  const intent = intentFromMoveStance(
    stanceOnArrival,
    unit?.ownerId ?? PLAYER_FACTION,
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
        ...taggedOrderFields(PLAYER_FACTION, world.nowMs, intent),
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
  return tick(
    world,
    [
      {
        kind: 'build',
        territoryId,
        unitTypeId,
        count,
        ...taggedOrderFields(PLAYER_FACTION, world.nowMs, 'build'),
      },
    ],
    0,
  );
}

export function issueUpgradeInfra(
  world: WorldState,
  territoryId: string,
): { world: WorldState; events: SimEvent[] } {
  return tick(
    world,
    [
      {
        kind: 'upgradeInfra',
        territoryId,
        ...taggedOrderFields(PLAYER_FACTION, world.nowMs, 'build'),
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

  return `${event.kind} event`;
}

export { buildDispatchFeed };
export type { DispatchFeedItem };

export function isDispatchDetailEvent(
  event: SimEvent,
): event is Extract<SimEvent, { kind: 'battle' | 'withdrawal' | 'secured' }> {
  return event.kind === 'battle' || event.kind === 'withdrawal' || event.kind === 'secured';
}

export function isTimestampedDispatch(event: SimEvent): event is Extract<SimEvent, { at: number }> {
  return 'at' in event;
}

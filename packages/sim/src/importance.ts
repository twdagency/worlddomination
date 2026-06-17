export type { DispatchImportance } from './types';

import type { DispatchImportance, Id, OrderIntent, SimEvent, WorldState } from './types';

export const COMPACTION_THRESHOLD_MS = 12 * 60 * 60 * 1000;
export const DISPATCH_LINE_CAP = 40;

export function departureImportance(intent: OrderIntent): DispatchImportance {
  if (intent === 'attack' || intent === 'expand') return 'high';
  return 'medium';
}

export function arrivalImportance(
  world: WorldState,
  ownerId: Id,
  territoryId: Id,
  intent: OrderIntent,
): DispatchImportance {
  const destOwner = world.territories[territoryId]?.ownerId;
  const contested = destOwner !== undefined && destOwner !== ownerId;
  if (intent === 'attack' && contested) return 'high';
  if (intent === 'expand') return 'high';
  return 'low';
}

const HIGH_KINDS = new Set<SimEvent['kind']>([
  'battle',
  'withdrawal',
  'secured',
  'allianceFormed',
  'allianceBroken',
  'allianceProposed',
  'treatyProposed',
  'tutorialGraduated',
  'countryDefeated',
  'subversionDiscovered',
  'diplomaticPressureApplied',
  'tributeStarted',
  'tributeMinorRebellion',
  'tributeMajorRebellion',
  'coupSuccess',
  'coupFailure',
]);

const MEDIUM_KINDS = new Set<SimEvent['kind']>([
  'buildStarted',
  'infraUpgraded',
  'production',
  'buildBlocked',
  'orderRejected',
  'treatyFormed',
  'treatyExpired',
  'allianceDeclined',
  'treatyDeclined',
  'intelReport',
  'diplomaticMissionStarted',
  'diplomaticMissionExpelled',
  'culturalCampaignApplied',
  'tributeAutoEnded',
  'tributeVoluntarilyEnded',
]);

export function resolveEventImportance(world: WorldState, event: SimEvent): DispatchImportance {
  if ('importance' in event && event.importance) {
    return event.importance;
  }

  if (event.kind === 'departure') {
    return departureImportance(event.intent);
  }

  if (event.kind === 'arrival') {
    return arrivalImportance(world, event.ownerId, event.territoryId, event.intent);
  }

  if (HIGH_KINDS.has(event.kind)) return 'high';
  if (MEDIUM_KINDS.has(event.kind)) return 'medium';
  if (event.kind === 'income') return 'low';
  return 'low';
}

export function factionIdFromEvent(event: SimEvent): Id | undefined {
  if (event.kind === 'intelReport') return event.receiverFaction ?? event.observerFaction;
  if ('ownerId' in event) return event.ownerId;
  if ('factionId' in event) return event.factionId;
  if (event.kind === 'battle') return event.report.attackerId;
  return undefined;
}

export type MediumCompactionCategory =
  | 'construction'
  | 'infrastructure'
  | 'production'
  | 'repositioning'
  | 'blocked';

export function mediumCompactionCategory(event: SimEvent): MediumCompactionCategory | null {
  switch (event.kind) {
    case 'buildStarted':
      return 'construction';
    case 'infraUpgraded':
      return 'infrastructure';
    case 'production':
      return 'production';
    case 'buildBlocked':
      return 'blocked';
    case 'orderRejected':
      return 'blocked';
    case 'departure':
      return event.intent === 'defend' ? 'repositioning' : null;
    default:
      return null;
  }
}

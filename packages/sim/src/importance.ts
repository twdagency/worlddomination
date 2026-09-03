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
  'defectionOccurred',
  'annexationCompleted',
  'victory',
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
  'diplomaticMissionExpired',
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

export function countryIdFromEvent(event: SimEvent): Id | undefined {
  if (event.kind === 'intelReport') return event.receiverFaction ?? event.observerFaction;
  if ('ownerId' in event) return event.ownerId;
  if ('countryId' in event) return event.countryId;
  if (event.kind === 'battle') return event.report.attackerId;
  return undefined;
}

/** @deprecated Use `countryIdFromEvent`. */
export const factionIdFromEvent = countryIdFromEvent;

export type MediumCompactionCategory =
  | 'construction'
  | 'infrastructure'
  | 'production'
  | 'repositioning'
  | 'blocked'
  | 'missions'
  | 'culture'
  | 'intelligence';

const LIVE_ROUTINE_CATEGORIES: ReadonlySet<MediumCompactionCategory> = new Set([
  'missions',
  'culture',
  'intelligence',
]);

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
    case 'diplomaticMissionStarted':
    case 'diplomaticMissionExpired':
    case 'diplomaticMissionExpelled':
      return 'missions';
    case 'culturalCampaignApplied':
      return 'culture';
    case 'intelReport':
      return 'intelligence';
    default:
      return null;
  }
}

function isPlayerActor(world: WorldState, factionId: Id): boolean {
  return world.factions[factionId]?.isPlayer === true;
}

/** Ambient AI influence traffic — grouped live; excluded from the dashboard digest. */
export function isAmbientInfluenceDispatch(world: WorldState, event: SimEvent): boolean {
  const category = mediumCompactionCategory(event);
  if (!category || !LIVE_ROUTINE_CATEGORIES.has(category)) return false;
  const factionId = countryIdFromEvent(event);
  return Boolean(factionId && !isPlayerActor(world, factionId));
}

export function shouldFoldMediumEvent(
  world: WorldState,
  event: SimEvent,
  foldAllMedium: boolean,
): MediumCompactionCategory | null {
  const category = mediumCompactionCategory(event);
  if (!category) return null;
  const factionId = countryIdFromEvent(event);
  if (!factionId) return null;
  if (foldAllMedium) return category;
  if (!LIVE_ROUTINE_CATEGORIES.has(category)) return null;
  if (isPlayerActor(world, factionId)) return null;
  return category;
}

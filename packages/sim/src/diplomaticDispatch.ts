import { computeBeatId } from './dispatch';
import { normalizeFactionPair } from './diplomacy';
import type { Id, Millis, SimEvent, TerritorySnapshot, Treaty, WorldState } from './types';

export function garrisonDescriptor(snapshot: TerritorySnapshot): string {
  const strength = snapshot.visibleEnemyGarrison + snapshot.garrisonCount + snapshot.inTransitCount;
  if (strength > 50) return 'heavy';
  if (strength > 10) return 'moderate';
  return 'light';
}

export function allianceFormedEvent(
  partyA: Id,
  partyB: Id,
  atMs: Millis,
  initiatingFaction: Id,
): SimEvent {
  return {
    kind: 'allianceFormed',
    at: atMs,
    parties: normalizeFactionPair(partyA, partyB),
    initiatingFaction,
    beatId: computeBeatId(initiatingFaction, atMs, 'direct'),
    decisionTickMs: atMs,
    importance: 'medium',
  };
}

export function allianceBrokenEvent(breaker: Id, betrayed: Id, atMs: Millis): SimEvent {
  return {
    kind: 'allianceBroken',
    at: atMs,
    breaker,
    betrayed,
    parties: normalizeFactionPair(breaker, betrayed),
    beatId: computeBeatId(breaker, atMs, 'direct'),
    decisionTickMs: atMs,
    importance: 'medium',
  };
}

export function treatyFormedEvent(treaty: Treaty, atMs: Millis, initiatingFaction: Id): SimEvent {
  return {
    kind: 'treatyFormed',
    at: atMs,
    treatyId: treaty.id,
    parties: treaty.parties,
    territoryIds: treaty.scope.territoryIds,
    expiresAt: treaty.expiresAt,
    initiatingFaction,
    beatId: computeBeatId(initiatingFaction, atMs, 'treaty'),
    decisionTickMs: atMs,
    importance: 'medium',
  };
}

export function treatyExpiredEvent(treaty: Treaty, atMs: Millis): SimEvent {
  return {
    kind: 'treatyExpired',
    at: atMs,
    treatyId: treaty.id,
    parties: treaty.parties,
    territoryIds: treaty.scope.territoryIds,
    beatId: computeBeatId(treaty.parties[0], atMs, 'treaty'),
    decisionTickMs: atMs,
    importance: 'medium',
  };
}

export function expiredTreatyEvents(
  priorTreaties: Treaty[],
  nextTreaties: Treaty[],
  atMs: Millis,
): SimEvent[] {
  const remaining = new Set(nextTreaties.map((treaty) => treaty.id));
  return priorTreaties
    .filter((treaty) => !remaining.has(treaty.id))
    .map((treaty) => treatyExpiredEvent(treaty, atMs));
}

export function otherParty(parties: [Id, Id], factionId: Id): Id {
  return parties[0] === factionId ? parties[1] : parties[0];
}

export function isTreatyParty(event: Extract<SimEvent, { kind: 'treatyFormed' | 'treatyExpired' }>, factionId: Id): boolean {
  return event.parties[0] === factionId || event.parties[1] === factionId;
}

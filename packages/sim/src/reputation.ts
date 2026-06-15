import type { Faction, Id, Reputation, WorldState } from './types';

/** Reputation hit seen by every non-betrayed observer when an alliance is broken. */
export const REPUTATION_PENALTY_ALLIANCE_BREAK_OBSERVER = -20;

/** Reputation hit seen by the betrayed party when an alliance is broken. */
export const REPUTATION_PENALTY_ALLIANCE_BREAK_BETRAYED = -40;

/** All-pairs-zero reputation matrix (excludes self-pairs). Materialized at world creation. */
export function createInitialReputation(factions: Record<Id, Faction>): Reputation {
  const factionIds = Object.keys(factions).sort();
  const reputation: Reputation = {};

  for (const observer of factionIds) {
    reputation[observer] = {};
    for (const subject of factionIds) {
      if (observer === subject) continue;
      reputation[observer][subject] = 0;
    }
  }

  return reputation;
}

function adjustReputation(
  reputation: Reputation,
  observer: Id,
  subject: Id,
  delta: number,
): void {
  if (observer === subject) return;
  const row = reputation[observer];
  if (!row) return;
  row[subject] = (row[subject] ?? 0) + delta;
}

/**
 * Applies alliance-break reputation penalties. The breaker's view of the betrayed is unchanged;
 * self-pairs are ignored.
 */
export function applyAllianceBreakReputationPenalty(
  world: WorldState,
  breakerFactionId: Id,
  betrayedFactionId: Id,
): WorldState {
  if (breakerFactionId === betrayedFactionId) return world;

  const factionIds = Object.keys(world.factions).sort();
  const reputation: Reputation = {};

  for (const observer of factionIds) {
    reputation[observer] = { ...world.reputation[observer] };
  }

  for (const observer of factionIds) {
    if (observer === breakerFactionId) continue;

    const delta =
      observer === betrayedFactionId
        ? REPUTATION_PENALTY_ALLIANCE_BREAK_BETRAYED
        : REPUTATION_PENALTY_ALLIANCE_BREAK_OBSERVER;

    adjustReputation(reputation, observer, breakerFactionId, delta);
  }

  return { ...world, reputation };
}

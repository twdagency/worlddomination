import type { Faction, Id, Reputation, WorldState } from './types';

/** Reputation hit seen by every non-betrayed observer when an alliance is broken. */
export const REPUTATION_PENALTY_ALLIANCE_BREAK_OBSERVER = -20;

/** Reputation hit seen by the betrayed party when an alliance is broken. */
export const REPUTATION_PENALTY_ALLIANCE_BREAK_BETRAYED = -40;

/** Mild hit for surviving allies when a defeated country dissolves an alliance (force majeure). */
export const REPUTATION_PENALTY_ALLY_DEFEATED = -10;

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

/**
 * Force-majeure alliance dissolution when a country is defeated.
 * Only the surviving ally's view of the defeated country shifts (-10); observers unchanged.
 */
export function applyDefeatAllianceDissolutionReputationPenalty(
  world: WorldState,
  defeatedCountryId: Id,
  allyId: Id,
): WorldState {
  if (defeatedCountryId === allyId) return world;

  const reputation: Reputation = {};
  for (const observer of Object.keys(world.factions).sort()) {
    reputation[observer] = { ...world.reputation[observer] };
  }

  adjustReputation(reputation, allyId, defeatedCountryId, REPUTATION_PENALTY_ALLY_DEFEATED);

  return { ...world, reputation };
}

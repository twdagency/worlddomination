import type {
  AlliancePair,
  Faction,
  Id,
  Millis,
  Reputation,
  Treaty,
  WorldState,
} from './types';
import { pruneAlliedIntelOnBreak } from './intel';
import {
  applyAllianceBreakReputationPenalty,
  createInitialReputation,
} from './reputation';

export { createInitialReputation } from './reputation';

// SPRINT-6 PHASE-6: pending proposals queue in pendingProposals.ts + playerDiplomacy.ts.

/** Lexicographic ordering for symmetric faction pairs (alliances, treaty parties). */
export function normalizeFactionPair(factionA: Id, factionB: Id): [Id, Id] {
  return factionA < factionB ? [factionA, factionB] : [factionB, factionA];
}

function deterministicTreatyId(
  parties: [Id, Id],
  formedAt: Millis,
  territoryIds: Id[],
): Id {
  const scope = [...territoryIds].sort().join(',');
  const input = `${parties[0]}:${parties[1]}:${formedAt}:${scope}`;
  let hash = 2_166_136_261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 1_677_761_9);
  }
  return `treaty-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function sortAlliances(alliances: AlliancePair[]): AlliancePair[] {
  return [...alliances].sort(
    (left, right) =>
      left.factionA.localeCompare(right.factionA) ||
      left.factionB.localeCompare(right.factionB),
  );
}

function sortTreaties(treaties: Treaty[]): Treaty[] {
  return [...treaties].sort((left, right) => left.id.localeCompare(right.id));
}

export function diplomacyDefaults(factions: Record<Id, Faction>): {
  alliances: AlliancePair[];
  treaties: Treaty[];
  reputation: Reputation;
  pendingProposals: [];
} {
  return {
    alliances: [],
    treaties: [],
    reputation: createInitialReputation(factions),
    pendingProposals: [],
  };
}

/** Backfill diplomacy fields on saves created before Sprint 6. Preserves stored reputation values. */
export function ensureWorldDiplomacy(world: WorldState): WorldState {
  const alliances = world.alliances ?? [];
  const treaties = world.treaties ?? [];
  const reputation = createInitialReputation(world.factions);

  for (const observer of Object.keys(reputation)) {
    for (const subject of Object.keys(reputation[observer])) {
      const stored = world.reputation?.[observer]?.[subject];
      if (stored !== undefined) {
        reputation[observer][subject] = stored;
      }
    }
  }

  return {
    ...world,
    alliances: sortAlliances(alliances),
    treaties: sortTreaties(treaties),
    reputation,
    pendingProposals: world.pendingProposals ?? [],
  };
}

export function areAllied(world: WorldState, factionA: Id, factionB: Id): boolean {
  if (factionA === factionB) return false;
  const [a, b] = normalizeFactionPair(factionA, factionB);
  return world.alliances.some((pair) => pair.factionA === a && pair.factionB === b);
}

export function getAlliancesFor(world: WorldState, factionId: Id): Id[] {
  const allies: Id[] = [];
  for (const pair of world.alliances) {
    if (pair.factionA === factionId) allies.push(pair.factionB);
    else if (pair.factionB === factionId) allies.push(pair.factionA);
  }
  return allies.sort();
}

export function getTreatiesBetween(world: WorldState, factionA: Id, factionB: Id): Treaty[] {
  const [a, b] = normalizeFactionPair(factionA, factionB);
  return world.treaties.filter(
    (treaty) => treaty.parties[0] === a && treaty.parties[1] === b,
  );
}

export function getActiveTreaties(world: WorldState, factionId: Id, gameTime: Millis): Treaty[] {
  return world.treaties.filter(
    (treaty) =>
      gameTime < treaty.expiresAt &&
      (treaty.parties[0] === factionId || treaty.parties[1] === factionId),
  );
}

export function formAlliance(
  world: WorldState,
  factionA: Id,
  factionB: Id,
  gameTime: Millis,
): WorldState {
  if (factionA === factionB) return world;

  const [a, b] = normalizeFactionPair(factionA, factionB);
  if (areAllied(world, a, b)) return world;

  return {
    ...world,
    alliances: sortAlliances([
      ...world.alliances,
      { factionA: a, factionB: b, formedAt: gameTime },
    ]),
  };
}

/**
 * Faction `breaker` unilaterally ends their alliance with `betrayed`.
 * Multi-effect: removes alliance, prunes allied intel, applies reputation
 * penalties (-40 to betrayed's view, -20 to all other observers).
 */
export function breakAlliance(
  world: WorldState,
  breaker: Id,
  betrayed: Id,
): WorldState {
  if (breaker === betrayed) return world;

  const [a, b] = normalizeFactionPair(breaker, betrayed);
  const next = world.alliances.filter((pair) => !(pair.factionA === a && pair.factionB === b));
  if (next.length === world.alliances.length) return world;

  // breakAlliance is intentionally a multi-effect operation:
  // 1. Removes alliance pair from state
  // 2. Prunes allied intel records (fog parity at break boundary)
  // 3. Applies reputation penalties (observer -20, betrayed -40)
  // Keep these together — splitting them would create windows where alliance is
  // broken but intel/reputation hasn't caught up.
  //
  // SPRINT-6 architectural note: alliance formation is intel-agnostic (emission runs at
  // the next tick boundary, driven by state). Breaking has immediate intel and reputation
  // implications, so breakAlliance imports pruneAlliedIntelOnBreak and
  // applyAllianceBreakReputationPenalty. This asymmetry is intentional; do not generalize
  // into an event bus without strong justification.
  const withoutAlliance = {
    ...world,
    alliances: next,
  };

  return applyAllianceBreakReputationPenalty(
    pruneAlliedIntelOnBreak(withoutAlliance, a, b),
    breaker,
    betrayed,
  );
}

export interface FormTreatyParams {
  partyA: Id;
  partyB: Id;
  territoryIds: Id[];
  formedAt: Millis;
  expiresAt: Millis;
}

export function formTreaty(world: WorldState, params: FormTreatyParams): WorldState {
  const parties = normalizeFactionPair(params.partyA, params.partyB);
  const territoryIds = [...params.territoryIds].sort();
  const id = deterministicTreatyId(parties, params.formedAt, territoryIds);

  if (world.treaties.some((treaty) => treaty.id === id)) return world;

  const treaty: Treaty = {
    id,
    parties,
    scope: { territoryIds },
    formedAt: params.formedAt,
    expiresAt: params.expiresAt,
  };

  return {
    ...world,
    treaties: sortTreaties([...world.treaties, treaty]),
  };
}

export function pruneExpiredTreaties(world: WorldState, gameTime: Millis): WorldState {
  const treaties = world.treaties.filter((treaty) => gameTime < treaty.expiresAt);
  if (treaties.length === world.treaties.length) return world;

  return {
    ...world,
    treaties,
  };
}

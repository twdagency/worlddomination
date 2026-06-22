import type {
  AlliancePair,
  Faction,
  Id,
  Millis,
  Reputation,
  SimEvent,
  SimEventDraft,
  Treaty,
  WorldState,
} from './types';
import { pruneAlliedIntelOnBreak } from './intel';
import { allianceBrokenEvent, treatyExpiredEvent } from './diplomaticEvents';
import { normalizeFactionPair } from './diplomaticPair';
import {
  applyAllianceBreakReputationPenalty,
  applyDefeatAllianceDissolutionReputationPenalty,
  createInitialReputation,
} from './reputation';

export { createInitialReputation } from './reputation';
export { normalizeFactionPair } from './diplomaticPair';

// SPRINT-6 PHASE-6: pending proposals queue in pendingProposals.ts + playerDiplomacy.ts.

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
  // Composed by ensureWorldMigrations; kept for diplomacy-only tests and direct import.
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

/** True when parties share an active treaty covering `territoryId` at sim time `at`. */
export function hasActiveTreatyOn(
  world: WorldState,
  factionA: Id,
  factionB: Id,
  territoryId: Id,
  at: Millis,
): boolean {
  const [partyA, partyB] = normalizeFactionPair(factionA, factionB);
  return world.treaties.some(
    (treaty) =>
      at < treaty.expiresAt &&
      treaty.parties[0] === partyA &&
      treaty.parties[1] === partyB &&
      treaty.scope.territoryIds.includes(territoryId),
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
): { world: WorldState; events: SimEventDraft[] } {
  if (factionA === factionB) return { world, events: [] };

  const [a, b] = normalizeFactionPair(factionA, factionB);
  if (areAllied(world, a, b)) return { world, events: [] };

  const withAlliance: WorldState = {
    ...world,
    alliances: sortAlliances([
      ...world.alliances,
      { factionA: a, factionB: b, formedAt: gameTime },
    ]),
  };

  const recalled = recallHostileAssaultsBetweenAllies(withAlliance, a, b, gameTime);
  return {
    world: { ...withAlliance, units: recalled.units },
    events: recalled.events,
  };
}

function isAssaultTransitBetween(
  moverId: Id,
  destinationOwnerId: Id,
  factionA: Id,
  factionB: Id,
): boolean {
  if (moverId === destinationOwnerId) return false;
  return (
    (moverId === factionA && destinationOwnerId === factionB) ||
    (moverId === factionB && destinationOwnerId === factionA)
  );
}

/** Recall in-flight assault orders between newly allied factions. */
export function recallHostileAssaultsBetweenAllies(
  world: WorldState,
  factionA: Id,
  factionB: Id,
  at: Millis,
): { units: WorldState['units']; events: SimEventDraft[] } {
  const units = { ...world.units };
  const events: SimEventDraft[] = [];

  for (const [unitId, unit] of Object.entries(units)) {
    const transit = unit.transit;
    if (!transit || transit.stanceOnArrival !== 'assault') continue;

    const destinationId = transit.toTerritoryId;
    if (!destinationId) continue;

    const destinationOwnerId = world.territories[destinationId]?.ownerId;
    if (!destinationOwnerId) continue;
    if (!isAssaultTransitBetween(unit.ownerId, destinationOwnerId, factionA, factionB)) {
      continue;
    }

    units[unitId] = {
      ...unit,
      locationId: transit.fromId,
      transit: undefined,
    };

    events.push({
      kind: 'dispatchCancelledByAlliance',
      at,
      factionId: unit.ownerId,
      allyFactionId: destinationOwnerId,
      unitId,
      fromTerritoryId: transit.fromId,
      toTerritoryId: destinationId,
      importance: 'medium',
    });
  }

  return { units, events };
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

  const hasOverlap = territoryIds.some((territoryId) =>
    hasActiveTreatyOn(world, parties[0], parties[1], territoryId, params.formedAt),
  );
  if (hasOverlap) return world;

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

function removeAlliancePair(world: WorldState, factionA: Id, factionB: Id): WorldState {
  const [a, b] = normalizeFactionPair(factionA, factionB);
  const next = world.alliances.filter((pair) => !(pair.factionA === a && pair.factionB === b));
  if (next.length === world.alliances.length) return world;
  return { ...world, alliances: next };
}

/**
 * Dissolve one alliance because `defeatedCountryId` was destroyed (force majeure).
 * Does not use voluntary `breakAlliance` penalties; emits `allianceBroken` for dispatch.
 */
function dissolveAllianceOnDefeat(
  world: WorldState,
  defeatedCountryId: Id,
  allyId: Id,
  at: Millis,
): { world: WorldState; events: SimEventDraft[] } {
  if (defeatedCountryId === allyId || !areAllied(world, defeatedCountryId, allyId)) {
    return { world, events: [] };
  }

  const [a, b] = normalizeFactionPair(defeatedCountryId, allyId);
  const withoutAlliance = removeAlliancePair(world, a, b);
  if (withoutAlliance === world) return { world, events: [] };

  const pruned = pruneAlliedIntelOnBreak(withoutAlliance, a, b);
  const next = applyDefeatAllianceDissolutionReputationPenalty(
    pruned,
    defeatedCountryId,
    allyId,
  );

  return {
    world: next,
    events: [allianceBrokenEvent(defeatedCountryId, allyId, at)],
  };
}

/** Remove all alliances involving a defeated country; deterministic ally order. */
export function dissolveAlliancesForDefeatedCountry(
  world: WorldState,
  defeatedCountryId: Id,
  at: Millis,
): { world: WorldState; events: SimEventDraft[] } {
  const allies = getAlliancesFor(world, defeatedCountryId);
  let current = world;
  const events: SimEventDraft[] = [];

  for (const allyId of allies) {
    const dissolved = dissolveAllianceOnDefeat(current, defeatedCountryId, allyId, at);
    current = dissolved.world;
    events.push(...dissolved.events);
  }

  return { world: current, events };
}

/** Expire all treaties where the defeated country is a party; emit `treatyExpired` for each. */
export function expireTreatiesForDefeatedCountry(
  world: WorldState,
  defeatedCountryId: Id,
  at: Millis,
): { world: WorldState; events: SimEventDraft[] } {
  const expiring = world.treaties
    .filter(
      (treaty) =>
        treaty.parties[0] === defeatedCountryId || treaty.parties[1] === defeatedCountryId,
    )
    .sort((left, right) => left.id.localeCompare(right.id));

  if (expiring.length === 0) return { world, events: [] };

  const expiringIds = new Set(expiring.map((treaty) => treaty.id));
  return {
    world: {
      ...world,
      treaties: world.treaties.filter((treaty) => !expiringIds.has(treaty.id)),
    },
    events: expiring.map((treaty) => treatyExpiredEvent(treaty, at)),
  };
}

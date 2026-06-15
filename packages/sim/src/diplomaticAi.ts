import {
  areAllied,
  breakAlliance,
  formAlliance,
  getAlliancesFor,
} from './diplomacy';
import {
  REPUTATION_PENALTY_ALLIANCE_BREAK_BETRAYED,
  REPUTATION_PENALTY_ALLIANCE_BREAK_OBSERVER,
} from './reputation';
import type { DiplomaticPosture, Id, LeaderWeights, Millis, WorldState } from './types';

export const RELATIVE_POWER_PEER_RATIO_MIN = 0.5;
export const RELATIVE_POWER_PEER_RATIO_MAX = 2.0;

export const ALLIANCE_PROPOSE_THRESHOLD = 55;
export const ALLIANCE_ACCEPT_THRESHOLD = 50;
export const ALLIANCE_BREAK_THRESHOLD = 60;

const SHARED_ENEMY_BONUS = 18;
const PEER_POWER_BONUS = 22;
const NON_PEER_POWER_PENALTY = 15;
const ALLY_DOMINANT_THREAT_RATIO = 2;
const ALLY_DOMINANT_THREAT_BONUS = 30;
const SHARED_ENEMY_GONE_BONUS = 25;

/**
 * Shared enemy: a third faction that is hostile to both parties.
 * Hostility is observable from sim state only — assault transit toward owned
 * territory, or enemy units stationed on your territory. Not default-hostile.
 */
export function isEnemyOf(world: WorldState, subject: Id, other: Id): boolean {
  if (subject === other) return false;
  if (areAllied(world, subject, other)) return false;
  return isAttackingFaction(world, other, subject) || isAttackingFaction(world, subject, other);
}

export function sharedEnemies(world: WorldState, factionA: Id, factionB: Id): Id[] {
  return Object.keys(world.factions)
    .filter(
      (candidate) =>
        candidate !== factionA &&
        candidate !== factionB &&
        isEnemyOf(world, factionA, candidate) &&
        isEnemyOf(world, factionB, candidate),
    )
    .sort();
}

export function factionMilitaryPower(world: WorldState, factionId: Id): number {
  return Object.values(world.units)
    .filter((unit) => unit.ownerId === factionId)
    .reduce((sum, unit) => {
      const combatValue = world.unitTypes[unit.typeId]?.combatValue ?? 1;
      return sum + unit.count * combatValue;
    }, 0);
}

function isAttackingFaction(world: WorldState, attackerId: Id, defenderId: Id): boolean {
  for (const unit of Object.values(world.units)) {
    if (unit.ownerId !== attackerId) continue;

    if (unit.transit?.stanceOnArrival === 'assault') {
      const toTerritoryId = unit.transit.toTerritoryId;
      if (!toTerritoryId) continue;
      const targetOwner = world.territories[toTerritoryId]?.ownerId;
      if (targetOwner === defenderId) return true;
    }

    if (unit.locationId) {
      const locationOwner = world.territories[unit.locationId]?.ownerId;
      if (locationOwner === defenderId) return true;
    }
  }

  return false;
}

function leaderWeights(world: WorldState, factionId: Id): LeaderWeights {
  const faction = world.factions[factionId];
  const leader = faction ? world.leaders[faction.leaderId] : undefined;
  return (
    leader?.weights ?? {
      aggression: 5,
      risk: 5,
      economy: 5,
      expansion: 5,
      scoutingPriority: 'broad',
      diplomaticPosture: 'isolationist',
    }
  );
}

function postureProposeModifier(posture: DiplomaticPosture): number {
  switch (posture) {
    case 'opportunist':
      return 25;
    case 'loyal':
      return -10;
    case 'isolationist':
      return -30;
  }
}

function postureAcceptModifier(posture: DiplomaticPosture): number {
  switch (posture) {
    case 'opportunist':
      return 12;
    case 'loyal':
      return 8;
    case 'isolationist':
      return -28;
  }
}

function postureBreakModifier(posture: DiplomaticPosture): number {
  switch (posture) {
    case 'opportunist':
      return 22;
    case 'loyal':
      return -35;
    case 'isolationist':
      return 6;
  }
}

function reputationBreakCostWeight(posture: DiplomaticPosture): number {
  switch (posture) {
    case 'opportunist':
      return 0.35;
    case 'loyal':
      return 1.15;
    case 'isolationist':
      return 0.75;
  }
}

function peerPowerBonus(world: WorldState, factionA: Id, factionB: Id): number {
  const powerA = factionMilitaryPower(world, factionA);
  const powerB = factionMilitaryPower(world, factionB);
  const ratio = powerB / Math.max(1, powerA);
  if (ratio >= RELATIVE_POWER_PEER_RATIO_MIN && ratio <= RELATIVE_POWER_PEER_RATIO_MAX) {
    return PEER_POWER_BONUS;
  }
  return -NON_PEER_POWER_PENALTY;
}

/** How attractive proposing an alliance is from the proposer's perspective. */
export function scoreAllianceProposal(world: WorldState, proposer: Id, target: Id): number {
  if (proposer === target || areAllied(world, proposer, target)) return 0;

  const posture = leaderWeights(world, proposer).diplomaticPosture;
  let score = 30 + postureProposeModifier(posture);

  score += sharedEnemies(world, proposer, target).length * SHARED_ENEMY_BONUS;
  score += peerPowerBonus(world, proposer, target);

  const targetViewOfProposer = world.reputation[target]?.[proposer] ?? 0;
  score += targetViewOfProposer * 0.35;

  const proposerViewOfTarget = world.reputation[proposer]?.[target] ?? 0;
  score += proposerViewOfTarget * 0.2;

  return score;
}

/** How willing the target is to accept a proposal from the proposer. */
export function scoreAllianceAcceptance(world: WorldState, target: Id, proposer: Id): number {
  if (proposer === target || areAllied(world, target, proposer)) return 0;

  const posture = leaderWeights(world, target).diplomaticPosture;
  let score = 25 + postureAcceptModifier(posture);

  const targetViewOfProposer = world.reputation[target]?.[proposer] ?? 0;
  score += targetViewOfProposer * 0.65;

  score += sharedEnemies(world, target, proposer).length * SHARED_ENEMY_BONUS;
  score += peerPowerBonus(world, target, proposer);

  return score;
}

/** How attractive breaking an existing alliance is for the breaker. */
export function scoreAllianceBreak(world: WorldState, breaker: Id, ally: Id): number {
  if (!areAllied(world, breaker, ally)) return 0;

  const posture = leaderWeights(world, breaker).diplomaticPosture;
  let score = postureBreakModifier(posture);

  if (sharedEnemies(world, breaker, ally).length === 0) {
    score += SHARED_ENEMY_GONE_BONUS;
  }

  const breakerPower = factionMilitaryPower(world, breaker);
  const allyPower = factionMilitaryPower(world, ally);
  if (allyPower > breakerPower * ALLY_DOMINANT_THREAT_RATIO) {
    score += ALLY_DOMINANT_THREAT_BONUS;
  }

  const observerCount = Math.max(0, Object.keys(world.factions).length - 2);
  const reputationCost =
    Math.abs(REPUTATION_PENALTY_ALLIANCE_BREAK_BETRAYED) +
    Math.abs(REPUTATION_PENALTY_ALLIANCE_BREAK_OBSERVER) * observerCount;
  score -= reputationCost * reputationBreakCostWeight(posture) * 0.25;

  return score;
}

function aiFactionIds(world: WorldState): Id[] {
  return Object.keys(world.factions)
    .filter((factionId) => !world.factions[factionId]?.isPlayer)
    .sort();
}

// SPRINT-6 PHASE-4b: diplomatic decisions are not orders.
// They take immediate effect (no transit, no tick delay).
// This matches Phase 1's design: form/break/propose are world-state mutations
// applied at decision time. Do not route diplomacy through the order pipeline.
/**
 * Applies AI diplomatic decisions at an AI decision boundary. Pure — returns new world.
 * Proposals resolve instantly when both propose and accept scores clear thresholds.
 */
export function applyAiDiplomaticDecisions(world: WorldState, atMs: Millis): WorldState {
  let current = world;

  for (const breaker of aiFactionIds(current)) {
    for (const ally of getAlliancesFor(current, breaker)) {
      const breakScore = scoreAllianceBreak(current, breaker, ally);
      if (breakScore >= ALLIANCE_BREAK_THRESHOLD) {
        current = breakAlliance(current, breaker, ally);
      }
    }
  }

  for (const proposer of aiFactionIds(current)) {
    let bestTarget: Id | null = null;
    let bestProposalScore = 0;

    for (const target of aiFactionIds(current)) {
      if (target === proposer) continue;
      const proposalScore = scoreAllianceProposal(current, proposer, target);
      if (proposalScore > bestProposalScore) {
        bestProposalScore = proposalScore;
        bestTarget = target;
      }
    }

    if (!bestTarget || bestProposalScore < ALLIANCE_PROPOSE_THRESHOLD) continue;

    const acceptanceScore = scoreAllianceAcceptance(current, bestTarget, proposer);
    if (acceptanceScore >= ALLIANCE_ACCEPT_THRESHOLD) {
      current = formAlliance(current, proposer, bestTarget, atMs);
    }
  }

  return current;
}

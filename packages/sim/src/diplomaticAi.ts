import { areAllied, breakAlliance, formAlliance, getAlliancesFor } from './diplomacy';
import { allianceBrokenEvent, allianceFormedEvent } from './diplomaticEvents';
import { activeCountries } from './country';
import { stampEvents } from './events';
import { expirePendingProposals, queueAllianceProposal } from './playerDiplomacy';
import { hasPendingProposalBetween } from './pendingProposals';
import {
  ALLIANCE_ACCEPT_THRESHOLD,
  ALLIANCE_BREAK_THRESHOLD,
  ALLIANCE_PROPOSE_THRESHOLD,
  scoreAllianceAcceptance,
  scoreAllianceBreak,
  scoreAllianceProposal,
} from './diplomaticScoring';
import type { Id, Millis, SimEvent, SimEventDraft, WorldState } from './types';

export {
  ALLIANCE_ACCEPT_THRESHOLD,
  ALLIANCE_BREAK_THRESHOLD,
  ALLIANCE_PROPOSE_THRESHOLD,
  RELATIVE_POWER_PEER_RATIO_MAX,
  RELATIVE_POWER_PEER_RATIO_MIN,
  TREATY_ACCEPT_THRESHOLD,
  factionMilitaryPower,
  isEnemyOf,
  scoreAllianceAcceptance,
  scoreAllianceBreak,
  scoreAllianceProposal,
  scoreTreatyAcceptance,
  sharedEnemies,
} from './diplomaticScoring';

function allFactionIds(world: WorldState): Id[] {
  return Object.keys(world.factions).sort();
}

/** AI factions may initiate diplomacy; player factions may accept proposals (Phase 6 adds player-initiated). */
function aiFactionIds(world: WorldState): Id[] {
  if (!world.countries || Object.keys(world.countries).length === 0) {
    return allFactionIds(world).filter((factionId) => !world.factions[factionId]?.isPlayer);
  }

  return activeCountries(world)
    .filter((country) => !country.isPlayer)
    .map((country) => country.id)
    .sort();
}

// SPRINT-6 PHASE-4b: diplomatic decisions are not orders.
// They take immediate effect (no transit, no tick delay).
// This matches Phase 1's design: form/break/propose are world-state mutations
// applied at decision time. Do not route diplomacy through the order pipeline.
/**
 * Applies AI diplomatic decisions at an AI decision boundary. Pure — returns new world
 * and diplomatic dispatch events. Proposals resolve instantly when both scores clear thresholds.
 * Sprint 6: alliances only — AI does not propose treaties (player-initiated in Phase 6).
 */
export function applyAiDiplomaticDecisions(
  world: WorldState,
  atMs: Millis,
): { world: WorldState; events: SimEvent[] } {
  let current = world;
  const events: SimEventDraft[] = [];

  const expired = expirePendingProposals(current, atMs);
  current = expired.world;
  events.push(...expired.events);

  for (const breaker of aiFactionIds(current)) {
    for (const ally of getAlliancesFor(current, breaker)) {
      const breakScore = scoreAllianceBreak(current, breaker, ally);
      if (breakScore >= ALLIANCE_BREAK_THRESHOLD) {
        current = breakAlliance(current, breaker, ally);
        events.push(allianceBrokenEvent(breaker, ally, atMs));
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
      const formed = formAlliance(current, proposer, bestTarget, atMs);
      current = formed.world;
      events.push(...formed.events, allianceFormedEvent(proposer, bestTarget, atMs, proposer));
    }
  }

  const playerId = Object.values(current.factions).find((faction) => faction.isPlayer)?.id;
  if (playerId) {
    for (const proposer of aiFactionIds(current)) {
      if (areAllied(current, proposer, playerId)) continue;
      if (hasPendingProposalBetween(current, proposer, playerId, 'alliance')) continue;

      const proposalScore = scoreAllianceProposal(current, proposer, playerId);
      if (proposalScore < ALLIANCE_PROPOSE_THRESHOLD) continue;

      const acceptanceScore = scoreAllianceAcceptance(current, playerId, proposer);
      if (acceptanceScore >= ALLIANCE_ACCEPT_THRESHOLD) {
        const queued = queueAllianceProposal(current, proposer, playerId, atMs);
        current = queued.world;
        events.push(...queued.events);
      }
    }
  }

  return stampEvents(current, events);
}

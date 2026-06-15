import { describe, it, expect } from 'vitest';
import {
  advanceTo,
  ALLIANCE_ACCEPT_THRESHOLD,
  areAllied,
  createInitialReputation,
  dispatchLineForEvent,
  ensureWorldDiplomacy,
  expirePendingProposals,
  playerAcceptProposal,
  playerBreakAlliance,
  playerProposeAlliance,
  playerFactionId,
  queueAllianceProposal,
  reputationCategory,
  renderDigestText,
  scoreAllianceAcceptance,
  scoreTreatyAcceptance,
  TREATY_ACCEPT_THRESHOLD,
  playerProposeTreaty,
} from '../src';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import type { WorldState } from '../src/types';

const START_MS = 1_700_900_000_000;
const PLAYER = 'faction-player';
const CAESAR = 'faction-rome';
const GENGHIS = 'faction-steppe';
const BERLIN = 'territory-berlin';

describe('player diplomacy', () => {
  it('player propose alliance does not use player posture — only AI acceptance heuristic', () => {
    const world = createSprint4World(START_MS);
    const caesarAccepts = scoreAllianceAcceptance(world, CAESAR, PLAYER);
    const { events, world: next } = playerProposeAlliance(world, PLAYER, CAESAR, START_MS);

    if (caesarAccepts >= ALLIANCE_ACCEPT_THRESHOLD) {
      expect(areAllied(next, PLAYER, CAESAR)).toBe(true);
      expect(events.some((event) => event.kind === 'allianceFormed')).toBe(true);
    } else {
      expect(areAllied(next, PLAYER, CAESAR)).toBe(false);
      expect(events.some((event) => event.kind === 'allianceDeclined')).toBe(true);
    }
  });

  it('player break alliance applies reputation penalties', () => {
    const allied = {
      ...createSprint4World(START_MS),
      alliances: [{ factionA: PLAYER, factionB: GENGHIS, formedAt: START_MS }],
    };
    const before = allied.reputation[GENGHIS]?.[PLAYER] ?? 0;
    const { world } = playerBreakAlliance(allied, PLAYER, GENGHIS, START_MS);
    expect(areAllied(world, PLAYER, GENGHIS)).toBe(false);
    expect(world.reputation[GENGHIS]?.[PLAYER]).toBeLessThan(before);
    expect(reputationCategory(world.reputation[GENGHIS]?.[PLAYER] ?? 0)).toBe('Wary');
  });

  it('player treaty proposal uses lower acceptance bar than alliances', () => {
    const world = createSprint4World(START_MS);
    const score = scoreTreatyAcceptance(world, GENGHIS, PLAYER, BERLIN);
    const { events } = playerProposeTreaty(world, PLAYER, GENGHIS, BERLIN, START_MS);
    if (score >= TREATY_ACCEPT_THRESHOLD) {
      expect(events.some((event) => event.kind === 'treatyFormed')).toBe(true);
    } else {
      expect(events.some((event) => event.kind === 'treatyDeclined')).toBe(true);
    }
  });

  it('AI alliance proposal to player queues pending proposal with dispatch line', () => {
    const world = createSprint4World(START_MS);
    const { world: queued, events } = queueAllianceProposal(world, GENGHIS, PLAYER, START_MS);
    expect(queued.pendingProposals).toHaveLength(1);
    expect(events[0]?.kind).toBe('allianceProposed');
    const line = dispatchLineForEvent(queued, events[0]!);
    expect(line).toContain('proposes alliance');
    expect(line).toContain('Expires in');
  });

  it('player accept proposal forms alliance and clears queue', () => {
    const world = createSprint4World(START_MS);
    const { world: queued } = queueAllianceProposal(world, GENGHIS, PLAYER, START_MS);
    const proposalId = queued.pendingProposals[0]!.id;
    const { world: next, events } = playerAcceptProposal(queued, PLAYER, proposalId, START_MS);
    expect(next.pendingProposals).toHaveLength(0);
    expect(areAllied(next, PLAYER, GENGHIS)).toBe(true);
    expect(events.some((event) => event.kind === 'allianceFormed')).toBe(true);
  });

  it('expired pending proposals decline implicitly', () => {
    const world = createSprint4World(START_MS);
    const { world: queued } = queueAllianceProposal(world, GENGHIS, PLAYER, START_MS);
    const expiresAt = queued.pendingProposals[0]!.expiresAt;
    const { world: next, events } = expirePendingProposals(queued, expiresAt);
    expect(next.pendingProposals).toHaveLength(0);
    expect(events.some((event) => event.kind === 'allianceDeclined')).toBe(true);
  });

  it('ensureWorldDiplomacy backfills empty pendingProposals on old saves', () => {
    const world = createSprint4World(START_MS);
    const legacy = { ...world, pendingProposals: undefined } as unknown as WorldState;
    const restored = ensureWorldDiplomacy(legacy);
    expect(restored.pendingProposals).toEqual([]);
    expect(restored.reputation).toEqual(createInitialReputation(world.factions));
  });
});

describe('player diplomacy cold-play', () => {
  it('player proposes to Caesar, breaks Genghis alliance, reputation shifts in digest', () => {
    let world = createSprint4World(START_MS);
    const playerId = playerFactionId(world)!;

    const proposeCaesar = playerProposeAlliance(world, playerId, CAESAR, world.nowMs);
    world = proposeCaesar.world;
    const caesarDigest = renderDigestText(world, proposeCaesar.events, undefined, playerId);

    const allied = {
      ...world,
      alliances: [{ factionA: playerId, factionB: GENGHIS, formedAt: world.nowMs }],
    };
    const broken = playerBreakAlliance(allied, playerId, GENGHIS, allied.nowMs);
    world = broken.world;

    const observation = {
      caesarProposalAccepted: areAllied(world, playerId, CAESAR),
      caesarProposalDeclined: proposeCaesar.events.some((e) => e.kind === 'allianceDeclined'),
      genghisReputationAfterBreak: world.reputation[GENGHIS]?.[playerId],
      genghisReputationLabel: reputationCategory(world.reputation[GENGHIS]?.[playerId] ?? 0),
      caesarDigest,
      breakDigest: renderDigestText(world, broken.events, undefined, playerId),
    };

    expect(observation).toMatchSnapshot('sprint6-phase6-player-diplomacy-cold-play');
    expect(observation.genghisReputationLabel).toBe('Wary');
  });
});

import { describe, it, expect } from 'vitest';
import {
  advanceTo,
  areAllied,
  decideOrders,
  formAlliance,
  recordAlliedObservations,
  recordIntelObservations,
  renderDigestText,
  REPUTATION_PENALTY_ALLIANCE_BREAK_BETRAYED,
  SCOUT_UNIT_TYPE_ID,
} from '../src';
import {
  ALLIANCE_ACCEPT_THRESHOLD,
  ALLIANCE_BREAK_THRESHOLD,
  ALLIANCE_PROPOSE_THRESHOLD,
  applyAiDiplomaticDecisions,
  factionMilitaryPower,
  isEnemyOf,
  scoreAllianceAcceptance,
  scoreAllianceBreak,
  scoreAllianceProposal,
  sharedEnemies,
} from '../src/diplomaticAi';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import type { Leader, WorldState } from '../src/types';

const START_MS = 1_700_900_000_000;
const SEVENTY_TWO_HOURS_MS = 72 * 3_600_000;
const PLAYER = 'faction-player';
const CAESAR = 'faction-rome';
const GENGHIS = 'faction-steppe';
const BRITAIN = 'faction-britain';
const PARIS = 'territory-paris';
const BERLIN = 'territory-berlin';

function withLeaderPosture(world: WorldState, leaderId: string, posture: Leader['weights']['diplomaticPosture']): WorldState {
  const leader = world.leaders[leaderId];
  if (!leader) return world;
  return {
    ...world,
    leaders: {
      ...world.leaders,
      [leaderId]: {
        ...leader,
        weights: { ...leader.weights, diplomaticPosture: posture },
      },
    },
  };
}

function sharedEnemyAgainstCaesarWorld(): WorldState {
  const base = createSprint4World(START_MS);
  return {
    ...base,
    units: {
      ...base.units,
      'unit-steppe-assault': {
        id: 'unit-steppe-assault',
        typeId: 'mg-armor-t5',
        ownerId: GENGHIS,
        count: 8,
        locationId: BERLIN,
        stance: 'defend',
        transit: {
          fromTerritoryId: BERLIN,
          toTerritoryId: PARIS,
          departMs: START_MS,
          arriveMs: START_MS + 3_600_000,
          distanceKm: 900,
          stanceOnArrival: 'assault',
          intent: 'attack',
          beatId: 'test-beat',
          decisionTickMs: START_MS,
        },
      },
      'unit-britain-assault': {
        id: 'unit-britain-assault',
        typeId: 'levy-t1',
        ownerId: BRITAIN,
        count: 90,
        locationId: 'territory-madrid',
        stance: 'defend',
        transit: {
          fromTerritoryId: 'territory-madrid',
          toTerritoryId: PARIS,
          departMs: START_MS,
          arriveMs: START_MS + 3_600_000,
          distanceKm: 800,
          stanceOnArrival: 'assault',
          intent: 'attack',
          beatId: 'test-beat',
          decisionTickMs: START_MS,
        },
      },
    },
  };
}

describe('AI diplomatic scoring', () => {
  it('posture modulates proposal scores for identical conditions', () => {
    const world = sharedEnemyAgainstCaesarWorld();
    const opportunist = scoreAllianceProposal(
      withLeaderPosture(world, 'leader-genghis', 'opportunist'),
      GENGHIS,
      BRITAIN,
    );
    const isolationist = scoreAllianceProposal(
      withLeaderPosture(world, 'leader-genghis', 'isolationist'),
      GENGHIS,
      BRITAIN,
    );

    expect(opportunist).toBeGreaterThan(isolationist);
    expect(opportunist - isolationist).toBeGreaterThanOrEqual(50);
  });

  it('posture modulates acceptance scores for identical conditions', () => {
    const world = sharedEnemyAgainstCaesarWorld();
    const loyal = scoreAllianceAcceptance(
      withLeaderPosture(world, 'leader-elizabeth', 'loyal'),
      BRITAIN,
      GENGHIS,
    );
    const isolationist = scoreAllianceAcceptance(
      withLeaderPosture(world, 'leader-caesar', 'isolationist'),
      CAESAR,
      GENGHIS,
    );

    expect(loyal).toBeGreaterThan(isolationist);
  });

  it('posture modulates break scores for identical conditions', () => {
    const allied = formAlliance(createSprint4World(START_MS), GENGHIS, CAESAR, START_MS).world;
    const opportunist = scoreAllianceBreak(
      withLeaderPosture(allied, 'leader-genghis', 'opportunist'),
      GENGHIS,
      CAESAR,
    );
    const loyal = scoreAllianceBreak(
      withLeaderPosture(allied, 'leader-genghis', 'loyal'),
      GENGHIS,
      CAESAR,
    );

    expect(opportunist).toBeGreaterThan(loyal);
  });

  it('lower reputation reduces acceptance score', () => {
    const world = sharedEnemyAgainstCaesarWorld();
    const neutral = scoreAllianceAcceptance(world, CAESAR, GENGHIS);
    const wary: WorldState = {
      ...world,
      reputation: {
        ...world.reputation,
        [CAESAR]: {
          ...world.reputation[CAESAR],
          [GENGHIS]: -50,
        },
      },
    };
    const lowRep = scoreAllianceAcceptance(wary, CAESAR, GENGHIS);

    expect(lowRep).toBeLessThan(neutral);
  });

  it('shared enemies increase proposal score', () => {
    const calm = createSprint4World(START_MS);
    const shared = sharedEnemyAgainstCaesarWorld();

    expect(sharedEnemies(shared, GENGHIS, BRITAIN)).toContain(CAESAR);
    expect(scoreAllianceProposal(shared, GENGHIS, BRITAIN)).toBeGreaterThan(
      scoreAllianceProposal(calm, GENGHIS, BRITAIN),
    );
  });

  it('peer military power is more attractive than a non-peer', () => {
    const world = createSprint4World(START_MS);
    const genghisPower = factionMilitaryPower(world, GENGHIS);
    const caesarPower = factionMilitaryPower(world, CAESAR);

    expect(genghisPower).toBeGreaterThan(0);
    expect(caesarPower).toBeGreaterThan(0);

    const peerScore = scoreAllianceProposal(world, GENGHIS, CAESAR);
    const inflated: WorldState = {
      ...world,
      units: {
        ...world.units,
        'unit-rome-giant': {
          id: 'unit-rome-giant',
          typeId: 'mg-armor-t5',
          ownerId: CAESAR,
          count: 500,
          locationId: PARIS,
          stance: 'defend',
        },
      },
    };
    const nonPeerScore = scoreAllianceProposal(inflated, GENGHIS, CAESAR);

    expect(peerScore).toBeGreaterThan(nonPeerScore);
  });

  it('shared enemy detection uses assault transit and stationed invasion, not default hostility', () => {
    const calm = createSprint4World(START_MS);
    expect(isEnemyOf(calm, GENGHIS, CAESAR)).toBe(false);

    const hostile = sharedEnemyAgainstCaesarWorld();
    expect(isEnemyOf(hostile, GENGHIS, CAESAR)).toBe(true);
    expect(isEnemyOf(hostile, BRITAIN, CAESAR)).toBe(true);
    expect(isEnemyOf(hostile, GENGHIS, BRITAIN)).toBe(false);
  });

  it('applyAiDiplomaticDecisions is deterministic', () => {
    const world = sharedEnemyAgainstCaesarWorld();
    const first = applyAiDiplomaticDecisions(world, START_MS).world;
    const second = applyAiDiplomaticDecisions(world, START_MS).world;

    expect(first.alliances).toEqual(second.alliances);
    expect(first.reputation).toEqual(second.reputation);
  });

  it('AI break path applies reputation penalties from Phase 4a', () => {
    const allied = formAlliance(createSprint4World(START_MS), GENGHIS, BRITAIN, START_MS).world;
    const dominantAlly: WorldState = {
      ...allied,
      units: {
        ...allied.units,
        'unit-britain-giant': {
          id: 'unit-britain-giant',
          typeId: 'mg-armor-t5',
          ownerId: BRITAIN,
          count: 600,
          locationId: 'territory-madrid',
          stance: 'defend',
        },
      },
    };
    const opportunistWorld = withLeaderPosture(dominantAlly, 'leader-genghis', 'opportunist');

    expect(scoreAllianceBreak(opportunistWorld, GENGHIS, BRITAIN)).toBeGreaterThanOrEqual(
      ALLIANCE_BREAK_THRESHOLD,
    );

    const broken = applyAiDiplomaticDecisions(opportunistWorld, START_MS).world;
    expect(areAllied(broken, GENGHIS, BRITAIN)).toBe(false);
    expect(broken.reputation[BRITAIN][GENGHIS]).toBe(REPUTATION_PENALTY_ALLIANCE_BREAK_BETRAYED);
  });

  it('AI proposal and acceptance can form an alliance that feeds allied intel emission', () => {
    const world = sharedEnemyAgainstCaesarWorld();
    expect(scoreAllianceProposal(world, GENGHIS, BRITAIN)).toBeGreaterThanOrEqual(
      ALLIANCE_PROPOSE_THRESHOLD,
    );
    expect(scoreAllianceAcceptance(world, BRITAIN, GENGHIS)).toBeGreaterThanOrEqual(
      ALLIANCE_ACCEPT_THRESHOLD,
    );

    const allied = applyAiDiplomaticDecisions(world, START_MS).world;
    expect(areAllied(allied, GENGHIS, BRITAIN)).toBe(true);

    const observedAt = START_MS + 1_000;
    const withDirect = {
      ...allied,
      nowMs: observedAt,
      intel: recordIntelObservations({
        ...allied,
        nowMs: observedAt,
      }),
    };
    const store = recordAlliedObservations(withDirect, observedAt);
    expect((store[BRITAIN] ?? []).some((record) => record.source === 'allied')).toBe(true);
  });
});

describe('AI diplomacy cold-play #1 (72h, pre-transit scoring)', () => {
  it('records alliance state, Genghis scout activity, and player digest', () => {
    const { events, world } = advanceTo(createSprint4World(START_MS), START_MS + SEVENTY_TWO_HOURS_MS);
    const digest = renderDigestText(world, events, undefined, PLAYER);

    const steppeScoutBuilds = events.filter(
      (event) =>
        event.kind === 'buildStarted' &&
        event.countryId === GENGHIS &&
        event.unitTypeId === SCOUT_UNIT_TYPE_ID,
    );
    const steppeScoutMoves = events.filter(
      (event) =>
        event.kind === 'departure' &&
        event.ownerId === GENGHIS &&
        event.unitTypeId === SCOUT_UNIT_TYPE_ID,
    );
    const genghisOrders = decideOrders(world, GENGHIS, world.nowMs);

    const observation = {
      alliances: world.alliances,
      reputationSample: {
        caesarViewOfGenghis: world.reputation[CAESAR]?.[GENGHIS] ?? 0,
        britainViewOfGenghis: world.reputation[BRITAIN]?.[GENGHIS] ?? 0,
      },
      scoutBuilds: steppeScoutBuilds.length,
      scoutMoves: steppeScoutMoves.length,
      genghisOrdersAtEnd: genghisOrders.map((order) => order.kind),
      digest,
    };

    expect(observation).toMatchSnapshot('sprint6-4b-cold-play-72h-digest');
  });
});

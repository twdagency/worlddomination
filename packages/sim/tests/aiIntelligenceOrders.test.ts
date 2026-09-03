import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { createTutorialWorld } from '../../shared/src/scenario-tutorial';
import { LEADERS_BY_ID } from '../../shared/src/leaders';
import { UNIT_TYPES_BY_ID } from '../../shared/src/units';
import {
  applyAiInfluenceOrders,
  applyAiIntelligenceOrders,
  applyGatherIntelligence,
  calculateCoupSuccessRate,
  captureIntelligenceSnapshot,
  collectAiIntelligenceOrders,
  collectAiInfluenceOrders,
  collectAiThresholdOrders,
  COUP_INFLUENCE_FLOOR,
  ensureWorldMigrations,
  formAlliance,
  getInfluence,
  INTELLIGENCE_COOLDOWN_MS,
  INTELLIGENCE_GATHER_COST,
  INTELLIGENCE_MIN_INFLUENCE,
  isAiInfluenceAgencyActive,
  isIntelligenceOnCooldown,
  latestIntelligenceRecord,
  pickBestAiInfluenceAction,
  resolveAiDailyInfluenceChannel,
  scoreAiThresholdAction,
  validateGatherIntelligence,
  tick,
} from '../src';
import { ensureWorldInfluence, setInfluence } from '../src/influence';
import { MS_PER_DAY } from '../src/constants';
import { tagOrder } from './fixtures';
import type { WorldState } from '../src/types';

const START_MS = 1_700_900_000_000;
const PLAYER = 'faction-player';
const STEPPE = 'faction-steppe';
const LONDON = 'territory-london';
const PARIS = 'territory-paris';
const KEYSTONE_SEED = 42;

function eligibleAt(world: WorldState): number {
  return world.startMs + MS_PER_DAY;
}

function migrate(world: WorldState): WorldState {
  return ensureWorldMigrations(world, {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

function sprint4(overrides: Partial<WorldState> = {}): WorldState {
  return migrate({
    ...ensureWorldInfluence(createSprint4World(START_MS)),
    ...overrides,
  });
}

function richAi(world: WorldState): WorldState {
  const factions = { ...world.factions };
  for (const [id, faction] of Object.entries(factions)) {
    if (faction.isPlayer) continue;
    factions[id] = { ...faction, funding: 50_000, manpower: 500 };
  }
  return { ...world, factions };
}

function londonGarrisonWorld(
  garrisonCount: number,
  withIntel: boolean,
  seed: number = KEYSTONE_SEED,
): WorldState {
  let world = richAi(
    setInfluence(
      sprint4({ rng: { seed } }),
      LONDON,
      STEPPE,
      COUP_INFLUENCE_FLOOR + 5,
      START_MS,
    ),
  );
  const units = { ...world.units };
  for (const [id, unit] of Object.entries(units)) {
    if (unit.locationId === LONDON && unit.ownerId === PLAYER) {
      units[id] = { ...unit, count: 0 };
    }
  }
  units['unit-test-london-garrison'] = {
    id: 'unit-test-london-garrison',
    typeId: 'levy-t1',
    ownerId: PLAYER,
    count: garrisonCount,
    locationId: LONDON,
    stance: 'defend',
  };
  world = { ...world, units };
  const at = eligibleAt(world);
  if (withIntel) {
    world = applyGatherIntelligence(world, STEPPE, LONDON, at).world;
  }
  return world;
}

describe('AI intelligence — keystone decision delta', () => {
  it('strong garrison intel dissuades coup versus acting blind on fixed seed', () => {
    const at = START_MS + MS_PER_DAY;
    const blind = londonGarrisonWorld(80, false);
    const informed = londonGarrisonWorld(80, true);

    const blindRate = calculateCoupSuccessRate(blind, STEPPE, LONDON, at);
    const informedRate = calculateCoupSuccessRate(informed, STEPPE, LONDON, at);
    expect(informedRate).toBeLessThan(blindRate);

    const blindCoup = scoreAiThresholdAction(
      blind,
      STEPPE,
      { targetCityId: LONDON, action: 'coup-attempt' },
      at,
    );
    const informedCoup = scoreAiThresholdAction(
      informed,
      STEPPE,
      { targetCityId: LONDON, action: 'coup-attempt' },
      at,
    );
    expect(informedCoup.rationale.signals.coupSuccessRate).toBeLessThan(
      blindCoup.rationale.signals.coupSuccessRate!,
    );

    const blindAccel = pickBestAiInfluenceAction(blind, STEPPE, at)!;
    expect(blindCoup.score).toBeGreaterThan(blindAccel.score);
    expect(informedCoup.score).toBeLessThan(blindCoup.score);
    expect(resolveAiDailyInfluenceChannel(blind, STEPPE, at)).toBe('threshold');
  });

  it('weak garrison intel encourages coup versus acting blind on fixed seed', () => {
    const at = START_MS + MS_PER_DAY;
    const blind = londonGarrisonWorld(3, false);
    const informed = londonGarrisonWorld(3, true);

    const blindRate = calculateCoupSuccessRate(blind, STEPPE, LONDON, at);
    const informedRate = calculateCoupSuccessRate(informed, STEPPE, LONDON, at);
    expect(informedRate).toBeGreaterThan(blindRate);

    const blindCoup = scoreAiThresholdAction(
      blind,
      STEPPE,
      { targetCityId: LONDON, action: 'coup-attempt' },
      at,
    );
    const informedCoup = scoreAiThresholdAction(
      informed,
      STEPPE,
      { targetCityId: LONDON, action: 'coup-attempt' },
      at,
    );
    expect(informedCoup.score).toBeGreaterThan(blindCoup.score);

    const informedAccel = pickBestAiInfluenceAction(informed, STEPPE, at)!;
    expect(informedCoup.score).toBeGreaterThan(informedAccel.score);
  });
});

describe('gather intelligence action', () => {
  it('requires 30+ influence foothold', () => {
    const world = richAi(setInfluence(sprint4(), LONDON, STEPPE, 29, START_MS));
    expect(getInfluence(world, LONDON, STEPPE)).toBe(29);
    expect(validateGatherIntelligence(world, STEPPE, LONDON, START_MS).ok).toBe(false);
  });

  it('deducts gold and emits enriched intelReport on success', () => {
    const world = richAi(setInfluence(sprint4(), LONDON, STEPPE, INTELLIGENCE_MIN_INFLUENCE, START_MS));
    const at = eligibleAt(world);
    const before = world.factions[STEPPE]!.funding;
    const result = applyGatherIntelligence(world, STEPPE, LONDON, at);
    expect(result.events.some((event) => event.kind === 'intelReport' && event.source === 'intelligence')).toBe(
      true,
    );
    expect(result.world.factions[STEPPE]!.funding).toBe(before - INTELLIGENCE_GATHER_COST);
    const record = latestIntelligenceRecord(result.world, STEPPE, LONDON, at);
    expect(record?.snapshot.enriched?.garrisonDetail).toBeDefined();
    expect(record?.snapshot.enriched?.productionQueue).toBeDefined();
  });

  it('enriched snapshot reveals full garrison unlike fogged scout snapshot', () => {
    const world = richAi(setInfluence(sprint4(), LONDON, STEPPE, 40, START_MS));
    const enriched = captureIntelligenceSnapshot(world, STEPPE, LONDON);
    expect(enriched.enriched!.garrisonDetail.totalCount).toBeGreaterThan(0);
    expect(enriched.visibleEnemyGarrison).toBe(0);
  });

  it('per-(actor, city) cooldown blocks London but not Paris', () => {
    const world = richAi(
      setInfluence(setInfluence(sprint4(), LONDON, STEPPE, 40, START_MS), PARIS, STEPPE, 40, START_MS),
    );
    const at = eligibleAt(world);
    const london = applyGatherIntelligence(world, STEPPE, LONDON, at).world;
    expect(isIntelligenceOnCooldown(london, STEPPE, LONDON, at + 1)).toBe(true);
    expect(isIntelligenceOnCooldown(london, STEPPE, PARIS, at + 1)).toBe(false);
    const paris = applyGatherIntelligence(london, STEPPE, PARIS, at + 1);
    expect(paris.events.some((event) => event.kind === 'intelReport')).toBe(true);
  });

  it('blocks re-gather on same city before cooldown expires', () => {
    const world = richAi(setInfluence(sprint4(), LONDON, STEPPE, 40, START_MS));
    const at = eligibleAt(world);
    const first = applyGatherIntelligence(world, STEPPE, LONDON, at);
    const second = applyGatherIntelligence(first.world, STEPPE, LONDON, at + MS_PER_DAY);
    expect(second.events).toEqual([]);
  });

  it('allows re-gather after cooldown window', () => {
    const world = richAi(setInfluence(sprint4(), LONDON, STEPPE, 40, START_MS));
    const at = eligibleAt(world);
    const first = applyGatherIntelligence(world, STEPPE, LONDON, at);
    const later = applyGatherIntelligence(
      first.world,
      STEPPE,
      LONDON,
      at + INTELLIGENCE_COOLDOWN_MS,
    );
    expect(later.events.some((event) => event.kind === 'intelReport')).toBe(true);
  });
});

describe('AI intelligence orders', () => {
  it('runs parallel to daily influence-channel action in the same tick', () => {
    const world = richAi(setInfluence(sprint4(), LONDON, STEPPE, 40, START_MS));
    const at = eligibleAt(world);
    expect(collectAiIntelligenceOrders(world, at).some((order) => order.ownerId === STEPPE)).toBe(true);
    expect(collectAiInfluenceOrders(world, at).some((order) => order.ownerId === STEPPE)).toBe(true);

    const intel = applyAiIntelligenceOrders(world, at);
    expect(intel.events.some((event) => event.kind === 'intelReport' && event.source === 'intelligence')).toBe(
      true,
    );
    const influenceResult = applyAiInfluenceOrders(intel.world, at);
    expect(
      influenceResult.events.some(
        (event) =>
          event.kind === 'subversionApplied' ||
          event.kind === 'culturalCampaignApplied' ||
          event.kind === 'diplomaticMissionStarted',
      ),
    ).toBe(true);
  });

  it('does not consume aiInfluenceCooldowns', () => {
    const world = richAi(setInfluence(sprint4(), LONDON, STEPPE, 40, START_MS));
    const at = eligibleAt(world);
    const intel = applyAiIntelligenceOrders(world, at);
    expect(intel.world.aiInfluenceCooldowns?.[STEPPE]).toBeUndefined();
    const influence = applyAiInfluenceOrders(intel.world, at);
    expect(
      influence.events.some(
        (event) =>
          event.kind === 'subversionApplied' ||
          event.kind === 'culturalCampaignApplied' ||
          event.kind === 'diplomaticMissionStarted',
      ),
    ).toBe(true);
  });

  it('returns no orders in tutorial scenarios', () => {
    const world = migrate(ensureWorldInfluence(createTutorialWorld(START_MS)));
    expect(collectAiIntelligenceOrders(world, world.nowMs)).toEqual([]);
  });

  it('never targets allied countries', () => {
    const allied = formAlliance(
      richAi(setInfluence(sprint4(), LONDON, STEPPE, 40, START_MS)),
      STEPPE,
      PLAYER,
      START_MS,
    ).world;
    expect(collectAiIntelligenceOrders(allied, eligibleAt(allied))).toEqual([]);
  });
});

describe('AI intelligence regressions', () => {
  it('production factory path keeps AI influence agency active by default', () => {
    const world = migrate(createSprint4World(START_MS));
    expect(world.aiInfluenceAgencySuppressed).toBeUndefined();
    expect(isAiInfluenceAgencyActive(world)).toBe(true);
  });

  it('player gather-intelligence order still works', () => {
    const world = richAi({
      ...sprint4(),
      factions: {
        ...sprint4().factions,
        [PLAYER]: { ...sprint4().factions[PLAYER]!, funding: 50_000, isPlayer: true },
      },
    });
    const prepared = setInfluence(world, PARIS, PLAYER, 35, START_MS);
    const order = tagOrder(
      prepared,
      { kind: 'gather-intelligence', ownerId: PLAYER, targetCityId: PARIS },
      PLAYER,
    );
    const result = tick(prepared, [order], 0);
    expect(result.events.some((event) => event.kind === 'intelReport' && event.source === 'intelligence')).toBe(
      true,
    );
  });

  it('Phase 5 channel competition still applies when intelligence is present', () => {
    const world = richAi(setInfluence(sprint4(), LONDON, STEPPE, COUP_INFLUENCE_FLOOR, START_MS));
    const at = eligibleAt(world);
    expect(collectAiInfluenceOrders(world, at).filter((order) => order.ownerId === STEPPE)).toHaveLength(0);
    expect(collectAiThresholdOrders(world, at).filter((order) => order.ownerId === STEPPE)).toHaveLength(1);
    expect(resolveAiDailyInfluenceChannel(world, STEPPE, at)).toBe('threshold');
  });

  it('passive influence accrual continues after intelligence tick', () => {
    const world = richAi(sprint4());
    const result = tick(world, [], MS_PER_DAY);
    expect(getInfluence(result.world, LONDON, STEPPE)).toBeGreaterThanOrEqual(0);
  });
});

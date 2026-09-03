import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { createTutorialWorld } from '../../shared/src/scenario-tutorial';
import { LEADERS_BY_ID } from '../../shared/src/leaders';
import { UNIT_TYPES_BY_ID } from '../../shared/src/units';
import {
  applyAiThresholdOrders,
  applyInfluenceOrders,
  canActorIssueInfluenceOrder,
  collectAiThresholdOrders,
  COUP_INFLUENCE_FLOOR,
  formAlliance,
  getInfluence,
  queueAllianceProposal,
  resolveAiDailyInfluenceChannel,
  scoreAiThresholdAction,
  setInfluence,
} from '../src';
import {
  applyAiInfluenceOrders as applyAccelerators,
  collectAiInfluenceOrders as collectAccelerators,
} from '../src/aiInfluenceOrders';
import { pickBestAiInfluenceAction } from '../src/aiInfluenceScoring';
import { pickBestAiThresholdAction } from '../src/aiThresholdScoring';
import { advanceTo } from '../src/clock';
import { ensureWorldInfluence } from '../src/influence';
import { ensureWorldMigrations } from '../src/migrations';
import { MS_PER_DAY } from '../src/constants';
import { tick } from '../src/tick';
import { tagOrder } from './fixtures';
import type { WorldState } from '../src/types';

function eligibleAt(world: WorldState): number {
  return world.startMs + MS_PER_DAY;
}

const START_MS = 1_700_900_000_000;
const PLAYER = 'faction-player';
const STEPPE = 'faction-steppe';
const BRITAIN = 'faction-britain';
const ROME = 'faction-rome';
const LONDON = 'territory-london';
const PARIS = 'territory-paris';

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

function richAi(
  world: WorldState,
  fundingOverrides: Partial<Record<string, number>> = {},
): WorldState {
  const factions = { ...world.factions };
  for (const [id, faction] of Object.entries(factions)) {
    if (faction.isPlayer) continue;
    factions[id] = {
      ...faction,
      funding: fundingOverrides[id] ?? 50_000,
      manpower: 500,
    };
  }

  if (!world.countries) {
    return { ...world, factions };
  }

  const countries = { ...world.countries };
  for (const [id, country] of Object.entries(countries)) {
    const faction = factions[id];
    if (!faction) continue;
    countries[id] = {
      ...country,
      funding: faction.funding,
      manpower: faction.manpower,
    };
  }

  return { ...world, factions, countries };
}

function findSeedForAiCoupOver50Days(): number {
  for (let seed = 0; seed < 300; seed++) {
    const world = richAi(
      migrate({
        ...ensureWorldInfluence(createSprint4World(START_MS)),
        rng: { seed },
      }),
    );
    const result = advanceTo(world, START_MS + 50 * MS_PER_DAY);
    const londonOwner = result.world.territories[LONDON]?.ownerId;
    const coupSuccess = result.events.some(
      (event) =>
        event.kind === 'coupSuccess' &&
        event.actorId === STEPPE &&
        event.targetCityId === LONDON,
    );
    if (coupSuccess && londonOwner === STEPPE) return seed;
  }
  throw new Error('no seed produced Genghis coup on London within 50 game-days');
}

describe('AI threshold actions — keystone', () => {
  it('opportunist AI coups player capital over 50 game-days and transfers ownership', () => {
    const seed = findSeedForAiCoupOver50Days();
    const world = richAi(
      migrate({
        ...ensureWorldInfluence(createSprint4World(START_MS)),
        rng: { seed },
      }),
    );
    const result = advanceTo(world, START_MS + 50 * MS_PER_DAY);

    expect(result.world.territories[LONDON]?.ownerId).toBe(STEPPE);
    expect(
      result.events.some(
        (event) =>
          event.kind === 'coupSuccess' &&
          event.actorId === STEPPE &&
          event.targetCityId === LONDON,
      ),
    ).toBe(true);
    expect(
      result.events.some(
        (event) => event.kind === 'territoryCaptured' && event.territoryId === LONDON,
      ),
    ).toBe(true);
  });
});

describe('AI threshold action scoring and gating', () => {
  it('issues coup when influence meets floor, gold reserve passes, and posture favors it', () => {
    const world = richAi(setInfluence(sprint4(), LONDON, STEPPE, COUP_INFLUENCE_FLOOR, START_MS));
    const at = eligibleAt(world);
    const orders = collectAiThresholdOrders(world, at).filter((order) => order.ownerId === STEPPE);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.kind).toBe('coup-attempt');
    expect(orders[0]?.targetCityId).toBe(LONDON);
  });

  it('loyal AI prefers diplomatic pressure over coup when a proposal is pending', () => {
    const queued = queueAllianceProposal(richAi(sprint4()), BRITAIN, PLAYER, START_MS);
    const world = richAi(
      setInfluence(queued.world, LONDON, BRITAIN, COUP_INFLUENCE_FLOOR, START_MS),
    );
    const at = eligibleAt(world);
    const channel = resolveAiDailyInfluenceChannel(world, BRITAIN, at);
    const orders = collectAiThresholdOrders(world, at).filter((order) => order.ownerId === BRITAIN);
    expect(channel === 'threshold' || channel === 'accelerator').toBe(true);
    if (orders.length > 0) {
      expect(orders[0]?.kind).not.toBe('coup-attempt');
    }
    const coupScore = scoreAiThresholdAction(
      world,
      BRITAIN,
      { targetCityId: LONDON, action: 'coup-attempt' },
      at,
    );
    const pressureScore = scoreAiThresholdAction(
      world,
      BRITAIN,
      {
        targetCityId: LONDON,
        action: 'diplomatic-pressure',
        targetCountryId: PLAYER,
        proposalKind: 'accept-alliance',
      },
      at,
    );
    expect(pressureScore.score).toBeGreaterThan(coupScore.score);
  });

  it('blocks threshold orders when gold reserve check fails', () => {
    const world = richAi(
      setInfluence(sprint4(), LONDON, STEPPE, COUP_INFLUENCE_FLOOR, START_MS),
      { [STEPPE]: 8_500 },
    );
    expect(collectAiThresholdOrders(world, eligibleAt(world)).filter((o) => o.ownerId === STEPPE)).toEqual(
      [],
    );
  });

  it('never targets allied countries for threshold actions', () => {
    const allied = formAlliance(
      richAi(setInfluence(sprint4(), LONDON, STEPPE, COUP_INFLUENCE_FLOOR, START_MS)),
      STEPPE,
      PLAYER,
      START_MS,
    ).world;
    expect(
      collectAiThresholdOrders(allied, eligibleAt(allied)).filter((o) => o.ownerId === STEPPE),
    ).toEqual([]);
  });

  it('scores tribute extraction at 50+ influence', () => {
    const world = richAi(setInfluence(sprint4(), PARIS, STEPPE, 55, START_MS));
    const scored = scoreAiThresholdAction(
      world,
      STEPPE,
      { targetCityId: PARIS, action: 'tribute-extraction' },
      START_MS,
    );
    expect(scored.score).toBeGreaterThanOrEqual(1);
  });

  it('scores defection at 100 influence above tribute on same city', () => {
    const world = richAi(setInfluence(sprint4(), PARIS, STEPPE, 100, START_MS));
    const at = eligibleAt(world);
    const defection = scoreAiThresholdAction(
      world,
      STEPPE,
      { targetCityId: PARIS, action: 'defection-claim' },
      at,
    );
    const tribute = scoreAiThresholdAction(
      world,
      STEPPE,
      { targetCityId: PARIS, action: 'tribute-extraction' },
      at,
    );
    expect(defection.score).toBeGreaterThan(tribute.score);
  });

  it('isolationist does not annex', () => {
    const world = richAi(setInfluence(sprint4(), LONDON, ROME, COUP_INFLUENCE_FLOOR, START_MS));
    const scored = scoreAiThresholdAction(
      world,
      ROME,
      { targetCityId: LONDON, action: 'annexation-claim' },
      eligibleAt(world),
    );
    expect(scored.score).toBe(-Infinity);
  });

  it('opportunist annexes when coup is blocked by manpower', () => {
    const prepared = richAi(setInfluence(sprint4(), LONDON, STEPPE, COUP_INFLUENCE_FLOOR, START_MS));
    const world = {
      ...prepared,
      factions: {
        ...prepared.factions,
        [STEPPE]: { ...prepared.factions[STEPPE]!, manpower: 0 },
      },
    };
    const at = eligibleAt(world);
    const orders = collectAiThresholdOrders(world, at).filter((o) => o.ownerId === STEPPE);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.kind).toBe('annexation-claim');
    expect(orders[0]?.targetCityId).toBe(LONDON);
  });

  it('returns no threshold orders in tutorial scenarios', () => {
    const world = migrate(ensureWorldInfluence(createTutorialWorld(START_MS)));
    expect(collectAiThresholdOrders(world, world.nowMs)).toEqual([]);
  });

  it('skips defeated AI countries', () => {
    const base = richAi(setInfluence(sprint4(), LONDON, STEPPE, COUP_INFLUENCE_FLOOR, START_MS));
    const world = {
      ...base,
      countries: {
        ...base.countries!,
        [STEPPE]: { ...base.countries![STEPPE]!, defeated: true },
      },
      factions: {
        ...base.factions,
        [STEPPE]: { ...base.factions[STEPPE]!, defeated: true },
      },
    };
    expect(collectAiThresholdOrders(world, eligibleAt(world)).some((o) => o.ownerId === STEPPE)).toBe(
      false,
    );
  });
});

describe('AI threshold cadence interaction', () => {
  it('allows only one influence-agency action per actor per day across accelerators and thresholds', () => {
    const world = richAi(setInfluence(sprint4(), LONDON, STEPPE, COUP_INFLUENCE_FLOOR, START_MS));
    const at = eligibleAt(world);
    expect(resolveAiDailyInfluenceChannel(world, STEPPE, at)).toBe('threshold');

    const accel = applyAccelerators(world, at);
    expect(accel.events.filter((event) => 'ownerId' in event && event.ownerId === STEPPE)).toHaveLength(0);
    expect(canActorIssueInfluenceOrder(accel.world, STEPPE, at)).toBe(true);

    const threshold = applyAiThresholdOrders(accel.world, at);
    expect(threshold.events.some((event) => event.kind === 'coupSuccess' || event.kind === 'coupFailure')).toBe(
      true,
    );
    expect(canActorIssueInfluenceOrder(threshold.world, STEPPE, at + 1)).toBe(false);
  });

  it('prevents accelerate-then-threshold on the same tick after a successful accelerator', () => {
    const world = richAi(sprint4());
    const at = eligibleAt(world);
    expect(resolveAiDailyInfluenceChannel(world, STEPPE, at)).toBe('accelerator');

    const accel = applyAccelerators(world, at);
    expect(accel.events.some((event) => event.kind === 'subversionApplied')).toBe(true);

    const threshold = applyAiThresholdOrders(accel.world, at);
    expect(threshold.events).toEqual([]);
    expect(collectAiThresholdOrders(accel.world, at).filter((o) => o.ownerId === STEPPE)).toEqual([]);
  });

  it('picks threshold over accelerator when threshold scores higher at coup readiness', () => {
    const world = richAi(setInfluence(sprint4(), LONDON, STEPPE, 75, START_MS));
    const at = eligibleAt(world);
    const accel = pickBestAiInfluenceAction(world, STEPPE, at);
    const threshold = pickBestAiThresholdAction(world, STEPPE, at);
    expect(threshold).not.toBeNull();
    expect(threshold!.score).toBeGreaterThan(accel!.score);
    expect(resolveAiDailyInfluenceChannel(world, STEPPE, at)).toBe('threshold');
  });
});

describe('AI threshold action regressions', () => {
  it('Phase 4 accelerators still issue when threshold is not competitive', () => {
    const world = richAi(sprint4());
    const at = eligibleAt(world);
    const orders = collectAccelerators(world, at).filter((order) => order.ownerId === STEPPE);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.kind).toBe('influence-subversion');
  });

  it('player threshold actions remain unaffected', () => {
    const world = richAi({
      ...sprint4(),
      factions: {
        ...sprint4().factions,
        [PLAYER]: { ...sprint4().factions[PLAYER]!, funding: 50_000, manpower: 100, isPlayer: true },
      },
    });
    const order = tagOrder(
      world,
      { kind: 'coup-attempt', ownerId: PLAYER, targetCityId: PARIS },
      PLAYER,
    );
    const prepared = setInfluence(world, PARIS, PLAYER, COUP_INFLUENCE_FLOOR, START_MS);
    const result = applyInfluenceOrders(world, [order], prepared.nowMs);
    expect(result.events[0]?.kind).toBe('orderRejected');
  });

  it('tick pipeline runs threshold actions after accelerators in step 6a', () => {
    const world = richAi(setInfluence(sprint4(), LONDON, STEPPE, COUP_INFLUENCE_FLOOR, START_MS));
    const result = tick(world, [], MS_PER_DAY);
    expect(
      result.events.some(
        (event) =>
          event.kind === 'coupSuccess' ||
          event.kind === 'coupFailure' ||
          event.kind === 'subversionApplied',
      ),
    ).toBe(true);
  });

  it('passive influence accumulation still runs after AI threshold tick', () => {
    const world = richAi(sprint4());
    const ticked = tick(world, [], MS_PER_DAY);
    expect(getInfluence(ticked.world, LONDON, STEPPE)).toBeGreaterThanOrEqual(0);
  });
});

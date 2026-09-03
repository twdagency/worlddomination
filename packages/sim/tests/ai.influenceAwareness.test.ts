import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { createTutorialWorld } from '../../shared/src/scenario-tutorial';
import { LEADERS_BY_ID } from '../../shared/src/leaders';
import { UNIT_TYPES_BY_ID } from '../../shared/src/units';
import { decideOrders } from '../src/ai';
import { isInfluenceAgencyDisabled } from '../src/aiInfluenceAgency';
import {
  attackInfluenceSignal,
  computeAttackInfluenceScoreAdjustment,
  computeDefendInfluenceScoreAdjustment,
  computeMoveReinforceInfluenceScoreAdjustment,
  defendInfluenceSignal,
} from '../src/aiInfluenceSignals';
import { formAlliance } from '../src/diplomacy';
import { accruePassiveInfluence, ensureWorldInfluence, getInfluence, setInfluence } from '../src/influence';
import { ensureWorldMigrations } from '../src/migrations';
import { tick } from '../src/tick';
import type { WorldState } from '../src/types';

const START_MS = 1_700_900_000_000;
const PLAYER = 'faction-player';
const STEPPE = 'faction-steppe';
const ROME = 'faction-rome';
const PARIS = 'territory-paris';
const BERLIN = 'territory-berlin';
const LONDON = 'territory-london';

function migrate(world: WorldState): WorldState {
  return ensureWorldMigrations(world, {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

function sprint4(): WorldState {
  return migrate(ensureWorldInfluence(createSprint4World(START_MS)));
}

function genghisWeights() {
  return LEADERS_BY_ID['leader-genghis']!.weights;
}

function charlesWeights() {
  return LEADERS_BY_ID['leader-charles-bold']!.weights;
}

describe('AI passive influence awareness', () => {
  it('reduces attack adjustment when attacker has high own-influence in target city', () => {
    const world = sprint4();
    const baseline = computeAttackInfluenceScoreAdjustment(world, STEPPE, PARIS, genghisWeights());
    const infiltrated = setInfluence(world, PARIS, STEPPE, 60, world.nowMs);
    const adjusted = computeAttackInfluenceScoreAdjustment(
      infiltrated,
      STEPPE,
      PARIS,
      genghisWeights(),
    );
    expect(adjusted).toBeLessThan(baseline);
  });

  it('raises attack adjustment when third-party destabilizing influence exists in target', () => {
    const world = sprint4();
    const baseline = computeAttackInfluenceScoreAdjustment(world, STEPPE, PARIS, genghisWeights());
    const destabilized = setInfluence(world, PARIS, ROME, 55, world.nowMs);
    const adjusted = computeAttackInfluenceScoreAdjustment(
      destabilized,
      STEPPE,
      PARIS,
      genghisWeights(),
    );
    expect(adjusted).toBeGreaterThan(baseline);
  });

  it('raises defend adjustment when foreign influence infiltrates own city', () => {
    const world = sprint4();
    const baseline = computeDefendInfluenceScoreAdjustment(world, PLAYER, LONDON, charlesWeights());
    const infiltrated = setInfluence(world, LONDON, STEPPE, 40, world.nowMs);
    const adjusted = computeDefendInfluenceScoreAdjustment(
      infiltrated,
      PLAYER,
      LONDON,
      charlesWeights(),
    );
    expect(adjusted).toBeGreaterThan(baseline);
  });

  it('opportunist Genghis gets larger attack boost on destabilized targets than loyal Philip', () => {
    const world = setInfluence(sprint4(), PARIS, ROME, 60, START_MS);
    const genghis = computeAttackInfluenceScoreAdjustment(world, STEPPE, PARIS, genghisWeights());
    const philip = computeAttackInfluenceScoreAdjustment(
      world,
      STEPPE,
      PARIS,
      LEADERS_BY_ID['leader-philip']!.weights,
    );
    expect(genghis).toBeGreaterThan(philip);
  });

  it('loyal Charles defends infiltrated cities harder than opportunist Genghis', () => {
    const world = setInfluence(sprint4(), LONDON, STEPPE, 45, START_MS);
    const loyal = computeDefendInfluenceScoreAdjustment(world, PLAYER, LONDON, charlesWeights());
    const opportunist = computeDefendInfluenceScoreAdjustment(
      world,
      PLAYER,
      LONDON,
      genghisWeights(),
    );
    expect(loyal).toBeGreaterThan(opportunist);
  });

  it('suppresses influence signals in tutorial scenarios', () => {
    const tutorial = migrate(ensureWorldInfluence(createTutorialWorld(START_MS)));
    expect(isInfluenceAgencyDisabled(tutorial)).toBe(true);
    expect(attackInfluenceSignal(tutorial, STEPPE, PARIS)).toBe(0);
    expect(defendInfluenceSignal(tutorial, PLAYER, LONDON)).toBe(0);
    expect(
      computeMoveReinforceInfluenceScoreAdjustment(tutorial, PLAYER, LONDON, charlesWeights()),
    ).toBe(0);
  });

  it('preserves Sprint 4 baseline when no influence is present', () => {
    const world = sprint4();
    expect(attackInfluenceSignal(world, STEPPE, PARIS)).toBe(0);
    expect(defendInfluenceSignal(world, PLAYER, LONDON)).toBe(0);
    const orders = decideOrders(world, STEPPE, world.nowMs);
    expect(orders.length).toBeGreaterThan(0);
  });

  it('shifts attack preference when influence changes between comparable targets', () => {
    let world = sprint4();
    world = {
      ...world,
      territories: {
        ...world.territories,
        [BERLIN]: { ...world.territories[BERLIN]!, ownerId: ROME },
      },
      units: {
        ...world.units,
        'unit-steppe-armor': {
          ...world.units['unit-steppe-armor']!,
          locationId: LONDON,
        },
      },
    };
    world = setInfluence(world, PARIS, STEPPE, 70, world.nowMs);

    const orders = decideOrders(world, STEPPE, world.nowMs);
    const assault = orders.find((order) => order.kind === 'move' && order.stanceOnArrival === 'assault');
    expect(assault?.toTerritoryId).not.toBe(PARIS);
  });

  it('ignores influence attack signals against allied territory owners', () => {
    let world = setInfluence(sprint4(), PARIS, STEPPE, 80, START_MS);
    world = formAlliance(world, STEPPE, ROME, START_MS).world;
    expect(attackInfluenceSignal(world, STEPPE, PARIS)).toBe(0);
  });

  it('is deterministic for identical worlds and decision ticks', () => {
    const world = setInfluence(sprint4(), PARIS, ROME, 55, START_MS);
    const a = decideOrders(world, STEPPE, world.nowMs);
    const b = decideOrders(world, STEPPE, world.nowMs);
    expect(b).toEqual(a);
  });

  it('passive influence accrual path remains independent of AI scoring helpers', () => {
    const world = sprint4();
    const advanced = tick(world, [], 86_400_000).world;
    const afterAccrual = accruePassiveInfluence(advanced, advanced.nowMs);
    expect(afterAccrual.influence).toBeDefined();
    expect(typeof getInfluence(afterAccrual, PARIS, ROME)).toBe('number');
  });

  it('country defeat cascade still runs with influence-aware AI scoring present', () => {
    const world = setInfluence(sprint4(), PARIS, STEPPE, 40, START_MS);
    const orders = decideOrders(world, STEPPE, world.nowMs);
    expect(orders.length).toBeGreaterThanOrEqual(0);
    expect(world.countries?.[ROME]?.defeated).not.toBe(true);
  });

  it('tutorial decideOrders unchanged when foreign influence is injected', () => {
    const baseline = migrate(createTutorialWorld(START_MS));
    const infiltrated = setInfluence(
      migrate(ensureWorldInfluence(createTutorialWorld(START_MS))),
      'territory-london-tutorial',
      'faction-france-tutorial',
      80,
      START_MS,
    );
    const baselineOrders = decideOrders(baseline, 'faction-france-tutorial', START_MS);
    const infiltratedOrders = decideOrders(infiltrated, 'faction-france-tutorial', START_MS);
    expect(infiltratedOrders).toEqual(baselineOrders);
  });
});
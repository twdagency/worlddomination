import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { LEADERS_BY_ID } from '../../shared/src/leaders';
import { UNIT_TYPES_BY_ID } from '../../shared/src/units';
import {
  applyCoupAttempt,
  applyInfluenceOrders,
  calculateCoupSuccessRate,
  COUP_ATTEMPT_GOLD_COST,
  COUP_ATTEMPT_MANPOWER_COST,
  COUP_ALLIED_INSIDER_BONUS,
  COUP_BASE_SUCCESS_RATE,
  COUP_FAILURE_TARGET_REPUTATION_PENALTY,
  COUP_FORTIFICATION_PENALTY_PER_TIER,
  COUP_INFLUENCE_COST_SUCCESS,
  COUP_INFLUENCE_FLOOR,
  COUP_LOYAL_POSTURE_PENALTY,
  COUP_OPPORTUNIST_POSTURE_BONUS,
  COUP_SUCCESS_TARGET_REPUTATION_PENALTY,
  dispatchLineForEvent,
  formAlliance,
  getInfluence,
  rollCoupOutcome,
  stampEvents,
  syncCountriesFromFactions,
  tick,
} from '../src';
import { setInfluence } from '../src/influence';
import { ensureWorldMigrations } from '../src/migrations';
import { tagOrder } from './fixtures';
import type { Territory, WorldState } from '../src/types';

const START_MS = 1_700_000_000_000;
const PLAYER = 'faction-player';
const ROME = 'faction-rome';
const STEPPE = 'faction-steppe';
const BRITAIN = 'faction-britain';
const PARIS = 'territory-paris';
const BERLIN = 'territory-berlin';
const LONDON = 'territory-london';
const MS_DAY = 86_400_000;

function migrate(world: WorldState): WorldState {
  return ensureWorldMigrations(world, {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

function coupWorld(overrides: Partial<WorldState> = {}): WorldState {
  const base = migrate(createSprint4World(START_MS));
  return {
    ...base,
    factions: {
      ...base.factions,
      [PLAYER]: {
        ...base.factions[PLAYER]!,
        funding: 50_000,
        manpower: 100,
        isPlayer: true,
      },
    },
    ...overrides,
  };
}

function withInfluence(world: WorldState, value: number, cityId: string = PARIS): WorldState {
  return setInfluence(world, cityId, PLAYER, value, START_MS);
}

function coupOrder(world: WorldState, targetCityId: string = PARIS) {
  return tagOrder(world, { kind: 'coup-attempt', ownerId: PLAYER, targetCityId }, PLAYER);
}

function findSeedForOutcome(success: boolean): number {
  for (let seed = 0; seed < 500; seed++) {
    let world = withInfluence(coupWorld({ rng: { seed } }), 80);
    const result = applyCoupAttempt(world, PLAYER, PARIS, START_MS);
    const succeeded = result.events.some((event) => event.kind === 'coupSuccess');
    if (succeeded === success) return seed;
  }
  throw new Error(`no ${success ? 'success' : 'failure'} seed found`);
}

describe('coup attempt (Sprint 9 Phase 6)', () => {
  it('rejects when influence is below 70', () => {
    const world = withInfluence(coupWorld(), 69);
    const result = applyInfluenceOrders(world, [coupOrder(world)], START_MS);
    expect(result.events[0]?.kind).toBe('orderRejected');
    expect(result.events[0]?.reason).toBe('insufficient-influence');
  });

  it('rejects when gold is insufficient', () => {
    const world = withInfluence(
      coupWorld({
        factions: {
          ...coupWorld().factions,
          [PLAYER]: { ...coupWorld().factions[PLAYER]!, funding: COUP_ATTEMPT_GOLD_COST - 1 },
        },
      }),
      75,
    );
    const result = applyInfluenceOrders(world, [coupOrder(world)], START_MS);
    expect(result.events[0]?.reason).toBe('insufficient-gold');
  });

  it('rejects when manpower is insufficient', () => {
    const world = withInfluence(
      coupWorld({
        factions: {
          ...coupWorld().factions,
          [PLAYER]: { ...coupWorld().factions[PLAYER]!, manpower: 0 },
        },
      }),
      75,
    );
    const result = applyInfluenceOrders(world, [coupOrder(world)], START_MS);
    expect(result.events[0]?.reason).toBe('insufficient-manpower');
  });

  it('rejects when target country is defeated', () => {
    const world = withInfluence(
      coupWorld({
        countries: {
          ...coupWorld().countries,
          [ROME]: { ...coupWorld().countries![ROME]!, defeated: true },
        },
      }),
      75,
    );
    const result = applyInfluenceOrders(world, [coupOrder(world)], START_MS);
    expect(result.events[0]?.reason).toBe('target-owner-defeated');
  });

  it('rejects coup attempts against allied territory', () => {
    const world = withInfluence(formAlliance(coupWorld(), PLAYER, ROME, START_MS).world, 75);
    const result = applyInfluenceOrders(world, [coupOrder(world)], START_MS);
    expect(result.events[0]?.reason).toBe('target-is-allied');
  });

  it('calculates base success rate at 60%', () => {
    const world = coupWorld();
    expect(calculateCoupSuccessRate(world, PLAYER, PARIS)).toBe(COUP_BASE_SUCCESS_RATE);
  });

  it('applies fortification penalty per tier', () => {
    const world = coupWorld({
      territories: {
        ...coupWorld().territories,
        [PARIS]: {
          ...coupWorld().territories[PARIS]!,
          fortificationLevel: 2,
        } as Territory,
      },
    });
    expect(calculateCoupSuccessRate(world, PLAYER, PARIS)).toBeCloseTo(
      COUP_BASE_SUCCESS_RATE + 2 * COUP_FORTIFICATION_PENALTY_PER_TIER,
      5,
    );
  });

  it('applies loyal leader posture penalty', () => {
    const world = coupWorld({
      territories: {
        ...coupWorld().territories,
        [LONDON]: { ...coupWorld().territories[LONDON]!, ownerId: BRITAIN },
      },
    });
    expect(calculateCoupSuccessRate(world, PLAYER, LONDON)).toBeCloseTo(
      COUP_BASE_SUCCESS_RATE + COUP_LOYAL_POSTURE_PENALTY,
      5,
    );
  });

  it('applies opportunist leader posture bonus', () => {
    const world = coupWorld();
    expect(calculateCoupSuccessRate(world, PLAYER, BERLIN)).toBeCloseTo(
      COUP_BASE_SUCCESS_RATE + COUP_OPPORTUNIST_POSTURE_BONUS,
      5,
    );
  });

  it('includes allied insider bonus in rate calculation when allied', () => {
    const world = formAlliance(coupWorld(), PLAYER, ROME, START_MS).world;
    expect(calculateCoupSuccessRate(world, PLAYER, PARIS)).toBeCloseTo(
      COUP_BASE_SUCCESS_RATE + COUP_ALLIED_INSIDER_BONUS,
      5,
    );
  });

  it('successful coup transfers ownership and adjusts influence', () => {
    const seed = findSeedForOutcome(true);
    let world = withInfluence(coupWorld({ rng: { seed } }), 80);
    world = setInfluence(world, PARIS, STEPPE, 20, START_MS);
    const result = applyCoupAttempt(world, PLAYER, PARIS, START_MS);
    expect(result.events.some((event) => event.kind === 'coupSuccess')).toBe(true);
    expect(result.events.some((event) => event.kind === 'territoryCaptured')).toBe(true);
    expect(result.world.territories[PARIS]!.ownerId).toBe(PLAYER);
    expect(getInfluence(result.world, PARIS, PLAYER)).toBe(80 - COUP_INFLUENCE_COST_SUCCESS);
    expect(getInfluence(result.world, PARIS, STEPPE)).toBe(0);
    expect(result.world.reputation[ROME]![PLAYER]).toBe(COUP_SUCCESS_TARGET_REPUTATION_PENALTY);
  });

  it('failed coup resets actor influence and applies reputation penalty', () => {
    const seed = findSeedForOutcome(false);
    const world = withInfluence(coupWorld({ rng: { seed } }), 80);
    const result = applyCoupAttempt(world, PLAYER, PARIS, START_MS);
    expect(result.events.some((event) => event.kind === 'coupFailure')).toBe(true);
    expect(result.world.territories[PARIS]!.ownerId).toBe(ROME);
    expect(getInfluence(result.world, PARIS, PLAYER)).toBe(0);
    expect(result.world.reputation[ROME]![PLAYER]).toBe(COUP_FAILURE_TARGET_REPUTATION_PENALTY);
    expect(result.world.factions[PLAYER]!.manpower).toBe(100 - COUP_ATTEMPT_MANPOWER_COST);
  });

  it('is deterministic for identical worlds and rng seed', () => {
    const world = withInfluence(coupWorld({ rng: { seed: 12_345 } }), 80);
    const a = applyCoupAttempt(world, PLAYER, PARIS, START_MS);
    const b = applyCoupAttempt(world, PLAYER, PARIS, START_MS);
    expect(a.events.map((event) => event.kind)).toEqual(b.events.map((event) => event.kind));
    expect(a.world.territories[PARIS]?.ownerId).toBe(b.world.territories[PARIS]?.ownerId);
    expect(a.world.rng).toEqual(b.world.rng);
  });

  it('capturing the last city triggers defeat cascade on sync', () => {
    const seed = findSeedForOutcome(true);
    let world = withInfluence(coupWorld({ rng: { seed } }), 80);
    world = {
      ...world,
      territories: {
        [PARIS]: { ...world.territories[PARIS]! },
      },
    };
    const coup = applyCoupAttempt(world, PLAYER, PARIS, START_MS);
    const synced = syncCountriesFromFactions(coup.world);
    expect(synced.events.some((event) => event.kind === 'countryDefeated')).toBe(true);
    expect(synced.world.countries![ROME]!.defeated).toBe(true);
  });

  it('integration: successful coup cold-play transfers city and emits public dispatch', () => {
    const seed = findSeedForOutcome(true);
    const world = withInfluence(coupWorld({ rng: { seed } }), 80);
    const result = applyInfluenceOrders(world, [coupOrder(world)], START_MS);
    const stamped = stampEvents(result.world, result.events);
    const coup = stamped.events.find((event) => event.kind === 'coupSuccess')!;
    const line = dispatchLineForEvent(stamped.world, coup);
    expect(line).toContain('COUP SUCCEEDED');
    expect(line).not.toContain('rollValue');
    expect(stamped.world.territories[PARIS]!.ownerId).toBe(PLAYER);
  });

  it('integration: failed coup cold-play collapses influence with dispatch copy', () => {
    const seed = findSeedForOutcome(false);
    const world = withInfluence(coupWorld({ rng: { seed } }), 80);
    const result = applyInfluenceOrders(world, [coupOrder(world)], START_MS);
    const stamped = stampEvents(result.world, result.events);
    const coup = stamped.events.find((event) => event.kind === 'coupFailure')!;
    const line = dispatchLineForEvent(stamped.world, coup);
    expect(line).toContain('COUP FAILED');
    expect(getInfluence(stamped.world, PARIS, PLAYER)).toBe(0);
  });

  it('runs coup resolution inside tick()', () => {
    const seed = findSeedForOutcome(true);
    const world = withInfluence(coupWorld({ rng: { seed } }), 80);
    const { events } = tick(world, [coupOrder(world)], 0);
    expect(events.some((event) => event.kind === 'coupSuccess')).toBe(true);
  });

  it('rollCoupOutcome uses strict less-than comparison against success rate', () => {
    const atRate = rollCoupOutcome({ seed: 1 }, 0.5);
    expect(atRate.success).toBe(atRate.rollValue < 0.5);
  });
});

import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { createSprint5World } from '../../shared/src/scenario-sprint5';
import {
  ensureWorldMigrations,
  gatherTerritoryDefenders,
  powerRatio,
  resolveHostileArrival,
  sidePower,
} from '../src';
import type { Id, WorldState } from '../src';

const START_MS = 1_700_000_000_000;
const PLAYER_UNIT = 'unit-player-mg';
const PLAYER = 'faction-player';

function migrate(world: WorldState): WorldState {
  return ensureWorldMigrations(world);
}

function openingPowerRatio(world: WorldState, rivalCityId: Id): number {
  const playerUnit = world.units[PLAYER_UNIT]!;
  const ownerId = world.territories[rivalCityId]!.ownerId;
  const garrison = gatherTerritoryDefenders(world, rivalCityId, ownerId);
  const attack = sidePower(world, [playerUnit], 'attacker');
  const defend = sidePower(world, garrison, 'defender');
  return powerRatio(attack.modifiedPower, defend.modifiedPower);
}

function assaultArrival(world: WorldState, cityId: Id) {
  const arriving = {
    ...world.units[PLAYER_UNIT]!,
    locationId: cityId,
    transit: undefined,
  };
  return resolveHostileArrival(world, arriving, cityId, world.nowMs, 'assault');
}

function expectCostlyBattleWin(world: WorldState, cityId: Id) {
  const result = assaultArrival(world, cityId);
  expect(result.events.some((event) => event.kind === 'battle')).toBe(true);
  expect(result.territories[cityId]?.ownerId).toBe(PLAYER);
  const remaining = result.units[PLAYER_UNIT]?.count ?? 0;
  expect(remaining).toBeGreaterThanOrEqual(15);
  expect(remaining).toBeLessThanOrEqual(30);
}

describe('scenario start-army balance', () => {
  it('Sprint 4 player opens with 40 infantry, not a t5 steamroll', () => {
    const world = migrate(createSprint4World(START_MS));
    const unit = world.units[PLAYER_UNIT];
    expect(unit?.typeId).toBe('infantry-t2');
    expect(unit?.count).toBe(40);
    expect(openingPowerRatio(world, 'territory-paris')).toBeLessThan(2);
  });

  it('Sprint 5 player opens with 40 infantry, not a t5 steamroll', () => {
    const world = migrate(createSprint5World(START_MS));
    const unit = world.units[PLAYER_UNIT];
    expect(unit?.typeId).toBe('infantry-t2');
    expect(unit?.count).toBe(40);
    expect(openingPowerRatio(world, 'territory-bucharest')).toBeLessThan(2);
  });

  it('opening Paris assault is a costly battle win', () => {
    expectCostlyBattleWin(migrate(createSprint4World(START_MS)), 'territory-paris');
  });

  it('opening Bucharest assault is a costly battle win', () => {
    expectCostlyBattleWin(migrate(createSprint5World(START_MS)), 'territory-bucharest');
  });
});

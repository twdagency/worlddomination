import { describe, it, expect } from 'vitest';
import { MS_PER_HOUR } from '../src/constants';
import { applyUnitLosses } from '../src/combat';
import {
  applyBuildOrders,
  canBuild,
  maxBuildableTier,
  resolveProductionCompletions,
} from '../src/production';
import { LONDON, makeWorld } from './fixtures';

describe('production', () => {
  it('infra level gates buildable tiers', () => {
    expect(maxBuildableTier(1)).toBe(2);
    expect(maxBuildableTier(2)).toBe(2);
    expect(maxBuildableTier(3)).toBe(5);
  });

  it('blocks build when bill of materials is short', () => {
    const world = makeWorld({
      territories: {
        [LONDON.id]: {
          ...LONDON,
          infraLevel: 2,
          resources: { steel: 10, food: 100 },
        },
      },
    });

    const check = canBuild(world, LONDON.id, 'infantry-t2', 1, 'faction-player');
    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.reason.code).toBe('missing-resource');
      expect(check.reason.missing).toBe('steel');
    }
  });

  it('allows build when resources, funding, and manpower are sufficient', () => {
    const world = makeWorld({
      territories: {
        [LONDON.id]: {
          ...LONDON,
          infraLevel: 2,
          resources: { steel: 100, food: 100 },
        },
      },
    });

    const check = canBuild(world, LONDON.id, 'infantry-t2', 1, 'faction-player');
    expect(check.ok).toBe(true);
  });

  it('blocks tier 5 at Depot infra', () => {
    const world = makeWorld({
      territories: {
        [LONDON.id]: {
          ...LONDON,
          infraLevel: 2,
          resources: { steel: 500, fuel: 500 },
        },
      },
    });

    const check = canBuild(world, LONDON.id, 'mg-armor-t5', 1, 'faction-player');
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason.code).toBe('infra-too-low');
  });

  it('consumes funding, manpower, and resources when build is queued', () => {
    const world = makeWorld({
      territories: {
        [LONDON.id]: {
          ...LONDON,
          infraLevel: 2,
          resources: { steel: 100, food: 100 },
        },
      },
    });

    const { factions, territories } = applyBuildOrders(world, [
      { kind: 'build', territoryId: LONDON.id, unitTypeId: 'infantry-t2', count: 1 },
    ]);

    expect(factions['faction-player'].funding).toBe(10_000 - 800);
    expect(factions['faction-player'].manpower).toBe(5_000 - 500);
    expect(territories[LONDON.id].resources.steel).toBe(70);
    expect(territories[LONDON.id].resources.food).toBe(80);
    expect(territories[LONDON.id].buildQueue).toHaveLength(1);
  });

  it('completes queue item at exactly startMs + durationMs and spawns unit', () => {
    const startMs = 1_700_000_000_000;
    const durationMs = 24 * MS_PER_HOUR;
    const world = makeWorld({
      nowMs: startMs,
      territories: {
        [LONDON.id]: {
          ...LONDON,
          infraLevel: 2,
          buildQueue: [
            {
              unitTypeId: 'levy-t1',
              count: 5,
              startMs,
              durationMs,
            },
          ],
        },
      },
    });

    const completeAt = startMs + durationMs;
    const { units, events } = resolveProductionCompletions(world, completeAt);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: 'production',
      at: completeAt,
      unitTypeId: 'levy-t1',
      count: 5,
      factionId: 'faction-player',
    });

    const spawned = Object.values(units).find(
      (u) => u.locationId === LONDON.id && u.typeId === 'levy-t1',
    );
    expect(spawned?.count).toBe(5);
  });

  it('manpower spent on build is not refunded when units are lost in combat', () => {
    const world = makeWorld({
      factions: {
        'faction-player': {
          id: 'faction-player',
          leaderId: 'leader-baseline',
          isPlayer: true,
          funding: 20_000,
          manpower: 5_000,
          manpowerCap: 10_000,
        },
      },
      territories: {
        [LONDON.id]: {
          ...LONDON,
          infraLevel: 2,
          resources: { food: 100 },
          buildQueue: [
            {
              unitTypeId: 'levy-t1',
              count: 1,
              startMs: 1_700_000_000_000,
              durationMs: MS_PER_HOUR,
            },
          ],
        },
      },
    });

    const { factions } = applyBuildOrders(world, [
      { kind: 'build', territoryId: LONDON.id, unitTypeId: 'levy-t1', count: 1 },
    ]);
    expect(factions['faction-player'].manpower).toBe(5_000 - 300);

    const { units } = resolveProductionCompletions(
      { ...world, factions },
      world.nowMs + MS_PER_HOUR,
    );
    const spawned = Object.values(units).find((u) => u.typeId === 'levy-t1');
    expect(spawned).toBeDefined();

    const afterLoss = applyUnitLosses(units, { [spawned!.id]: spawned!.count });
    expect(Object.keys(afterLoss)).not.toContain(spawned!.id);
    // Manpower pool unchanged by combat — still reduced from build
    expect(factions['faction-player'].manpower).toBe(4_700);
  });

  it('blocked build deducts no funding, manpower, or resources', () => {
    const world = makeWorld({
      factions: {
        'faction-player': {
          id: 'faction-player',
          leaderId: 'leader-baseline',
          isPlayer: true,
          funding: 10_000,
          manpower: 5_000,
          manpowerCap: 10_000,
        },
      },
      territories: {
        [LONDON.id]: {
          ...LONDON,
          infraLevel: 2,
          resources: { steel: 10, food: 100 },
        },
      },
    });

    const { factions, territories, events } = applyBuildOrders(world, [
      { kind: 'build', territoryId: LONDON.id, unitTypeId: 'infantry-t2', count: 1 },
    ]);

    expect(factions['faction-player'].funding).toBe(10_000);
    expect(factions['faction-player'].manpower).toBe(5_000);
    expect(territories[LONDON.id].resources.steel).toBe(10);
    expect(territories[LONDON.id].resources.food).toBe(100);
    expect(territories[LONDON.id].buildQueue ?? []).toHaveLength(0);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: 'buildBlocked',
      missing: 'steel',
    });
  });

  it('blocks destroyer at London for missing rareMetals', () => {
    const world = makeWorld({
      territories: {
        [LONDON.id]: {
          ...LONDON,
          infraLevel: 2,
          resources: { steel: 500 },
          extraction: { fuel: 12, steel: 8 },
        },
      },
    });

    const check = canBuild(world, LONDON.id, 'destroyer-t2', 1, 'faction-player');
    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.reason.code).toBe('missing-resource');
      expect(check.reason.missing).toBe('rareMetals');
    }
  });
});

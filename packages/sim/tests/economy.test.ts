import { describe, it, expect } from 'vitest';
import { MS_PER_HOUR } from '../src/constants';
import { accrueEconomy, extractionPerHour, incomePerHour } from '../src/economy';
import { canBuild } from '../src/production';
import type { ResourceId, Territory } from '../src/types';
import { LONDON, makeWorld, withLeader } from './fixtures';

const MADRID: Territory = {
  id: 'territory-madrid',
  name: 'Madrid',
  coord: { lat: 40.4168, lon: -3.7038 },
  ownerId: 'faction-player',
  baseYield: 80,
  infraLevel: 1,
  resources: {},
  extraction: { food: 15 },
};

const RESOURCE_IDS: ResourceId[] = ['fuel', 'steel', 'rareMetals', 'food'];

function stockDelta(
  before: Partial<Record<ResourceId, number>>,
  after: Partial<Record<ResourceId, number>>,
  resourceId: ResourceId,
): number {
  return (after[resourceId] ?? 0) - (before[resourceId] ?? 0);
}

describe('economy', () => {
  it('incomePerHour scales with infra level', () => {
    const base = { ...LONDON, baseYield: 100, infraLevel: 0 };
    expect(incomePerHour({ ...base, infraLevel: 0 })).toBe(100);
    expect(incomePerHour({ ...base, infraLevel: 1 })).toBe(125);
    expect(incomePerHour({ ...base, infraLevel: 2 })).toBe(150);
  });

  it('incomePerHour applies leader incomeMult', () => {
    const territory = { ...LONDON, baseYield: 100, infraLevel: 2 };
    expect(incomePerHour(territory, 1.2)).toBe(180);
  });

  it('extractionPerHour scales with infra', () => {
    const territory = {
      ...LONDON,
      infraLevel: 2,
      extraction: { fuel: 10, rareMetals: 4 },
    };
    expect(extractionPerHour(territory, 'fuel')).toBe(15);
    expect(extractionPerHour(territory, 'rareMetals')).toBe(6);
    expect(extractionPerHour(territory, 'steel')).toBe(0);
  });

  it('accrues funding and resources over an exact 14h offline gap', () => {
    const world = makeWorld({
      territories: {
        [LONDON.id]: {
          ...LONDON,
          baseYield: 120,
          infraLevel: 2,
          extraction: { fuel: 10 },
          resources: { fuel: 5 },
        },
      },
    });

    const elapsed = 14 * MS_PER_HOUR;
    const { factions, territories, accrued } = accrueEconomy(world, elapsed);

    // incomePerHour = 120 * 1.5 = 180; 14h => 2520
    expect(accrued.funding).toBe(2520);
    expect(factions['faction-player'].funding).toBe(10_000 + 2520);
    // extraction fuel: 10 * 1.5 = 15/hr; 14h => 210
    expect(accrued.resourcesByTerritory[LONDON.id]?.fuel).toBe(210);
    expect(territories[LONDON.id].resources.fuel).toBe(215);
  });

  it('leader incomeMult affects offline accrual', () => {
    const world = withLeader(
      makeWorld({
        territories: {
          [LONDON.id]: { ...LONDON, baseYield: 100, infraLevel: 0 },
        },
      }),
      'leader-elizabeth',
    );
    const { accrued } = accrueEconomy(world, MS_PER_HOUR);
    expect(accrued.funding).toBe(120);
  });

  it('reported accrual matches stock delta and build availability per territory', () => {
    const elapsed = 12 * MS_PER_HOUR;
    const world = makeWorld({
      territories: {
        [LONDON.id]: {
          ...LONDON,
          infraLevel: 2,
          extraction: { fuel: 12, steel: 8 },
          resources: { food: 5, fuel: 20, steel: 80 },
        },
        [MADRID.id]: MADRID,
      },
    });

    const stocksBefore = {
      [LONDON.id]: { ...world.territories[LONDON.id].resources },
      [MADRID.id]: { ...world.territories[MADRID.id].resources },
    };

    const { accrued, territories } = accrueEconomy(world, elapsed);
    const worldAfter = { ...world, territories };

    for (const territoryId of [LONDON.id, MADRID.id] as const) {
      const reported = accrued.resourcesByTerritory[territoryId] ?? {};
      const after = territories[territoryId].resources;

      for (const resourceId of RESOURCE_IDS) {
        const delta = stockDelta(stocksBefore[territoryId], after, resourceId);
        const credited = reported[resourceId] ?? 0;
        expect(credited).toBe(delta);

        if (resourceId === 'food' && territoryId === LONDON.id) {
          expect(credited).toBe(0);
          expect(after.food).toBe(5);
        }
        if (resourceId === 'food' && territoryId === MADRID.id) {
          expect(credited).toBe(225);
        }
      }
    }

    const londonFoodCheck = canBuild(worldAfter, LONDON.id, 'levy-t1', 1, 'faction-player');
    expect(londonFoodCheck.ok).toBe(false);
    if (!londonFoodCheck.ok) {
      expect(londonFoodCheck.reason.code).toBe('missing-resource');
      expect(londonFoodCheck.reason.missing).toBe('food');
    }
    expect(worldAfter.territories[LONDON.id].resources.food).toBe(5);

    const madridWouldHaveFood =
      (worldAfter.territories[MADRID.id].resources.food ?? 0) >= 15;
    expect(madridWouldHaveFood).toBe(true);
    expect(accrued.resourcesByTerritory[MADRID.id]?.food).toBe(225);
    expect(accrued.resourcesByTerritory[LONDON.id]?.food ?? 0).toBe(0);
  });
});

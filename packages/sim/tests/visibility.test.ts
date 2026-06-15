import { describe, it, expect } from 'vitest';
import { BASE_SCOUT_RANGE_KM } from '../src/constants';
import { getFactionVisibility, isTerritoryVisible, isUnitVisible, scoutRangeKm } from '../src/visibility';
import { LONDON, NEW_YORK, PARIS, makeWorld } from './fixtures';
import type { Unit } from '../src/types';

describe('visibility', () => {
  it('always sees own territories', () => {
    const world = makeWorld();
    expect(isTerritoryVisible(world, 'faction-player', LONDON.id)).toBe(true);
  });

  it('sees nearby territories within scout range', () => {
    const world = makeWorld({
      territories: {
        [LONDON.id]: LONDON,
        [PARIS.id]: { ...PARIS, ownerId: 'faction-enemy' },
      },
    });
    expect(isTerritoryVisible(world, 'faction-player', PARIS.id)).toBe(true);
  });

  it('does not see territories beyond scout range', () => {
    const world = makeWorld({
      territories: {
        [LONDON.id]: LONDON,
        [NEW_YORK.id]: NEW_YORK,
      },
    });
    expect(scoutRangeKm(world, 'faction-player')).toBe(BASE_SCOUT_RANGE_KM);
    expect(isTerritoryVisible(world, 'faction-player', NEW_YORK.id)).toBe(false);
  });

  it('does not see hidden enemy units beyond scout range', () => {
    const hiddenEnemy: Unit = {
      id: 'unit-hidden',
      typeId: 'levy-t1',
      ownerId: 'faction-enemy',
      count: 50,
      locationId: NEW_YORK.id,
      stance: 'defend',
    };
    const world = makeWorld({
      territories: {
        [LONDON.id]: LONDON,
        [NEW_YORK.id]: NEW_YORK,
      },
      units: {
        'unit-1': makeWorld().units['unit-1'],
        'unit-hidden': hiddenEnemy,
      },
      factions: {
        'faction-player': makeWorld().factions['faction-player'],
        'faction-enemy': {
          id: 'faction-enemy',
          leaderId: 'leader-caesar',
          isPlayer: false,
          funding: 10_000,
          manpower: 5_000,
          manpowerCap: 10_000,
        },
      },
    });

    const visibility = getFactionVisibility(world, 'faction-player');
    expect(visibility.unitIds.has('unit-hidden')).toBe(false);
    expect(isUnitVisible(world, 'faction-player', 'unit-hidden')).toBe(false);
  });
});

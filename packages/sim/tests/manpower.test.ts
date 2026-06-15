import { describe, it, expect } from 'vitest';
import { MS_PER_HOUR } from '../src/constants';
import { applyUnitLosses } from '../src/combat';
import { accrueManpower, manpowerRegenPerHour } from '../src/manpower';
import { LONDON, makeWorld } from './fixtures';

describe('manpower', () => {
  it('regenerates per hour from held territories', () => {
    const world = makeWorld({
      territories: {
        [LONDON.id]: { ...LONDON, baseYield: 100 },
      },
    });
    expect(manpowerRegenPerHour(world, 'faction-player')).toBe(50);
  });

  it('accrues manpower up to cap over elapsed time', () => {
    const world = makeWorld({
      factions: {
        'faction-player': {
          id: 'faction-player',
          leaderId: 'leader-baseline',
          isPlayer: true,
          funding: 10_000,
          manpower: 9_900,
          manpowerCap: 10_000,
        },
      },
      territories: {
        [LONDON.id]: { ...LONDON, baseYield: 100 },
      },
    });

    const factions = accrueManpower(world, 4 * MS_PER_HOUR);
    expect(factions['faction-player'].manpower).toBe(10_000);
  });

  it('combat losses do not refund manpower', () => {
    const world = makeWorld({
      factions: {
        'faction-player': {
          id: 'faction-player',
          leaderId: 'leader-baseline',
          isPlayer: true,
          funding: 10_000,
          manpower: 3_000,
          manpowerCap: 10_000,
        },
      },
    });

    const units = applyUnitLosses(world.units, { 'unit-1': 1 });
    const afterCombat = { ...world, units, manpower: world.factions['faction-player'].manpower };
    const factions = accrueManpower(afterCombat, MS_PER_HOUR);

    expect(factions['faction-player'].manpower).toBeGreaterThan(3_000);
    expect(factions['faction-player'].manpower).toBeLessThan(3_100);
  });
});

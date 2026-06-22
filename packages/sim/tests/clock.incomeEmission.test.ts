import { describe, expect, it } from 'vitest';
import { advanceTo } from '../src/clock';
import { MS_PER_HOUR } from '../src/constants';
import { LONDON, makeWorld } from './fixtures';

const PLAYER = 'faction-player';

describe('income emission threshold', () => {
  it('skips income dispatch when funding is below $1 and no displayable resources', () => {
    const world = makeWorld({
      territories: {
        [LONDON.id]: {
          ...LONDON,
          baseYield: 1,
          infraLevel: 0,
          extraction: {},
          resources: {},
        },
      },
    });
    const startFunding = world.factions[PLAYER]!.funding;

    const { events, world: advanced } = advanceTo(world, world.nowMs + MS_PER_HOUR / 2);

    expect(events.filter((event) => event.kind === 'income')).toHaveLength(0);
    expect(advanced.factions[PLAYER]!.funding).toBeGreaterThan(startFunding);
  });

  it('emits income when funding crosses the $1 display threshold', () => {
    const world = makeWorld({
      territories: {
        [LONDON.id]: {
          ...LONDON,
          baseYield: 120,
          infraLevel: 2,
          extraction: { fuel: 10 },
          resources: {},
        },
      },
    });

    const { events } = advanceTo(world, world.nowMs + 14 * MS_PER_HOUR);
    const income = events.find((event) => event.kind === 'income');

    expect(income).toMatchObject({ kind: 'income', funding: 2520 });
  });

  it('preserves faction funding when sub-threshold income events are suppressed', () => {
    const world = makeWorld({
      territories: {
        [LONDON.id]: {
          ...LONDON,
          baseYield: 1,
          infraLevel: 0,
          extraction: {},
          resources: {},
        },
      },
    });
    const startFunding = world.factions[PLAYER]!.funding;
    const stepMs = MS_PER_HOUR / 2;

    let current = world;
    for (let i = 0; i < 4; i++) {
      const result = advanceTo(current, current.nowMs + stepMs);
      current = result.world;
      expect(result.events.filter((event) => event.kind === 'income')).toHaveLength(0);
    }

    expect(current.factions[PLAYER]!.funding).toBeCloseTo(startFunding + 2, 5);
  });

  it('emits once the accrual window crosses $1 within a single advanceTo', () => {
    const world = makeWorld({
      territories: {
        [LONDON.id]: {
          ...LONDON,
          baseYield: 2,
          infraLevel: 0,
          extraction: {},
          resources: {},
        },
      },
    });

    const { events } = advanceTo(world, world.nowMs + MS_PER_HOUR);
    const income = events.filter((event) => event.kind === 'income');

    expect(income).toHaveLength(1);
    expect(income[0]?.kind === 'income' && income[0].funding).toBeCloseTo(2, 5);
  });
});

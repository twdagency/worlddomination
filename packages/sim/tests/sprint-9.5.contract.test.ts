import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { advanceTo, dispatchLineForEvent, hasDisplayableIncome } from '../src';
import { MS_PER_HOUR } from '../src/constants';
import { LONDON, makeWorld } from './fixtures';

describe('income dispatch contracts (Sprint 9.5)', () => {
  it('income dispatch displays rounded values (no raw floats)', () => {
    const world = createSprint4World(1_700_000_000_000);
    const line = dispatchLineForEvent(world, {
      eventId: 'evt-income',
      kind: 'income',
      at: world.nowMs,
      funding: 3.14159,
      resourcesByTerritory: {},
      importance: 'low',
    });
    expect(line).toBe('INCOME — +$3 funding accrued while away');
    expect(line).not.toContain('3.14159');
  });

  it('sub-threshold accrual windows suppress income dispatch events', () => {
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

    const { events } = advanceTo(world, world.nowMs + MS_PER_HOUR / 2);
    expect(events.some((event) => event.kind === 'income')).toBe(false);
    expect(
      hasDisplayableIncome({
        eventId: 'evt-income',
        kind: 'income',
        at: world.nowMs,
        funding: 0.5,
        resourcesByTerritory: {},
        importance: 'low',
      }),
    ).toBe(false);
  });
});

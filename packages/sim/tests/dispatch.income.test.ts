import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import {
  dispatchLineForEvent,
  formatIncomeDispatchLine,
  formatResourceAccruals,
  hasDisplayableIncome,
  hasDisplayableResourceAccrual,
} from '../src/dispatch';
import type { SimEvent } from '../src/types';

const START_MS = 1_700_000_000_000;

function incomeEvent(
  partial: Partial<Extract<SimEvent, { kind: 'income' }>>,
): Extract<SimEvent, { kind: 'income' }> {
  return {
    eventId: 'evt-income',
    kind: 'income',
    at: START_MS,
    funding: 0,
    resourcesByTerritory: {},
    importance: 'low',
    ...partial,
  };
}

describe('income dispatch formatting', () => {
  const world = createSprint4World(START_MS);

  it('floors funding in formatIncomeDispatchLine', () => {
    const line = formatIncomeDispatchLine(
      world,
      incomeEvent({ funding: 1234.89 }),
    );
    expect(line).toBe('INCOME — +$1,234 funding accrued while away');
    expect(line).not.toContain('1234.89');
  });

  it('includes aggregated resource accruals', () => {
    const line = formatIncomeDispatchLine(
      world,
      incomeEvent({
        funding: 0,
        resourcesByTerritory: {
          'territory-london': { fuel: 2.9, steel: 1.1 },
          'territory-paris': { fuel: 3.2 },
        },
      }),
    );
    expect(line).toBe('INCOME — +6 fuel, +1 steel accrued while away');
  });

  it('aggregates resources across territories', () => {
    const aggregated = formatResourceAccruals({
      'territory-london': { food: 5.4 },
      'territory-paris': { food: 4.8 },
      'territory-berlin': { food: 4.9 },
    });
    expect(aggregated).toEqual(['+15 food']);
  });

  it('hasDisplayableIncome returns false for sub-dollar funding with no resources', () => {
    expect(hasDisplayableIncome(incomeEvent({ funding: 0.87 }))).toBe(false);
  });

  it('hasDisplayableIncome returns true for whole-dollar funding', () => {
    expect(hasDisplayableIncome(incomeEvent({ funding: 1.02 }))).toBe(true);
  });

  it('hasDisplayableIncome returns true for displayable resources even when funding is sub-dollar', () => {
    expect(
      hasDisplayableIncome(
        incomeEvent({
          funding: 0.2,
          resourcesByTerritory: { 'territory-london': { food: 1.4 } },
        }),
      ),
    ).toBe(true);
    expect(hasDisplayableResourceAccrual({ 'territory-london': { food: 0.4 } })).toBe(false);
  });

  it('dispatchLineForEvent routes income through the unified formatter', () => {
    const line = dispatchLineForEvent(world, incomeEvent({ funding: 42.99 }));
    expect(line).toContain('+$42 funding');
    expect(line).not.toMatch(/42\.99/);
  });
});

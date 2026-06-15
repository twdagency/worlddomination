import { describe, expect, it } from 'vitest';
import { createSprint4World } from 'shared';
import { buildWhyExplanation, infraWhyExplanation } from './whyBlockText';

const START_MS = 1_700_000_000_000;
const LONDON = 'territory-london';
const PLAYER = 'faction-player';

describe('whyBlockText', () => {
  it('explains missing resources with acquire hints', () => {
    const world = createSprint4World(START_MS);
    const infantry = world.unitTypes['infantry-t2']!;
    const text = buildWhyExplanation(
      world,
      PLAYER,
      LONDON,
      infantry,
      { code: 'missing-resource', missing: 'food' },
    );
    expect(text).toMatch(/Cannot build/i);
    expect(text).toMatch(/food/i);
    expect(text).toMatch(/Acquire from/i);
  });

  it('explains insufficient funding with current balance', () => {
    const world = createSprint4World(START_MS);
    const infantry = world.unitTypes['infantry-t2']!;
    const text = buildWhyExplanation(
      world,
      PLAYER,
      LONDON,
      infantry,
      { code: 'insufficient-funding' },
    );
    expect(text).toMatch(/funding/i);
  });

  it('wraps infra shortfall with funding accrual hint', () => {
    const text = infraWhyExplanation('Need 500 more funding');
    expect(text).toMatch(/funding/i);
    expect(text).toMatch(/accrues/i);
  });
});

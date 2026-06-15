import { describe, it, expect } from 'vitest';
import { advanceTo } from '../src/clock';
import { createSprint4World } from '../../shared/src/scenario-sprint4';

describe('intel determinism', () => {
  it('advanceTo produces identical intel stores on repeated runs', () => {
    const startMs = 1_700_000_000_000;
    const endMs = startMs + 18 * 3_600_000;
    const world = createSprint4World(startMs);

    const first = advanceTo(world, endMs);
    const second = advanceTo(world, endMs);

    expect(first.world.intel).toEqual(second.world.intel);
  });
});

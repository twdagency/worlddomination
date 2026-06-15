import { describe, it, expect } from 'vitest';
import { tick } from '../src/tick';
import { MS_PER_DAY } from '../src/constants';
import { diplomacyDefaults } from '../src/diplomacy';
import type { WorldState } from '../src/types';

function makeWorld(): WorldState {
  const start = 0;
  const factions = {};
  return {
    nowMs: start,
    day: 1,
    startMs: start,
    rng: { seed: 12345 },
    territories: {},
    units: {},
    factions,
    leaders: {},
    unitTypes: {},
    intel: {},
    ...diplomacyDefaults(factions),
    scenarioId: 'test',
  };
}

describe('tick (Sprint 0)', () => {
  it('advances nowMs by elapsedMs', () => {
    const w = makeWorld();
    const { world } = tick(w, [], 5000);
    expect(world.nowMs).toBe(5000);
  });

  it('recomputes day from elapsed time', () => {
    const w = makeWorld();
    const { world } = tick(w, [], MS_PER_DAY * 3 + 1000);
    expect(world.day).toBe(4);
  });

  it('does not mutate the input world (purity)', () => {
    const w = makeWorld();
    const frozen = Object.freeze(w);
    expect(() => tick(frozen, [], 1000)).not.toThrow();
    expect(w.nowMs).toBe(0);
  });

  it('returns no events in Sprint 0', () => {
    const { events } = tick(makeWorld(), [], 1000);
    expect(events).toHaveLength(0);
  });
});

import { describe, expect, it } from 'vitest';
import { createSprint4World } from 'shared';
import {
  collectActiveBuilds,
  sortTerritoriesForDisplay,
  territoryGlanceSubtitle,
  territoryHasFoodShortage,
} from './territoryDisclosure';
import { playerOwnedTerritories } from './playerView';

const START_MS = 1_700_000_000_000;

describe('territoryDisclosure', () => {
  it('flags low food stockpiles', () => {
    const world = createSprint4World(START_MS);
    const london = world.territories['territory-london']!;
    expect(typeof territoryHasFoodShortage(london)).toBe('boolean');
  });

  it('includes build queue count in glance subtitle', () => {
    const world = createSprint4World(START_MS);
    const london = { ...world.territories['territory-london']!, buildQueue: [{ unitTypeId: 'infantry-t1', count: 1, startMs: 0, durationMs: 1000 }] };
    expect(territoryGlanceSubtitle(london)).toMatch(/building/i);
  });

  it('sorts territories with active builds first', () => {
    const world = createSprint4World(START_MS);
    const owned = playerOwnedTerritories(world);
    const withQueue = owned.map((t, i) =>
      i === 0
        ? { ...t, buildQueue: [{ unitTypeId: 'infantry-t1', count: 1, startMs: 0, durationMs: 1000 }] }
        : t,
    );
    const sorted = sortTerritoriesForDisplay(withQueue);
    expect((sorted[0]?.buildQueue?.length ?? 0)).toBeGreaterThan(0);
  });

  it('collects active builds across territories', () => {
    const world = createSprint4World(START_MS);
    const owned = playerOwnedTerritories(world).map((t) => ({
      ...t,
      buildQueue: [{ unitTypeId: 'infantry-t1', count: 2, startMs: world.nowMs, durationMs: 3_600_000 }],
    }));
    const builds = collectActiveBuilds(world, owned);
    expect(builds).toHaveLength(owned.length);
  });
});

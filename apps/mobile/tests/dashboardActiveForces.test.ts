import { describe, expect, it } from 'vitest';
import { createSprint4World, LEADERS_BY_ID, UNIT_TYPES_BY_ID } from 'shared';
import type { WorldState } from 'sim';
import { ensureWorldMigrations } from 'sim';
import { getDashboardActiveForcesSummary } from '../src/game/playerView';

const START_MS = 1_700_000_000_000;
const PARIS = 'territory-paris';
const LONDON = 'territory-london';
const BERLIN = 'territory-berlin';

function migrate(world: ReturnType<typeof createSprint4World>) {
  return ensureWorldMigrations(world, {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

function withTransit(
  world: ReturnType<typeof migrate>,
  toTerritoryId: string,
  arriveMs = START_MS + 4 * 3_600_000,
): WorldState {
  const unit = world.units['unit-player-mg']!;
  const toTerritory = world.territories[toTerritoryId]!;
  return {
    ...world,
    nowMs: START_MS,
    units: {
      ...world.units,
      'unit-player-mg': {
        ...unit,
        locationId: LONDON,
        transit: {
          fromId: LONDON,
          toCoord: toTerritory.coord,
          toTerritoryId,
          departMs: START_MS,
          arriveMs,
          distanceKm: 500,
          stanceOnArrival: 'assault',
          intent: 'attack',
          beatId: 'beat-test',
          decisionTickMs: START_MS,
        },
      },
    },
  };
}

describe('dashboard active forces ownership context', () => {
  it('shows destination with owning country on in-transit rows', () => {
    const world = withTransit(migrate(createSprint4World(START_MS)), PARIS);
    const summary = getDashboardActiveForcesSummary(world);

    expect(summary.items).toHaveLength(1);
    expect(summary.items[0]!.detail).toContain('London (Britain)');
    expect(summary.items[0]!.detail).toContain('Paris · Rome');
    expect(summary.items[0]!.detail).toContain('HOSTILE');
    expect(summary.items[0]!.detail).toContain('ETA');
  });

  it('labels hostile destinations toward active countries correctly', () => {
    const world = withTransit(migrate(createSprint4World(START_MS)), BERLIN);
    const summary = getDashboardActiveForcesSummary(world);

    expect(summary.items[0]!.detail).toContain('Berlin · Steppe');
    expect(summary.items[0]!.detail).toContain('HOSTILE');
  });
});

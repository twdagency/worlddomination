import { describe, it, expect } from 'vitest';
import { advanceTo, computeVisibility, tick } from '../src';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { LONDON, NEW_YORK, PARIS, makeWorld } from './fixtures';

const NEAR_NYC = {
  id: 'territory-near-nyc',
  name: 'Coast Watch',
  coord: { lat: 40.75, lon: -71.5 },
  ownerId: undefined,
  baseYield: 50,
  infraLevel: 1,
  resources: {},
};

const START_MS = 1_700_200_000_000;
const SIX_HOURS_MS = 6 * 3_600_000;

describe('tri-state intel (Phase 2 cold checks)', () => {
  it('Sprint 4 @ London: Berlin and Madrid unknown after 6h skip; Paris live', () => {
    const world = createSprint4World(START_MS);
    const { world: advanced } = advanceTo(world, START_MS + SIX_HOURS_MS);
    const states = computeVisibility(advanced, 'faction-player').territoryStates;

    expect(states['territory-london']?.state).toBe('live');
    expect(states['territory-paris']?.state).toBe('live');
    expect(states['territory-berlin']?.state).toBe('unknown');
    expect(states['territory-madrid']?.state).toBe('unknown');
  });

  it('territory transitions live → stale when geometric sight is lost', () => {
    const hiddenEnemy = {
      id: 'unit-hidden',
      typeId: 'levy-t1',
      ownerId: 'faction-enemy',
      count: 30,
      locationId: NEW_YORK.id,
      stance: 'defend' as const,
    };

    const worldNear = makeWorld({
      nowMs: START_MS,
      startMs: START_MS,
      territories: {
        [LONDON.id]: LONDON,
        [NEAR_NYC.id]: NEAR_NYC,
        [NEW_YORK.id]: { ...NEW_YORK, ownerId: 'faction-enemy' },
        [PARIS.id]: PARIS,
      },
      units: {
        'unit-scout': {
          id: 'unit-scout',
          typeId: 'mg-armor-t5',
          ownerId: 'faction-player',
          count: 1,
          locationId: NEAR_NYC.id,
          stance: 'defend' as const,
        },
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

    const { world: observed } = tick(worldNear, [], SIX_HOURS_MS);
    expect(computeVisibility(observed, 'faction-player').territoryStates[NEW_YORK.id]?.state).toBe(
      'live',
    );

    const { world: recalled } = tick(
      {
        ...observed,
        units: {
          ...observed.units,
          'unit-scout': {
            ...observed.units['unit-scout'],
            locationId: LONDON.id,
          },
        },
      },
      [],
      SIX_HOURS_MS,
    );

    const nycState = computeVisibility(recalled, 'faction-player').territoryStates[NEW_YORK.id];
    expect(nycState?.state).toBe('stale');
    if (nycState?.state === 'stale') {
      expect(nycState.lastObservedAt).toBeLessThanOrEqual(recalled.nowMs);
      expect(nycState.snapshot.visibleEnemyGarrison).toBeGreaterThan(0);
    }
  });

  it('unknown territories are excluded from order-eligible intel', () => {
    const world = createSprint4World(START_MS);
    const states = computeVisibility(world, 'faction-player').territoryStates;
    const orderEligible = Object.values(states).filter((state) => state.state !== 'unknown');
    expect(orderEligible.some((state) => state.state === 'live')).toBe(true);
    expect(orderEligible.some((state) => state.state === 'unknown')).toBe(false);
  });
});

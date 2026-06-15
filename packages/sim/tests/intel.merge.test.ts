import { describe, it, expect } from 'vitest';
import { mergeTerritoryVisibility } from '../src/intel';
import { activeDirectSight } from '../src/sight';
import { computeVisibility } from '../src/visibility';
import { LONDON, NEW_YORK, PARIS, makeWorld } from './fixtures';

describe('intel merge', () => {
  it('returns live for territories in geometric sight', () => {
    const world = makeWorld();
    const sight = activeDirectSight(world, 'faction-player');
    const merged = mergeTerritoryVisibility(
      world,
      'faction-player',
      PARIS.id,
      sight.territoryIds,
      sight.unitIds,
    );

    expect(merged.state).toBe('live');
    if (merged.state === 'live') {
      expect(merged.sources).toEqual(['direct']);
      expect(merged.snapshot.infraLevel).toBe(PARIS.infraLevel);
    }
  });

  it('returns stale when a non-expired record exists but sight is lost', () => {
    const observedAt = 1_700_000_000_000;
    const world = makeWorld({
      nowMs: observedAt,
      intel: {
        'faction-player': [
          {
            observerFaction: 'faction-player',
            territoryId: NEW_YORK.id,
            observationTime: observedAt,
            snapshot: {
              ownerId: NEW_YORK.ownerId,
              infraLevel: NEW_YORK.infraLevel,
              garrisonCount: 0,
              visibleEnemyGarrison: 0,
              inTransitCount: 0,
            },
            source: 'direct',
            expiresAt: null,
            confidence: 1.0,
          },
        ],
      },
    });

    const visibility = computeVisibility(world, 'faction-player');
    expect(visibility.territoryIds.has(NEW_YORK.id)).toBe(false);
    expect(visibility.territoryStates[NEW_YORK.id]).toEqual({
      state: 'stale',
      snapshot: expect.objectContaining({ infraLevel: NEW_YORK.infraLevel }),
      sources: ['direct'],
      lastObservedAt: observedAt,
    });
  });

  it('returns unknown when there is no sight and no record', () => {
    const world = makeWorld({
      territories: {
        [LONDON.id]: LONDON,
        [NEW_YORK.id]: NEW_YORK,
      },
    });
    const sight = activeDirectSight(world, 'faction-player');
    const merged = mergeTerritoryVisibility(
      world,
      'faction-player',
      NEW_YORK.id,
      sight.territoryIds,
      sight.unitIds,
    );

    expect(merged).toEqual({ state: 'unknown' });
  });

  it('uses the newest record for stale merge when sight is lost', () => {
    const older = 1_700_000_000_000;
    const newer = older + 3_600_000;
    const world = makeWorld({
      nowMs: newer,
      intel: {
        'faction-player': [
          {
            observerFaction: 'faction-player',
            territoryId: NEW_YORK.id,
            observationTime: older,
            snapshot: {
              infraLevel: 1,
              garrisonCount: 0,
              visibleEnemyGarrison: 0,
              inTransitCount: 0,
            },
            source: 'direct',
            expiresAt: null,
            confidence: 1.0,
          },
          {
            observerFaction: 'faction-player',
            territoryId: NEW_YORK.id,
            observationTime: newer,
            snapshot: {
              ownerId: 'faction-enemy',
              infraLevel: 3,
              garrisonCount: 12,
              visibleEnemyGarrison: 12,
              inTransitCount: 0,
            },
            source: 'direct',
            expiresAt: null,
            confidence: 1.0,
          },
        ],
      },
      territories: {
        [LONDON.id]: LONDON,
        [NEW_YORK.id]: { ...NEW_YORK, ownerId: 'faction-enemy', infraLevel: 3 },
        [PARIS.id]: PARIS,
      },
    });

    const visibility = computeVisibility(world, 'faction-player');
    expect(visibility.territoryStates[NEW_YORK.id]).toEqual({
      state: 'stale',
      snapshot: expect.objectContaining({ infraLevel: 3, garrisonCount: 12 }),
      sources: ['direct'],
      lastObservedAt: newer,
    });
  });
});

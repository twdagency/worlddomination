/**
 * Forward-compat tests for allied/treaty intel sources.
 * No production code emits these sources in Sprint 5.5 — records are synthetic.
 */
import { describe, it, expect } from 'vitest';
import {
  computeVisibility,
  factionIntelRecords,
  formatIntelSourceLabel,
  INTEL_DECAY_WINDOW_MS,
  isRecordExpired,
  mergeTerritoryVisibility,
  pruneExpiredRecords,
} from '../src';
import { activeSight } from '../src/sight';
import { LONDON, NEW_YORK, makeWorld } from './fixtures';
import type { IntelRecord } from '../src/types';

function alliedRecord(
  overrides: Partial<IntelRecord> & Pick<IntelRecord, 'territoryId' | 'observationTime'>,
): IntelRecord {
  return {
    observerFaction: 'faction-caesar',
    snapshot: {
      ownerId: 'faction-steppe',
      infraLevel: 2,
      garrisonCount: 6,
      visibleEnemyGarrison: 6,
      inTransitCount: 0,
    },
    source: 'allied',
    expiresAt: null,
    confidence: 0.85,
    ...overrides,
  };
}

describe('intel forward compatibility', () => {
  const observedAt = 1_700_800_000_000;

  it('allied record merges additively with direct and scout sources', () => {
    const world = makeWorld({
      nowMs: observedAt,
      intel: {
        'faction-player': [
          {
            observerFaction: 'faction-player',
            territoryId: NEW_YORK.id,
            observationTime: observedAt - 3_600_000,
            snapshot: {
              infraLevel: 1,
              garrisonCount: 0,
              visibleEnemyGarrison: 0,
              inTransitCount: 0,
            },
            source: 'scout',
            expiresAt: null,
            confidence: 1.0,
          },
          alliedRecord({
            territoryId: NEW_YORK.id,
            observationTime: observedAt,
            confidence: 0.9,
          }),
        ],
      },
    });

    const merged = mergeTerritoryVisibility(
      world,
      'faction-player',
      NEW_YORK.id,
      activeSight(world, 'faction-player'),
    );

    expect(merged.state).toBe('live');
    if (merged.state === 'live') {
      expect(merged.sources.sort()).toEqual(['allied', 'scout']);
      expect(merged.snapshot.infraLevel).toBe(2);
    }
  });

  it('freshest allied record becomes live when geometric sight is absent', () => {
    const world = makeWorld({
      nowMs: observedAt,
      territories: {
        [LONDON.id]: LONDON,
        [NEW_YORK.id]: { ...NEW_YORK, ownerId: 'faction-enemy' },
      },
      intel: {
        'faction-player': [
          alliedRecord({
            territoryId: NEW_YORK.id,
            observationTime: observedAt,
          }),
        ],
      },
    });

    const merged = mergeTerritoryVisibility(
      world,
      'faction-player',
      NEW_YORK.id,
      activeSight(world, 'faction-player'),
    );

    expect(merged.state).toBe('live');
    if (merged.state === 'live') {
      expect(merged.sources).toContain('allied');
      expect(merged.snapshot.garrisonCount).toBe(6);
    }
  });

  it('falls back to direct/scout stale when allied record is removed', () => {
    const world = makeWorld({
      nowMs: observedAt,
      intel: {
        'faction-player': [
          alliedRecord({ territoryId: NEW_YORK.id, observationTime: observedAt - 1 }),
          {
            observerFaction: 'faction-player',
            territoryId: NEW_YORK.id,
            observationTime: observedAt - 3_600_000,
            snapshot: {
              infraLevel: 1,
              garrisonCount: 2,
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

    const withoutAllied: typeof world = {
      ...world,
      intel: {
        'faction-player': world.intel['faction-player']!.filter((record) => record.source !== 'allied'),
      },
    };

    const merged = mergeTerritoryVisibility(
      withoutAllied,
      'faction-player',
      NEW_YORK.id,
      activeSight(withoutAllied, 'faction-player'),
    );

    expect(merged.state).toBe('stale');
    if (merged.state === 'stale') {
      expect(merged.sources).toEqual(['direct']);
      expect(merged.snapshot.garrisonCount).toBe(2);
    }
  });

  it('treaty record with future expiresAt contributes until expiry', () => {
    const expiresAt = observedAt + 48 * 3_600_000;
    const world = makeWorld({
      nowMs: observedAt,
      territories: {
        [LONDON.id]: LONDON,
        [NEW_YORK.id]: { ...NEW_YORK, ownerId: 'faction-enemy' },
      },
      intel: {
        'faction-player': [
          {
            observerFaction: 'faction-caesar',
            territoryId: NEW_YORK.id,
            observationTime: observedAt,
            snapshot: {
              ownerId: 'faction-steppe',
              infraLevel: 1,
              garrisonCount: 4,
              visibleEnemyGarrison: 4,
              inTransitCount: 0,
            },
            source: 'treaty',
            expiresAt,
            confidence: 0.75,
          },
        ],
      },
    });

    const live = mergeTerritoryVisibility(
      world,
      'faction-player',
      NEW_YORK.id,
      activeSight(world, 'faction-player'),
    );
    expect(live.state).toBe('live');

    const expiredWorld = { ...world, nowMs: expiresAt };
    const records = pruneExpiredRecords(
      factionIntelRecords(expiredWorld, 'faction-player'),
      expiredWorld.nowMs,
    );
    expect(records).toHaveLength(0);
  });

  it('expiresAt prunes before decay window when sooner', () => {
    const record: IntelRecord = alliedRecord({
      territoryId: NEW_YORK.id,
      observationTime: observedAt,
      expiresAt: observedAt + 3_600_000,
    });

    expect(isRecordExpired(record, observedAt + 3_600_000)).toBe(true);
    expect(isRecordExpired(record, observedAt + 3_600_000 - 1)).toBe(false);
    expect(isRecordExpired({ ...record, expiresAt: null }, observedAt + INTEL_DECAY_WINDOW_MS + 1)).toBe(
      true,
    );
  });

  it('preserves confidence and provenance fields on records', () => {
    const record = alliedRecord({
      territoryId: NEW_YORK.id,
      observationTime: observedAt,
      observerFaction: 'faction-caesar',
      confidence: 0.42,
    });

    const world = makeWorld({
      nowMs: observedAt,
      intel: { 'faction-player': [record] },
    });

    const stored = factionIntelRecords(world, 'faction-player')[0];
    expect(stored.confidence).toBe(0.42);
    expect(stored.observerFaction).toBe('faction-caesar');
    expect(stored.source).toBe('allied');
  });

  it('computeVisibility surfaces allied source on live merge', () => {
    const world = makeWorld({
      nowMs: observedAt,
      territories: {
        [LONDON.id]: LONDON,
        [NEW_YORK.id]: { ...NEW_YORK, ownerId: 'faction-enemy' },
      },
      intel: {
        'faction-player': [
          alliedRecord({ territoryId: NEW_YORK.id, observationTime: observedAt }),
        ],
      },
    });

    const berlin = computeVisibility(world, 'faction-player').territoryStates[NEW_YORK.id];
    expect(berlin?.state).toBe('live');
    if (berlin?.state === 'live') {
      expect(berlin.sources).toContain('allied');
    }
  });

  it('formatIntelSourceLabel renders multi-source attribution', () => {
    expect(formatIntelSourceLabel(['direct'])).toBeNull();
    expect(formatIntelSourceLabel(['scout'])).toBe('via scouts');
    expect(formatIntelSourceLabel(['direct', 'allied'])).toBe('via ally');
    expect(formatIntelSourceLabel(['scout', 'allied', 'treaty'])).toBe(
      'via scouts · via ally · per treaty',
    );
  });
});

import { tick } from '../src/tick';
import { SCOUT_UNIT_TYPE_ID } from '../src/scout';
import { createSprint4World } from '../../shared/src/scenario-sprint4';

describe('production intel sources', () => {
  it('observation pipeline only writes direct and scout sources', () => {
    const START_MS = 1_700_800_000_000;
    const world = createSprint4World(START_MS);
    const withScout = {
      ...world,
      units: {
        ...world.units,
        'unit-player-scout': {
          id: 'unit-player-scout',
          typeId: SCOUT_UNIT_TYPE_ID,
          ownerId: 'faction-player',
          count: 1,
          locationId: 'territory-london',
          stance: 'hold',
        },
      },
    };
    const { world: observed } = tick(withScout, [], 3_600_000);

    for (const records of Object.values(observed.intel)) {
      for (const record of records ?? []) {
        expect(['direct', 'scout']).toContain(record.source);
      }
    }
  });
});

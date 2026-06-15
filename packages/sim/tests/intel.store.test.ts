import { describe, it, expect } from 'vitest';
import {
  emptyIntelStore,
  INTEL_DECAY_WINDOW_MS,
  isRecordExpired,
  pruneExpiredRecords,
  recordDirectObservations,
} from '../src/intel';
import { tick } from '../src/tick';
import type { IntelRecord } from '../src/types';
import { LONDON, NEW_YORK, PARIS, makeWorld } from './fixtures';

describe('intel store', () => {
  it('starts empty and records direct observations on tick', () => {
    const world = makeWorld();
    expect(world.intel).toEqual({});

    const { world: advanced } = tick(world, [], 3_600_000);
    const records = advanced.intel['faction-player'] ?? [];
    expect(records.length).toBeGreaterThan(0);
    expect(records.every((record) => record.source === 'direct')).toBe(true);
    expect(records.every((record) => record.confidence === 1.0)).toBe(true);
  });

  it('records snapshots for every territory in geometric sight', () => {
    const world = makeWorld({
      territories: {
        [LONDON.id]: LONDON,
        [PARIS.id]: { ...PARIS, ownerId: 'faction-enemy' },
        [NEW_YORK.id]: NEW_YORK,
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

    const store = recordDirectObservations(world);
    const playerRecords = store['faction-player'] ?? [];
    const territoryIds = new Set(playerRecords.map((record) => record.territoryId));

    expect(territoryIds.has(LONDON.id)).toBe(true);
    expect(territoryIds.has(PARIS.id)).toBe(true);
    expect(territoryIds.has(NEW_YORK.id)).toBe(false);
  });

  it('prunes expired records on read only', () => {
    const nowMs = 1_700_000_000_000;
    const record: IntelRecord = {
      observerFaction: 'faction-player',
      territoryId: NEW_YORK.id,
      observationTime: nowMs - INTEL_DECAY_WINDOW_MS - 1,
      snapshot: {
        infraLevel: 1,
        garrisonCount: 0,
        visibleEnemyGarrison: 0,
        inTransitCount: 0,
      },
      source: 'direct',
      expiresAt: null,
      confidence: 1.0,
    };

    expect(isRecordExpired(record, nowMs)).toBe(true);
    expect(pruneExpiredRecords([record], nowMs)).toEqual([]);
    expect(emptyIntelStore()).toEqual({});
  });

  it('does not duplicate identical snapshots on consecutive ticks at the same time', () => {
    const world = makeWorld();
    const once = recordDirectObservations(world);
    const twice = recordDirectObservations({ ...world, intel: once });
    expect(twice['faction-player']?.length).toBe(once['faction-player']?.length);
  });
});

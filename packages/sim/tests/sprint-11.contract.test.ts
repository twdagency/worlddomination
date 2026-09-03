import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import {
  backfillLegacyDispatchEventIds,
  ensureWorldMigrations,
  filterDispatchesForCountry,
  filterDispatchesForFaction,
} from '../src';
import { playerFactionId } from '../src/playerIdentity';
import { migrateLegacyCountryIdFields } from '../src/eventCountryId';
import type { SimEvent } from '../src/types';

const START_MS = 1_700_900_000_000;
const PLAYER = 'faction-player';

describe('sprint-11 contracts', () => {
  it('Phase 1: player country identity is a dispatch-free leaf', () => {
    const world = ensureWorldMigrations(createSprint4World(START_MS));
    expect(playerFactionId(world)).toBe(PLAYER);
  });

  it('Phase 2: legacy dispatch events with factionId migrate to countryId and remain filterable', () => {
    const world = ensureWorldMigrations(createSprint4World(START_MS));
    const legacy = {
      kind: 'orderRejected',
      at: START_MS,
      factionId: PLAYER,
      reason: 'Cannot issue assault on own territory.',
      importance: 'medium',
    };
    const [migrated] = backfillLegacyDispatchEventIds([legacy as unknown as SimEvent]);
    expect(migrated).toMatchObject({ kind: 'orderRejected', countryId: PLAYER });
    expect('factionId' in migrated).toBe(false);
    expect(migrated.eventId).toBe('legacy-0');
    expect(filterDispatchesForCountry(world, [migrated], PLAYER)).toEqual([migrated]);
    expect(filterDispatchesForFaction(world, [migrated], PLAYER)).toEqual([migrated]);
  });

  it('Phase 2: pending dilemmas with factionId migrate to countryId on world load', () => {
    const base = ensureWorldMigrations(createSprint4World(START_MS));
    const migrated = ensureWorldMigrations({
      ...base,
      pendingDilemmas: [
        { dilemmaId: 'foreign-rule', factionId: PLAYER, offeredAt: START_MS } as never,
      ],
    });
    expect(migrated.pendingDilemmas).toEqual([
      { dilemmaId: 'foreign-rule', countryId: PLAYER, offeredAt: START_MS },
    ]);
    expect(migrateLegacyCountryIdFields({ kind: 'victory', at: START_MS, countryId: PLAYER })).toEqual({
      kind: 'victory',
      at: START_MS,
      countryId: PLAYER,
    });
  });

  it.todo(
    'Phase 3: Annexation at 70+ influence transfers ownership peacefully, consumes the daily influence channel, and applies reputation cascade',
  );
});

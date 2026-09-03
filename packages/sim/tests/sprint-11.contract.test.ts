import { describe, expect, it } from 'vitest';
import { playerFactionId } from '../src/playerIdentity';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { ensureWorldMigrations } from '../src/migrations';

const START_MS = 1_700_900_000_000;

describe('sprint-11 contracts', () => {
  it('Phase 1: player country identity is a dispatch-free leaf', () => {
    const world = ensureWorldMigrations(createSprint4World(START_MS));
    expect(playerFactionId(world)).toBe('faction-player');
  });

  it.todo(
    'Phase 2: legacy dispatch events with factionId migrate to countryId and remain filterable',
  );

  it.todo(
    'Phase 3: Annexation at 70+ influence transfers ownership peacefully, consumes the daily influence channel, and applies reputation cascade',
  );
});

import { describe, it, expect } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { ensureWorldMigrations, resolveHostileArrival } from '../src';

describe('player conquest ownership', () => {
  it('transfers territory ownerId to player after assault victory', () => {
    const startMs = 1_700_000_000_000;
    const world = ensureWorldMigrations(createSprint4World(startMs));
    const arriving = {
      ...world.units['unit-player-mg']!,
      locationId: 'territory-paris',
      transit: undefined,
    };

    const result = resolveHostileArrival(
      world,
      arriving,
      'territory-paris',
      startMs,
      'assault',
      'territory-london',
    );

    expect(result.events.some((event) => event.kind === 'battle')).toBe(true);
    expect(result.territories['territory-paris']?.ownerId).toBe('faction-player');
    const remaining = result.units['unit-player-mg']?.count ?? 0;
    expect(remaining).toBeGreaterThanOrEqual(15);
    expect(remaining).toBeLessThan(40);
  });
});

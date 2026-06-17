import { describe, expect, it } from 'vitest';
import { createSprint4World, LEADERS_BY_ID, UNIT_TYPES_BY_ID, resolvePlayerFactionId } from 'shared';
import { ensureWorldMigrations } from 'sim';
import { formatTransitEndpointLabel } from '../src/game/territoryOwnerLabel';

const START_MS = 1_700_000_000_000;
const PARIS = 'territory-paris';
const LONDON = 'territory-london';

function migrate(world: ReturnType<typeof createSprint4World>) {
  return ensureWorldMigrations(world, {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

describe('forces screen transit ownership context', () => {
  it('shows origin and destination ownership labels', () => {
    const world = migrate(createSprint4World(START_MS));
    const playerId = resolvePlayerFactionId(world)!;

    const origin = formatTransitEndpointLabel(world, LONDON, 'inline', playerId);
    const destination = formatTransitEndpointLabel(
      world,
      PARIS,
      'compact',
      playerId,
      undefined,
      true,
    );

    expect(origin).toBe('London (Britain)');
    expect(destination).toContain('Paris · Rome');
    expect(destination).toContain('HOSTILE');
  });

  it('includes stance and leader on destination decision labels', () => {
    const world = migrate(createSprint4World(START_MS));
    const playerId = resolvePlayerFactionId(world)!;
    const destination = formatTransitEndpointLabel(
      world,
      PARIS,
      'compact',
      playerId,
      undefined,
      true,
    );

    expect(destination).toContain('Caesar');
  });
});

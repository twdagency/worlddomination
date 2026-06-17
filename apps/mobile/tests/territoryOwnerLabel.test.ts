import { describe, expect, it } from 'vitest';
import { createSprint4World, LEADERS_BY_ID, UNIT_TYPES_BY_ID } from 'shared';
import { ensureWorldMigrations } from 'sim';
import { resolveTerritoryOwnerLabel } from '../src/game/territoryOwnerLabel';

const START_MS = 1_700_000_000_000;
const PARIS = 'territory-paris';
const LONDON = 'territory-london';
const ROME = 'faction-rome';

function migrate(world: ReturnType<typeof createSprint4World>) {
  return ensureWorldMigrations(world, {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

describe('territoryOwnerLabel', () => {
  it('renders inline variant with owning country', () => {
    const world = migrate(createSprint4World(START_MS));
    const resolved = resolveTerritoryOwnerLabel(world, PARIS, { variant: 'inline' });

    expect(resolved.text).toBe('Paris (Rome)');
    expect(resolved.defeated).toBe(false);
  });

  it('renders compact variant with separator', () => {
    const world = migrate(createSprint4World(START_MS));
    const resolved = resolveTerritoryOwnerLabel(world, PARIS, { variant: 'compact' });

    expect(resolved.text).toBe('Paris · Rome');
  });

  it('renders verbose variant with leader when requested', () => {
    const world = migrate(createSprint4World(START_MS));
    const resolved = resolveTerritoryOwnerLabel(world, PARIS, {
      variant: 'verbose',
      showLeader: true,
    });

    expect(resolved.text).toBe('Paris — Rome, led by Caesar');
  });

  it('uses muted unclaimed treatment when territory has no owner', () => {
    const world = migrate(createSprint4World(START_MS));
    const unowned = {
      ...world,
      territories: {
        ...world.territories,
        [LONDON]: { ...world.territories[LONDON]!, ownerId: undefined },
      },
    };
    const resolved = resolveTerritoryOwnerLabel(unowned, LONDON, { variant: 'inline' });

    expect(resolved.text).toBe('London (unclaimed)');
    expect(resolved.unclaimed).toBe(true);
  });

  it('marks defeated owners with muted treatment', () => {
    const world = migrate(createSprint4World(START_MS));
    const withDefeatedOwner = {
      ...world,
      countries: {
        ...world.countries!,
        [ROME]: {
          ...world.countries![ROME]!,
          defeated: true,
        },
      },
    };
    const resolved = resolveTerritoryOwnerLabel(withDefeatedOwner, PARIS, { variant: 'inline' });

    expect(resolved.text).toBe('Paris (Rome)');
    expect(resolved.defeated).toBe(true);
  });
});

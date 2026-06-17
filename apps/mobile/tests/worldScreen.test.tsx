import { describe, expect, it } from 'vitest';
import { createSprint4World, LEADERS_BY_ID, UNIT_TYPES_BY_ID } from 'shared';
import { ensureWorldMigrations } from 'sim';
import {
  formatWorldTerritoryCountryLine,
  formatWorldTerritoryTitle,
  selectTerritoryCountryContext,
} from '../src/game/countrySelector';

const START_MS = 1_700_000_000_000;

function migrate(world: ReturnType<typeof createSprint4World>) {
  return ensureWorldMigrations(world, {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

describe('WorldScreen country context', () => {
  it('shows country name and leader for a territory row', () => {
    const world = migrate(createSprint4World(START_MS));
    const context = selectTerritoryCountryContext(world, 'territory-paris')!;

    expect(formatWorldTerritoryCountryLine(context)).toBe('Rome — led by Caesar');
  });

  it('marks capital cities with a star in the title', () => {
    const world = migrate(createSprint4World(START_MS));
    const paris = selectTerritoryCountryContext(world, 'territory-paris')!;
    const london = selectTerritoryCountryContext(world, 'territory-london')!;

    expect(formatWorldTerritoryTitle(paris)).toBe('★ Paris');
    expect(formatWorldTerritoryTitle(london)).toBe('★ London');
  });
});

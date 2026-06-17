import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSprint4World, LEADERS_BY_ID, UNIT_TYPES_BY_ID } from 'shared';
import { ensureWorldMigrations } from 'sim';
import { selectCountryById } from '../src/game/countrySelector';
import { playerWorldIntel } from '../src/game/playerView';

const START_MS = 1_700_000_000_000;

function migrate(world: ReturnType<typeof createSprint4World>) {
  return ensureWorldMigrations(world, {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

describe('WorldScreen focus params', () => {
  it('filters territories by focusCountryId in selector logic', () => {
    const world = migrate(createSprint4World(START_MS));
    const entries = playerWorldIntel(world).filter((item) => {
      const ownerId =
        item.snapshot?.ownerId ?? world.territories[item.territoryId]?.ownerId;
      return ownerId === 'faction-rome';
    });

    expect(entries.length).toBeGreaterThan(0);
    expect(selectCountryById(world, 'faction-rome')?.name).toBe('Rome');
  });

  it('implements focus banner, links, and highlight handling in source', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/screens/WorldScreen.tsx'),
      'utf8',
    );

    expect(source).toContain('focusTerritoryId');
    expect(source).toContain('focusCountryId');
    expect(source).toContain('world-country-filter-banner');
    expect(source).toContain('world-territory-link-');
    expect(source).toContain('world-country-link-');
    expect(source).toContain('scrollToIndex');
    expect(source).toContain('useFocusHighlight');
  });
});

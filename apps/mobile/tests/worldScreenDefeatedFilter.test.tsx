import { describe, expect, it } from 'vitest';
import { createSprint4World, LEADERS_BY_ID, UNIT_TYPES_BY_ID } from 'shared';
import {
  ensureWorldMigrations,
  recordConquerorOnTerritoryCapture,
  syncCountriesFromFactions,
} from 'sim';
import {
  formatDefeatedTerritoryLine,
  selectDefeatedWorldTerritories,
} from '../src/game/defeatedCountrySelector';

const PARIS = 'territory-paris';
const ROME = 'faction-rome';
const BRITAIN = 'faction-britain';

function defeatRome() {
  const world = ensureWorldMigrations(createSprint4World(), {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
  return syncCountriesFromFactions({
    ...recordConquerorOnTerritoryCapture(world, PARIS, ROME, BRITAIN),
    territories: {
      ...world.territories,
      [PARIS]: { ...world.territories[PARIS]!, ownerId: BRITAIN },
    },
  }).world;
}

describe('WorldScreen defeated filter', () => {
  it('selects formerly-held territories with conqueror identified', () => {
    const world = defeatRome();
    const rows = selectDefeatedWorldTerritories(world);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.territoryName).toBe('Paris');
    expect(rows[0]?.currentOwnerName).toBe('Spain');
    expect(rows[0]?.conqueredFromName).toBe('Rome');
    expect(formatDefeatedTerritoryLine(rows[0]!)).toContain('conquered from Rome');
  });

  it('implements defeated filter chips and rows in WorldScreen source', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/screens/WorldScreen.tsx'),
      'utf8',
    );
    expect(source).toContain('world-filter-defeated');
    expect(source).toContain('territoryFilter');
    expect(source).toContain('selectDefeatedWorldTerritories');
    expect(source).toContain('formatDefeatedTerritoryLine');
  });
});

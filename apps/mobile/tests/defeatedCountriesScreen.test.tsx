import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSprint4World, LEADERS_BY_ID, UNIT_TYPES_BY_ID } from 'shared';
import {
  ensureWorldMigrations,
  recordConquerorOnTerritoryCapture,
  syncCountriesFromFactions,
} from 'sim';
import { selectDefeatedCountries } from '../src/game/defeatedCountrySelector';

const START_MS = 1_700_600_000_000;
const PARIS = 'territory-paris';
const ROME = 'faction-rome';
const BRITAIN = 'faction-britain';

function defeatRome() {
  const world = ensureWorldMigrations(createSprint4World(START_MS), {
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

describe('DefeatedCountriesScreen', () => {
  it('lists defeated countries with leader, conqueror, and final territory data', () => {
    const world = defeatRome();
    const defeated = selectDefeatedCountries(world);
    expect(defeated[0]?.name).toBe('Rome');
    expect(defeated[0]?.defeatedByName).toBe('Spain');
    expect(defeated[0]?.finalTerritoryName).toBe('Paris');
  });

  it('implements expandable historical cards in source', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/screens/DefeatedCountriesScreen.tsx'),
      'utf8',
    );
    expect(source).toContain('defeated-country-card-');
    expect(source).toContain('defeated-country-detail-');
    expect(source).toContain('Former alliances');
    expect(source).toContain('Tap for historical detail');
  });
});

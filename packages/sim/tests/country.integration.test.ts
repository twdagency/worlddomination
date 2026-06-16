import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { createSprint5World } from '../../shared/src/scenario-sprint5';
import { createTutorialWorld } from '../../shared/src/scenario-tutorial';
import {
  CANONICAL_CAPITALS_BY_SCENARIO,
  ensureWorldCountries,
} from '../src/country';
import { ensureWorldMigrations } from '../src/migrations';
import { LEADERS_BY_ID } from '../../shared/src/leaders';
import { UNIT_TYPES_BY_ID } from '../../shared/src/units';

const START_MS = 1_700_000_000_000;

function migrate(world: ReturnType<typeof createSprint4World>) {
  return ensureWorldMigrations(world, {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

describe('country scenario integration', () => {
  it('migrates sprint-4 with four countries and canonical capitals', () => {
    const world = migrate(createSprint4World(START_MS));
    expect(Object.keys(world.countries ?? {})).toHaveLength(4);

    const caps = CANONICAL_CAPITALS_BY_SCENARIO['sprint-4-ai-world']!;
    for (const [countryId, capitalId] of Object.entries(caps)) {
      expect(world.countries![countryId]?.capitalTerritoryId).toBe(capitalId);
      expect(world.countries![countryId]?.defeated).toBe(false);
    }
  });

  it('migrates sprint-5 with ottoman istanbul capital for faction-britain', () => {
    const world = migrate(createSprint5World(START_MS));
    expect(Object.keys(world.countries ?? {})).toHaveLength(4);
    expect(world.countries!['faction-britain']?.capitalTerritoryId).toBe('territory-istanbul');
    expect(world.countries!['faction-steppe']?.capitalTerritoryId).toBe('territory-sofia');
    expect(world.countries!['faction-rome']?.capitalTerritoryId).toBe('territory-bucharest');
    expect(world.factions['faction-britain']?.leaderId).toBe('leader-suleiman');
  });

  it('migrates tutorial with three countries and france capital at paris', () => {
    const world = ensureWorldCountries(createTutorialWorld(START_MS));
    expect(Object.keys(world.countries ?? {})).toHaveLength(3);

    const caps = CANONICAL_CAPITALS_BY_SCENARIO.tutorial!;
    for (const [countryId, capitalId] of Object.entries(caps)) {
      expect(world.countries![countryId]?.capitalTerritoryId).toBe(capitalId);
    }
    expect(world.countries!['faction-france-tutorial']?.name).toBeTruthy();
  });
});

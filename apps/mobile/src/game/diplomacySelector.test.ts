import { describe, expect, it } from 'vitest';
import { createSprint4World, createTutorialWorld } from 'shared';
import { LEADERS_BY_ID, UNIT_TYPES_BY_ID } from 'shared';
import {
  ensureWorldMigrations,
  recordConquerorOnTerritoryCapture,
  syncCountriesFromFactions,
} from 'sim';
import { diplomacyTargetCountryIds, diplomacyTargetCountries, diplomacyTargetFactionIds, diplomacyTargetFactions } from './diplomacySelector';
import { selectDiplomacyTargets } from './countrySelector';

const START_MS = 1_700_000_000_000;
const PARIS = 'territory-paris';
const ROME = 'faction-rome';

function migrate(world: ReturnType<typeof createSprint4World>) {
  return ensureWorldMigrations(world, {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

describe('diplomacySelector', () => {
  it('excludes the sprint-4 player faction from diplomacy targets', () => {
    const world = createSprint4World(START_MS);
    const targets = diplomacyTargetFactionIds(world);

    expect(targets).not.toContain('faction-player');
    expect(targets).toHaveLength(3);
  });

  it('excludes the tutorial player faction from diplomacy targets', () => {
    const world = createTutorialWorld(START_MS);
    const targets = diplomacyTargetFactions(world);

    expect(targets.some((faction) => faction.isPlayer)).toBe(false);
    expect(targets).toHaveLength(2);
    expect(targets.map((faction) => faction.id)).not.toContain('faction-britain-tutorial');
  });

  it('returns empty when world has only the player faction', () => {
    const world = createTutorialWorld(START_MS);
    const lonePlayer = {
      ...world,
      countries: undefined,
      factions: {
        'faction-britain-tutorial': world.factions['faction-britain-tutorial']!,
      },
    };

    expect(diplomacyTargetFactionIds(lonePlayer)).toEqual([]);
  });

  it('excludes defeated countries from diplomacy targets', () => {
    const world = migrate(createSprint4World(START_MS));
    const defeated = syncCountriesFromFactions({
      ...recordConquerorOnTerritoryCapture(world, PARIS, ROME, 'faction-player'),
      territories: {
        ...world.territories,
        [PARIS]: { ...world.territories[PARIS]!, ownerId: 'faction-player' },
      },
    }).world;

    expect(diplomacyTargetFactionIds(defeated)).not.toContain(ROME);
    expect(selectDiplomacyTargets(defeated).some((country) => country.id === ROME)).toBe(false);
  });

  it('diplomacyTargetCountries matches deprecated faction alias on migrated worlds', () => {
    const world = migrate(createSprint4World(START_MS));
    expect(diplomacyTargetCountries(world)).toEqual(diplomacyTargetFactions(world));
    expect(diplomacyTargetCountryIds(world).sort()).toEqual(
      diplomacyTargetFactionIds(world).sort(),
    );
  });
});

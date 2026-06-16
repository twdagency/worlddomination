import { describe, expect, it } from 'vitest';
import { createSprint4World, createTutorialWorld, LEADERS_BY_ID, resolvePlayerFactionId, UNIT_TYPES_BY_ID } from 'shared';
import { ensureWorldMigrations, recordConquerorOnTerritoryCapture, syncCountriesFromFactions } from 'sim';
import {
  formatDiplomacyCountryTitle,
  selectActiveCountries,
  selectCountries,
  selectCountryById,
  selectDefeatedCountries,
  selectDiplomacyTargets,
  selectPlayerCountry,
} from './countrySelector';

const START_MS = 1_700_000_000_000;
const ROME = 'faction-rome';
const PARIS = 'territory-paris';

function migrate(world: ReturnType<typeof createSprint4World>) {
  return ensureWorldMigrations(world, {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

describe('countrySelector', () => {
  it('selectCountries returns all countries including defeated', () => {
    const world = migrate(createSprint4World(START_MS));
    const defeated = syncCountriesFromFactions({
      ...world,
      territories: {
        ...world.territories,
        [PARIS]: { ...world.territories[PARIS]!, ownerId: 'faction-player' },
      },
    }).world;

    const countries = selectCountries(defeated);
    expect(countries).toHaveLength(4);
    expect(countries.some((country) => country.id === ROME && country.defeated)).toBe(true);
  });

  it('selectActiveCountries filters defeated countries', () => {
    const world = migrate(createSprint4World(START_MS));
    const defeated = syncCountriesFromFactions({
      ...recordConquerorOnTerritoryCapture(world, PARIS, ROME, 'faction-player'),
      territories: {
        ...world.territories,
        [PARIS]: { ...world.territories[PARIS]!, ownerId: 'faction-player' },
      },
    }).world;

    expect(selectActiveCountries(defeated).some((country) => country.id === ROME)).toBe(false);
    expect(selectDefeatedCountries(defeated).map((country) => country.id)).toContain(ROME);
  });

  it('selectPlayerCountry returns the player country', () => {
    const world = migrate(createSprint4World(START_MS));
    const playerId = resolvePlayerFactionId(world)!;
    const playerCountry = selectPlayerCountry(world);

    expect(playerCountry?.id).toBe(playerId);
    expect(playerCountry?.isPlayer).toBe(true);
    expect(playerCountry?.name).toBe('Britain');
  });

  it('selectDefeatedCountries returns only defeated entries with empty cities', () => {
    const world = migrate(createSprint4World(START_MS));
    const defeated = syncCountriesFromFactions({
      ...recordConquerorOnTerritoryCapture(world, PARIS, ROME, 'faction-player'),
      territories: {
        ...world.territories,
        [PARIS]: { ...world.territories[PARIS]!, ownerId: 'faction-player' },
      },
    }).world;

    const onlyDefeated = selectDefeatedCountries(defeated);
    expect(onlyDefeated.every((country) => country.defeated)).toBe(true);
    expect(onlyDefeated.find((country) => country.id === ROME)?.cities).toEqual([]);
  });

  it('defeated country with zero cities cannot own territories (orphans unreachable)', () => {
    const world = migrate(createSprint4World(START_MS));
    const defeated = syncCountriesFromFactions({
      ...recordConquerorOnTerritoryCapture(world, PARIS, ROME, 'faction-player'),
      territories: {
        ...world.territories,
        [PARIS]: { ...world.territories[PARIS]!, ownerId: 'faction-player' },
      },
    }).world;

    const rome = selectCountryById(defeated, ROME);
    expect(rome?.defeated).toBe(true);
    expect(rome?.cities).toEqual([]);
    expect(
      Object.values(defeated.territories).some((territory) => territory.ownerId === ROME),
    ).toBe(false);
  });

  it('tutorial world constructs countries at creation with canonical capitals', () => {
    const world = createTutorialWorld(START_MS);
    const france = selectCountryById(world, 'faction-france-tutorial');
    expect(france?.capitalTerritoryId).toBe('territory-paris-tutorial');
    expect(france?.capitalName).toBe('Paris');
  });
});

describe('diplomacy country presentation', () => {
  it('formats country-led diplomacy title', () => {
    const world = migrate(createSprint4World(START_MS));
    const rome = selectCountryById(world, ROME)!;
    expect(formatDiplomacyCountryTitle(rome)).toBe('Rome — led by Caesar');
  });

  it('selectDiplomacyTargets excludes player and defeated countries', () => {
    const world = migrate(createSprint4World(START_MS));
    const playerId = resolvePlayerFactionId(world)!;
    const targets = selectDiplomacyTargets(world);

    expect(targets.every((country) => country.id !== playerId)).toBe(true);
    expect(targets).toHaveLength(3);

    const defeated = syncCountriesFromFactions({
      ...recordConquerorOnTerritoryCapture(world, PARIS, ROME, playerId),
      territories: {
        ...world.territories,
        [PARIS]: { ...world.territories[PARIS]!, ownerId: playerId },
      },
    }).world;

    expect(selectDiplomacyTargets(defeated).some((country) => country.id === ROME)).toBe(false);
  });
});

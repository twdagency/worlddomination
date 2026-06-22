import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import {
  activeCountries,
  CANONICAL_CAPITALS_BY_SCENARIO,
  citiesOf,
  countryToFaction,
  ensureWorldCountries,
  factionToCountry,
  findCountry,
  resolveCanonicalCapital,
  syncCountriesFromFactions,
} from '../src/country';
import { ensureWorldMigrations } from '../src/migrations';
import { LEADERS_BY_ID } from '../../shared/src/leaders';
import { UNIT_TYPES_BY_ID } from '../../shared/src/units';

const START_MS = 1_700_000_000_000;
const PLAYER = 'faction-player';
const LONDON = 'territory-london';
const PARIS = 'territory-paris';

function migrate(world: ReturnType<typeof createSprint4World>) {
  return ensureWorldMigrations(world, {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

describe('ensureWorldCountries', () => {
  it('populates countries from factions 1:1', () => {
    const world = migrate(createSprint4World(START_MS));
    expect(Object.keys(world.countries ?? {}).sort()).toEqual(
      Object.keys(world.factions).sort(),
    );
    expect(world.countries![PLAYER]?.leaderId).toBe(world.factions[PLAYER]!.leaderId);
  });

  it('is idempotent on repeated migration', () => {
    const once = ensureWorldCountries(createSprint4World(START_MS));
    const twice = ensureWorldCountries(once);
    expect(twice.countries).toEqual(once.countries);
  });

  it('assigns sprint-4 canonical capitals', () => {
    const world = migrate(createSprint4World(START_MS));
    const caps = CANONICAL_CAPITALS_BY_SCENARIO['sprint-4-ai-world']!;
    for (const [countryId, capitalId] of Object.entries(caps)) {
      expect(world.countries![countryId]?.capitalTerritoryId).toBe(capitalId);
    }
  });

  it('defaults capital to first owned territory when not in canonical table', () => {
    const base = createSprint4World(START_MS);
    const world = {
      ...base,
      factions: {
        ...base.factions,
        'faction-oracle': {
          id: 'faction-oracle',
          leaderId: 'leader-elizabeth',
          isPlayer: false,
          funding: 1,
          manpower: 1,
          manpowerCap: 1,
        },
      },
      territories: {
        ...base.territories,
        'territory-zulu': {
          id: 'territory-zulu',
          name: 'Zulu',
          coord: { lat: 0, lon: 0 },
          ownerId: 'faction-oracle',
          baseYield: 1,
          infraLevel: 1,
          resources: {},
        },
        'territory-alfa': {
          id: 'territory-alfa',
          name: 'Alfa',
          coord: { lat: 1, lon: 1 },
          ownerId: 'faction-oracle',
          baseYield: 1,
          infraLevel: 1,
          resources: {},
        },
      },
    };
    const migrated = ensureWorldCountries(world);
    expect(migrated.countries!['faction-oracle']?.capitalTerritoryId).toBe('territory-alfa');
  });

  it('sets defeated true when a faction owns zero territories', () => {
    const base = createSprint4World(START_MS);
    const world = {
      ...base,
      factions: {
        ...base.factions,
        'faction-landless': {
          id: 'faction-landless',
          leaderId: 'leader-caesar',
          isPlayer: false,
          funding: 0,
          manpower: 0,
          manpowerCap: 0,
        },
      },
    };
    const migrated = ensureWorldCountries(world);
    expect(migrated.countries!['faction-landless']?.defeated).toBe(true);
    expect(migrated.countries!['faction-landless']?.capitalTerritoryId).toBe('');
  });
});

describe('country helpers', () => {
  it('citiesOf returns territories owned by the country', () => {
    const world = migrate(createSprint4World(START_MS));
    const cities = citiesOf(world, PLAYER);
    expect(cities.map((t) => t.id)).toEqual([LONDON]);
  });

  it('citiesOf returns empty array for a defeated landless country', () => {
    const base = migrate(createSprint4World(START_MS));
    const world = syncCountriesFromFactions({
      ...base,
      countries: {
        ...base.countries!,
        'faction-landless': {
          id: 'faction-landless',
          name: 'Nowhere',
          leaderId: 'leader-caesar',
          capitalTerritoryId: '',
          defeated: true,
          isPlayer: false,
          funding: 0,
          manpower: 0,
          manpowerCap: 0,
        },
      },
    }).world;
    expect(citiesOf(world, 'faction-landless')).toEqual([]);
  });

  it('findCountry returns undefined for unknown IDs', () => {
    const world = migrate(createSprint4World(START_MS));
    expect(findCountry(world, 'faction-missing')).toBeUndefined();
  });

  it('activeCountries filters out defeated entries', () => {
    const base = migrate(createSprint4World(START_MS));
    const world = {
      ...base,
      countries: {
        ...base.countries!,
        'faction-landless': {
          id: 'faction-landless',
          name: 'Nowhere',
          leaderId: 'leader-caesar',
          capitalTerritoryId: '',
          defeated: true,
          isPlayer: false,
          funding: 0,
          manpower: 0,
          manpowerCap: 0,
        },
      },
    };
    const active = activeCountries(world);
    expect(active.some((c) => c.id === 'faction-landless')).toBe(false);
    expect(active.some((c) => c.id === PLAYER)).toBe(true);
  });

  it('factionToCountry and countryToFaction round-trip for active countries', () => {
    const world = migrate(createSprint4World(START_MS));
    const country = factionToCountry(world, PLAYER);
    const faction = countryToFaction(world, PLAYER);
    expect(country?.id).toBe(PLAYER);
    expect(faction?.id).toBe(PLAYER);
    expect(faction?.isPlayer).toBe(true);
  });
});

describe('syncCountriesFromFactions', () => {
  it('updates defeated when territory ownership changes', () => {
    const world = migrate(createSprint4World(START_MS));
    const rome = 'faction-rome';
    const afterLoss = {
      ...world,
      territories: {
        ...world.territories,
        [PARIS]: { ...world.territories[PARIS]!, ownerId: PLAYER },
      },
    };
    const { world: synced } = syncCountriesFromFactions(afterLoss);
    expect(synced.countries![rome]?.defeated).toBe(true);
    expect(citiesOf(synced, rome)).toHaveLength(0);
  });
});

describe('country migration persistence', () => {
  it('backfills countries on legacy saves and round-trips JSON', () => {
    const legacy = createSprint4World(START_MS);
    expect(legacy.countries).toBeUndefined();

    const migrated = migrate(legacy);
    expect(migrated.countries).toBeDefined();

    const roundTrip = ensureWorldMigrations(
      JSON.parse(JSON.stringify(migrated)) as typeof migrated,
      { leaders: LEADERS_BY_ID, unitTypes: UNIT_TYPES_BY_ID },
    );
    expect(roundTrip.countries).toEqual(migrated.countries);
  });

  it('preserves diplomacy reputation keys after country migration', () => {
    const world = migrate(createSprint4World(START_MS));
    const genghis = 'faction-steppe';
    expect(world.reputation[PLAYER]?.[genghis]).toBeDefined();
    expect(factionToCountry(world, genghis)?.id).toBe(genghis);
  });
});

describe('resolveCanonicalCapital', () => {
  it('prefers scenario mapping over first-territory fallback', () => {
    const world = createSprint4World(START_MS);
    const capital = resolveCanonicalCapital(world, PLAYER, [LONDON, 'territory-paris']);
    expect(capital).toBe(LONDON);
  });
});

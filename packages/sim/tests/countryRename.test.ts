import { describe, expect, it } from 'vitest';
import { createSprint5World } from 'shared';
import {
  ensureWorldFactionRename,
  ensureWorldMigrations,
  getCountryById,
  getFactionById,
  findCountry,
  type Country,
  type Faction,
  type WorldState,
} from '../src';

function sprint9LegacyWorld(nowMs: number = Date.now()): WorldState {
  const migrated = ensureWorldMigrations(createSprint5World(nowMs));
  const { countries: _countries, ...legacy } = migrated;
  return legacy;
}

describe('Sprint 10 Phase 3 — faction → country rename', () => {
  it('Country type and Faction alias produce identical objects', () => {
    const sample: Country = {
      id: 'faction-player',
      leaderId: 'leader-elizabeth',
      isPlayer: true,
      funding: 100,
      manpower: 50,
      manpowerCap: 200,
      name: 'England',
      capitalTerritoryId: 'territory-london',
      defeated: false,
    };
    const alias: Faction = sample;
    expect(alias).toBe(sample);
    expect(alias.id).toBe('faction-player');
  });

  it('world.countries accessible on migrated worlds', () => {
    const world = ensureWorldMigrations(createSprint5World());
    expect(world.countries).toBeDefined();
    expect(Object.keys(world.countries!).length).toBeGreaterThan(0);
    expect(world.countries!['faction-player']?.name).toBeTruthy();
  });

  it('world.factions accessible on migrated worlds (alias field preserved)', () => {
    const world = ensureWorldMigrations(createSprint5World());
    expect(world.factions['faction-player']?.funding).toBeDefined();
    expect(world.factions['faction-player']?.id).toBe('faction-player');
  });

  it('migration: old save with factions only loads as countries', () => {
    const legacy = sprint9LegacyWorld();
    expect(legacy.countries).toBeUndefined();

    const migrated = ensureWorldMigrations(legacy);
    expect(migrated.countries).toBeDefined();
    expect(migrated.countries!['faction-player']?.funding).toBe(
      legacy.factions['faction-player']?.funding,
    );
    expect(migrated.countries!['faction-player']?.capitalTerritoryId).toBeTruthy();
  });

  it('migration: ensureWorldFactionRename is idempotent on re-run', () => {
    const once = ensureWorldFactionRename(ensureWorldMigrations(createSprint5World()));
    const twice = ensureWorldFactionRename(once);
    expect(twice.countries).toEqual(once.countries);
    expect(twice.factions).toEqual(once.factions);
  });

  it('migration: round-trip serialize/deserialize preserves country state', () => {
    const world = ensureWorldMigrations(createSprint5World());
    const roundTrip = ensureWorldMigrations(
      JSON.parse(JSON.stringify(world)) as WorldState,
    );
    expect(roundTrip.countries).toEqual(world.countries);
    expect(roundTrip.factions['faction-player']).toEqual(world.factions['faction-player']);
  });

  it('deprecated getFactionById delegates to getCountryById', () => {
    const world = ensureWorldMigrations(createSprint5World());
    expect(getFactionById(world, 'faction-player')).toEqual(
      getCountryById(world, 'faction-player'),
    );
  });

  it('findCountry reads world.factions when countries field is absent', () => {
    const world = ensureWorldMigrations(createSprint5World());
    const { countries: _countries, ...factionsOnly } = world;
    expect(findCountry(factionsOnly, 'faction-player')?.funding).toBe(
      world.factions['faction-player']?.funding,
    );
    expect(findCountry(factionsOnly, 'faction-player')?.id).toBe('faction-player');
  });
});

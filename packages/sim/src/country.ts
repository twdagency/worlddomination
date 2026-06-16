import type { Country, Faction, Id, Territory, WorldState } from './types';

/**
 * Scenario-specific capital assignments. Same faction ID may map to different
 * capitals across scenarios (e.g. faction-player: London vs Belgrade).
 */
export const CANONICAL_CAPITALS_BY_SCENARIO: Record<Id, Record<Id, Id>> = {
  'sprint-4-ai-world': {
    'faction-player': 'territory-london',
    'faction-rome': 'territory-paris',
    'faction-steppe': 'territory-berlin',
    'faction-britain': 'territory-madrid',
  },
  'sprint-5-legibility-demo': {
    'faction-player': 'territory-belgrade',
    'faction-rome': 'territory-bucharest',
    'faction-steppe': 'territory-sofia',
    'faction-britain': 'territory-istanbul',
  },
  tutorial: {
    'faction-britain-tutorial': 'territory-london-tutorial',
    'faction-france-tutorial': 'territory-paris-tutorial',
    'faction-burgundy-tutorial': 'territory-burgundy-tutorial',
  },
};

/** Tutorial-only and other globally unique faction IDs (not shared across scenarios). */
export const CANONICAL_CAPITALS: Record<Id, Id> = {
  ...CANONICAL_CAPITALS_BY_SCENARIO.tutorial,
};

function countryName(world: WorldState, faction: Faction): string {
  const leader = world.leaders[faction.leaderId];
  return leader?.region ?? faction.id;
}

function ownedTerritories(world: WorldState, countryId: Id): Territory[] {
  return Object.values(world.territories).filter((territory) => territory.ownerId === countryId);
}

export function citiesOf(world: WorldState, countryId: Id): Territory[] {
  return ownedTerritories(world, countryId);
}

export function resolveCanonicalCapital(
  world: WorldState,
  countryId: Id,
  ownedTerritoryIds: readonly Id[],
): Id {
  const scenarioMap = CANONICAL_CAPITALS_BY_SCENARIO[world.scenarioId];
  const candidate = scenarioMap?.[countryId] ?? CANONICAL_CAPITALS[countryId];
  if (candidate && ownedTerritoryIds.includes(candidate)) {
    return candidate;
  }
  if (ownedTerritoryIds.length > 0) {
    return [...ownedTerritoryIds].sort((a, b) => a.localeCompare(b))[0]!;
  }
  return '';
}

function buildCountryFromFaction(world: WorldState, faction: Faction): Country {
  const owned = ownedTerritories(world, faction.id);
  const ownedIds = owned.map((territory) => territory.id);
  const capitalTerritoryId = resolveCanonicalCapital(world, faction.id, ownedIds);
  const leader = world.leaders[faction.leaderId];

  if (ownedIds.length === 0 && capitalTerritoryId === '') {
    // Graceful edge case: faction with no matching territory ownership.
    if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
      console.warn(
        `[country] ${faction.id} has no owned territories; capital left empty`,
      );
    }
  }

  return {
    id: faction.id,
    name: countryName(world, faction),
    leaderId: faction.leaderId,
    capitalTerritoryId,
    defeated: ownedIds.length === 0,
    isPlayer: faction.isPlayer,
    diplomaticPosture: leader?.weights.diplomaticPosture,
  };
}

function countriesMatchFactions(world: WorldState): boolean {
  const factionIds = Object.keys(world.factions).sort();
  const countryIds = Object.keys(world.countries ?? {}).sort();
  return (
    factionIds.length > 0 &&
    factionIds.length === countryIds.length &&
    factionIds.every((id, index) => id === countryIds[index])
  );
}

/** Derive `world.countries` from legacy `world.factions`. Idempotent. */
export function ensureWorldCountries(world: WorldState): WorldState {
  if (countriesMatchFactions(world)) {
    return syncCountriesFromFactions(world);
  }

  const countries: Record<Id, Country> = {};
  for (const faction of Object.values(world.factions)) {
    countries[faction.id] = buildCountryFromFaction(world, faction);
  }

  return { ...world, countries };
}

/**
 * Recompute `defeated` from territory ownership. Capital relocation deferred to Phase 2.
 */
export function syncCountriesFromFactions(world: WorldState): WorldState {
  if (!world.countries || Object.keys(world.countries).length === 0) {
    return world;
  }

  const countries: Record<Id, Country> = {};
  for (const [id, country] of Object.entries(world.countries)) {
    const owned = ownedTerritories(world, id);
    countries[id] = {
      ...country,
      defeated: owned.length === 0,
    };
  }

  return { ...world, countries };
}

export function findCountry(world: WorldState, countryId: Id): Country | undefined {
  return world.countries?.[countryId];
}

export function activeCountries(world: WorldState): Country[] {
  return Object.values(world.countries ?? {}).filter((country) => !country.defeated);
}

export function factionToCountry(world: WorldState, factionId: Id): Country | undefined {
  return findCountry(world, factionId);
}

export function countryToFaction(world: WorldState, countryId: Id): Faction | undefined {
  return world.factions[countryId];
}

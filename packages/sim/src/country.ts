import type { Country, Faction, Id, Millis, SimEventDraft, Territory, WorldState } from './types';
import {
  dissolveAlliancesForDefeatedCountry,
  expireTreatiesForDefeatedCountry,
  getAlliancesFor,
} from './diplomacy';
import { clearInfluenceForCountry } from './influence';

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

export interface CountrySyncResult {
  world: WorldState;
  events: SimEventDraft[];
}

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

export function isCountryDefeated(world: WorldState, countryId: Id): boolean {
  return citiesOf(world, countryId).length === 0;
}

/**
 * Highest infraLevel wins; ties broken by lexicographic territory ID.
 * SPRINT-9: switch to population-based capital selection when available.
 */
export function selectNewCapital(cities: Territory[]): Territory {
  return [...cities].sort((a, b) => {
    const infraDiff = b.infraLevel - a.infraLevel;
    if (infraDiff !== 0) return infraDiff;
    return a.id.localeCompare(b.id);
  })[0]!;
}

export function setCountryCapital(world: WorldState, countryId: Id, capitalTerritoryId: Id): WorldState {
  const country = world.countries?.[countryId];
  if (!country) return world;
  return {
    ...world,
    countries: {
      ...world.countries,
      [countryId]: { ...country, capitalTerritoryId },
    },
  };
}

export function setCountryDefeated(world: WorldState, countryId: Id): WorldState {
  const country = world.countries?.[countryId];
  if (!country || country.defeated) return world;
  return {
    ...world,
    countries: {
      ...world.countries,
      [countryId]: { ...country, defeated: true },
    },
  };
}

export function relocateCapitalIfNeeded(world: WorldState, countryId: Id): WorldState {
  const country = findCountry(world, countryId);
  if (!country || country.defeated) return world;

  const capital = world.territories[country.capitalTerritoryId];
  if (capital?.ownerId === countryId) return world;

  const cities = citiesOf(world, countryId);
  if (cities.length === 0) return world;

  const newCapital = selectNewCapital(cities);
  return setCountryCapital(world, countryId, newCapital.id);
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
    if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
      console.warn(`[country] ${faction.id} has no owned territories; capital left empty`);
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

/** Record conqueror when a city changes hands (ignores neutral captures and self-capture). */
export function recordConquerorOnTerritoryCapture(
  world: WorldState,
  territoryId: Id,
  previousOwnerId: Id | undefined,
  newOwnerId: Id,
): WorldState {
  if (!previousOwnerId || previousOwnerId === newOwnerId || !world.countries) {
    return world;
  }

  const country = world.countries[previousOwnerId];
  if (!country) return world;

  return {
    ...world,
    countries: {
      ...world.countries,
      [previousOwnerId]: {
        ...country,
        lastConquerorId: newOwnerId,
        lastLostTerritoryId: territoryId,
      },
    },
  };
}

function buildCapitalRelocatedEvent(
  at: Millis,
  countryId: Id,
  oldCapitalTerritoryId: Id,
  newCapitalTerritoryId: Id,
): SimEventDraft {
  return {
    kind: 'capitalRelocated',
    at,
    countryId,
    oldCapitalTerritoryId,
    newCapitalTerritoryId,
    importance: 'medium',
  };
}

function buildCountryDefeatedEvent(
  at: Millis,
  country: Country,
  formerAlliances: Id[],
): SimEventDraft {
  return {
    kind: 'countryDefeated',
    at,
    countryId: country.id,
    defeatedBy: country.lastConquerorId,
    finalTerritoryId: country.lastLostTerritoryId ?? country.capitalTerritoryId,
    formerAlliances,
    importance: 'high',
  };
}

function clearPendingDilemmasForCountry(world: WorldState, countryId: Id): WorldState {
  const pending = world.pendingDilemmas ?? [];
  const next = pending.filter((entry) => entry.factionId !== countryId);
  if (next.length === pending.length) return world;
  return { ...world, pendingDilemmas: next };
}

/**
 * Full defeat cascade: mark defeated, dissolve alliances, expire treaties, clear dilemmas,
 * emit events in dispatch order:
 *   1. allianceBroken (per ally, ally ID order)
 *   2. treatyExpired (per treaty, treaty ID order)
 *   3. countryDefeated (culmination — always last)
 */
export function defeatCountry(
  world: WorldState,
  countryId: Id,
  at: Millis,
): { world: WorldState; events: SimEventDraft[] } {
  const country = findCountry(world, countryId);
  if (!country || country.defeated) return { world, events: [] };

  const preDefeatSnapshot = country;
  const formerAllianceIds = getAlliancesFor(world, countryId);
  let w: WorldState = {
    ...world,
    countries: {
      ...world.countries!,
      [countryId]: {
        ...preDefeatSnapshot,
        defeated: true,
        defeatedAt: at,
        formerAllianceIds,
      },
    },
  };
  const events: SimEventDraft[] = [];

  const alliances = dissolveAlliancesForDefeatedCountry(w, countryId, at);
  w = alliances.world;
  events.push(...alliances.events);

  const treaties = expireTreatiesForDefeatedCountry(w, countryId, at);
  w = treaties.world;
  events.push(...treaties.events);

  w = clearPendingDilemmasForCountry(w, countryId);
  w = clearInfluenceForCountry(w, countryId);
  events.push(buildCountryDefeatedEvent(at, preDefeatSnapshot, formerAllianceIds));

  return { world: w, events };
}

/** Derive `world.countries` from legacy `world.factions`. Idempotent; no defeat events. */
export function ensureWorldCountries(world: WorldState): WorldState {
  let next: WorldState;
  if (countriesMatchFactions(world)) {
    next = syncCountriesFromFactions(world).world;
  } else {
    const countries: Record<Id, Country> = {};
    for (const faction of Object.values(world.factions)) {
      countries[faction.id] = buildCountryFromFaction(world, faction);
    }
    next = syncCountriesFromFactions({ ...world, countries }).world;
  }
  return backfillCountryDefeatMetadata(next);
}

/** Older saves may lack defeat forensic fields — backfill with safe defaults. */
export function backfillCountryDefeatMetadata(world: WorldState): WorldState {
  if (!world.countries) return world;

  let changed = false;
  const countries: Record<Id, Country> = { ...world.countries };

  for (const [countryId, country] of Object.entries(countries)) {
    if (!country.defeated) continue;
    if (country.formerAllianceIds !== undefined) continue;
    countries[countryId] = { ...country, formerAllianceIds: [] };
    changed = true;
  }

  return changed ? { ...world, countries } : world;
}

/**
 * Reconcile countries with territory ownership: capital relocation and defeat.
 * Emits events only on transitions (not for countries already defeated at load).
 */
export function syncCountriesFromFactions(world: WorldState): CountrySyncResult {
  if (!world.countries || Object.keys(world.countries).length === 0) {
    return { world, events: [] };
  }

  let w = world;
  const events: SimEventDraft[] = [];
  const countries = w.countries!;
  const countryIds = Object.keys(countries).sort();

  for (const countryId of countryIds) {
    const country = w.countries![countryId];
    if (!country || country.defeated) continue;

    const cities = citiesOf(w, countryId);
    const capitalHeld = cities.some((city) => city.id === country.capitalTerritoryId);

    if (!capitalHeld && cities.length > 0) {
      const oldCapitalTerritoryId = country.capitalTerritoryId;
      const newCapital = selectNewCapital(cities);
      if (newCapital.id !== country.capitalTerritoryId) {
        w = setCountryCapital(w, countryId, newCapital.id);
        events.push(
          buildCapitalRelocatedEvent(
            w.nowMs,
            countryId,
            oldCapitalTerritoryId,
            newCapital.id,
          ),
        );
      }
    }

    if (cities.length === 0) {
      const cascade = defeatCountry(w, countryId, w.nowMs);
      w = cascade.world;
      events.push(...cascade.events);
    }
  }

  return { world: w, events };
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

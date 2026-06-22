import { citiesOf, type Id, type WorldState } from 'sim';
import { resolvePlayerFactionId } from 'shared';

export interface CityView {
  id: Id;
  name: string;
  isCapital: boolean;
  infraLevel: number;
}

export interface CountryView {
  id: Id;
  name: string;
  leaderId: Id;
  leaderName: string;
  capitalTerritoryId: Id;
  capitalName: string;
  defeated: boolean;
  cities: CityView[];
  isPlayer: boolean;
}

export interface TerritoryCountryContext {
  territoryId: Id;
  territoryName: string;
  ownerId?: Id;
  country: CountryView | null;
  isCapital: boolean;
  orphanedFormerCountry?: string;
}

function capitalName(world: WorldState, capitalTerritoryId: Id): string {
  if (!capitalTerritoryId) return '—';
  return world.territories[capitalTerritoryId]?.name ?? capitalTerritoryId;
}

function buildCityViews(
  world: WorldState,
  countryId: Id,
  capitalTerritoryId: Id,
): CityView[] {
  const territories = world.countries
    ? citiesOf(world, countryId)
    : Object.values(world.territories).filter((territory) => territory.ownerId === countryId);

  return territories
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((territory) => ({
      id: territory.id,
      name: territory.name,
      isCapital: territory.id === capitalTerritoryId,
      infraLevel: territory.infraLevel,
    }));
}

function countryViewFromRecord(
  world: WorldState,
  country: NonNullable<WorldState['countries']>[Id],
): CountryView {
  const leader = world.leaders[country.leaderId];
  return {
    id: country.id,
    name: country.name ?? leader?.region ?? country.id,
    leaderId: country.leaderId,
    leaderName: leader?.name ?? country.leaderId,
    capitalTerritoryId: country.capitalTerritoryId ?? '',
    capitalName: capitalName(world, country.capitalTerritoryId ?? ''),
    defeated: country.defeated ?? false,
    cities: buildCityViews(world, country.id, country.capitalTerritoryId ?? ''),
    isPlayer: country.isPlayer,
  };
}

function legacyCountryViews(world: WorldState): CountryView[] {
  if (!world.factions) return [];
  return Object.values(world.factions)
    .map((faction) => {
      const leader = world.leaders[faction.leaderId];
      const owned = Object.values(world.territories).filter(
        (territory) => territory.ownerId === faction.id,
      );
      const sorted = [...owned].sort((a, b) => a.name.localeCompare(b.name));
      const capitalTerritoryId = sorted[0]?.id ?? '';
      return {
        id: faction.id,
        name: leader?.region ?? faction.id,
        leaderId: faction.leaderId,
        leaderName: leader?.name ?? faction.id,
        capitalTerritoryId,
        capitalName: sorted[0]?.name ?? '—',
        defeated: false,
        cities: sorted.map((territory) => ({
          id: territory.id,
          name: territory.name,
          isCapital: territory.id === capitalTerritoryId,
          infraLevel: territory.infraLevel,
        })),
        isPlayer: faction.isPlayer,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function selectCountries(world: WorldState | null): CountryView[] {
  if (!world) return [];

  if (world.countries && Object.keys(world.countries).length > 0) {
    return Object.values(world.countries)
      .sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id))
      .map((country) => countryViewFromRecord(world, country));
  }

  return legacyCountryViews(world);
}

export function selectActiveCountries(world: WorldState | null): CountryView[] {
  return selectCountries(world).filter((country) => !country.defeated);
}

export function selectDefeatedCountries(world: WorldState | null): CountryView[] {
  return selectCountries(world).filter((country) => country.defeated);
}

export function selectCountryById(world: WorldState | null, id: Id): CountryView | null {
  return selectCountries(world).find((country) => country.id === id) ?? null;
}

export function selectPlayerCountry(world: WorldState | null): CountryView | null {
  if (!world) return null;
  const playerId = resolvePlayerFactionId(world);
  if (!playerId) return null;
  return selectCountryById(world, playerId);
}

/** Active countries excluding the human player — diplomacy list source. */
export function selectDiplomacyTargets(world: WorldState | null): CountryView[] {
  if (!world) return [];
  const playerId = resolvePlayerFactionId(world);
  return selectActiveCountries(world).filter((country) => country.id !== playerId);
}

export function formatDiplomacyCountryTitle(country: CountryView): string {
  return `${country.name} — led by ${country.leaderName}`;
}

export function formatDiplomacyCountrySubtitle(
  country: CountryView,
  statusLabel: string,
): string {
  const cities =
    country.cities.length > 0
      ? country.cities.map((city) => city.name).join(', ')
      : 'No holdings';
  return `${statusLabel} · Capital: ${country.capitalName} · ${cities}`;
}

export function selectTerritoryCountryContext(
  world: WorldState | null,
  territoryId: Id,
  ownerId?: Id,
): TerritoryCountryContext | null {
  if (!world) return null;

  const territory = world.territories[territoryId];
  const territoryName = territory?.name ?? territoryId;
  const resolvedOwnerId = ownerId ?? territory?.ownerId;
  if (!resolvedOwnerId) {
    return {
      territoryId,
      territoryName,
      ownerId: undefined,
      country: null,
      isCapital: false,
    };
  }

  const country = selectCountryById(world, resolvedOwnerId);
  const isCapital = Boolean(country && country.capitalTerritoryId === territoryId);

  if (country?.defeated && country.cities.length === 0) {
    return {
      territoryId,
      territoryName,
      ownerId: resolvedOwnerId,
      country,
      isCapital,
      orphanedFormerCountry: country.name,
    };
  }

  return {
    territoryId,
    territoryName,
    ownerId: resolvedOwnerId,
    country,
    isCapital,
  };
}

export function formatWorldTerritoryTitle(context: TerritoryCountryContext): string {
  return context.isCapital ? `★ ${context.territoryName}` : context.territoryName;
}

export function formatWorldTerritoryCountryLine(context: TerritoryCountryContext): string | undefined {
  if (context.orphanedFormerCountry) {
    return `Contested — formerly ${context.orphanedFormerCountry}`;
  }
  if (!context.country) return undefined;
  return `${context.country.name} — led by ${context.country.leaderName}`;
}

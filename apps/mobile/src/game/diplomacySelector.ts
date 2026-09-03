import type { Country, Id, WorldState } from 'sim';
import { findCountry } from 'sim';
import { selectDiplomacyTargets } from './countrySelector';

/** Countries shown on the Diplomacy screen — excludes the human player and defeated countries. */
export function diplomacyTargetCountries(world: WorldState): Country[] {
  return selectDiplomacyTargets(world)
    .map((view) => findCountry(world, view.id))
    .filter((country): country is Country => country !== undefined);
}

/**
 * @deprecated Use `diplomacyTargetCountries` instead.
 */
export function diplomacyTargetFactions(world: WorldState): Country[] {
  return diplomacyTargetCountries(world);
}

export function diplomacyTargetCountryIds(world: WorldState): Id[] {
  return diplomacyTargetCountries(world).map((country) => country.id);
}

/** @deprecated Use `diplomacyTargetCountryIds` instead. */
export function diplomacyTargetFactionIds(world: WorldState): Id[] {
  return diplomacyTargetCountryIds(world);
}

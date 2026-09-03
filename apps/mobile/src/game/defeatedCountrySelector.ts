import { findCountry, type Id, type Millis, type WorldState } from 'sim';
import { selectCountries } from './countrySelector';

export interface DefeatedAllianceView {
  id: Id;
  name: string;
}

export interface DefeatedCountryView {
  id: Id;
  name: string;
  leaderId: Id;
  leaderName: string;
  defeatedBy: Id | undefined;
  defeatedByName: string | undefined;
  finalTerritoryId: Id | undefined;
  finalTerritoryName: string | undefined;
  defeatedAt: Millis | undefined;
  formerCapital: Id | undefined;
  formerCapitalName: string | undefined;
  formerAlliances: DefeatedAllianceView[];
}

export interface DefeatedTerritoryView {
  territoryId: Id;
  territoryName: string;
  currentOwnerId: Id | undefined;
  currentOwnerName: string | undefined;
  conqueredFromId: Id;
  conqueredFromName: string;
}

function countryDisplayName(world: WorldState, countryId: Id): string {
  return findCountry(world, countryId)?.name ?? countryId;
}

function territoryDisplayName(world: WorldState, territoryId: Id | undefined): string | undefined {
  if (!territoryId) return undefined;
  return world.territories[territoryId]?.name ?? territoryId;
}

function buildDefeatedCountryView(world: WorldState, countryId: Id): DefeatedCountryView | null {
  const record = findCountry(world, countryId);
  if (!record?.defeated) return null;

  const leader = world.leaders[record.leaderId];
  const finalTerritoryId =
    record.lastLostTerritoryId ?? (record.capitalTerritoryId || undefined);
  const formerAllianceIds = record.formerAllianceIds ?? [];

  return {
    id: record.id,
    name: record.name ?? leader?.region ?? record.id,
    leaderId: record.leaderId,
    leaderName: leader?.name ?? record.leaderId,
    defeatedBy: record.lastConquerorId,
    defeatedByName: record.lastConquerorId
      ? countryDisplayName(world, record.lastConquerorId)
      : undefined,
    finalTerritoryId,
    finalTerritoryName: territoryDisplayName(world, finalTerritoryId),
    defeatedAt: record.defeatedAt,
    formerCapital: record.capitalTerritoryId || undefined,
    formerCapitalName: territoryDisplayName(world, record.capitalTerritoryId),
    formerAlliances: formerAllianceIds.map((allyId) => ({
      id: allyId,
      name: countryDisplayName(world, allyId),
    })),
  };
}

export function selectDefeatedCountries(world: WorldState | null): DefeatedCountryView[] {
  if (!world) return [];
  return selectCountries(world)
    .filter((country) => country.defeated)
    .map((country) => buildDefeatedCountryView(world, country.id))
    .filter((entry): entry is DefeatedCountryView => entry !== null)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function selectDefeatedCountryById(
  world: WorldState | null,
  id: Id,
): DefeatedCountryView | null {
  if (!world) return null;
  return buildDefeatedCountryView(world, id);
}

export function selectDefeatedWorldTerritories(world: WorldState | null): DefeatedTerritoryView[] {
  return selectDefeatedCountries(world)
    .map((country) => {
      const territoryId = country.finalTerritoryId;
      if (!territoryId) return null;
      const territory = world!.territories[territoryId];
      const currentOwnerId = territory?.ownerId;
      return {
        territoryId,
        territoryName: country.finalTerritoryName ?? territoryId,
        currentOwnerId,
        currentOwnerName: currentOwnerId
          ? countryDisplayName(world!, currentOwnerId)
          : undefined,
        conqueredFromId: country.id,
        conqueredFromName: country.name,
      } satisfies DefeatedTerritoryView;
    })
    .filter((entry): entry is DefeatedTerritoryView => entry !== null);
}

export function formatDefeatedLeaderLabel(leaderName: string): string {
  return `led by ${leaderName} (defeated)`;
}

export function formatDefeatedTerritoryLine(view: DefeatedTerritoryView): string {
  if (view.currentOwnerName && view.currentOwnerName !== view.conqueredFromName) {
    return `${view.territoryName} — ${view.currentOwnerName} (conquered from ${view.conqueredFromName})`;
  }
  return `${view.territoryName} — formerly ${view.conqueredFromName}`;
}

export function isCountryDefeatedNow(world: WorldState | null, countryId: Id): boolean {
  if (!world) return false;
  return Boolean(findCountry(world, countryId)?.defeated);
}

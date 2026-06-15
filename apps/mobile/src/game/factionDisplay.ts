import type { Id, WorldState } from 'sim';

export interface FactionIdentity {
  factionId: Id;
  leaderName: string;
  countryName: string;
  territoryNames: string[];
  /** "Caesar — Rome" */
  primaryLine: string;
  /** "Caesar of Rome" — compact mobile headline */
  compactLine: string;
  /** "Paris, Lyon, Marseille" */
  citiesLine: string;
}

export function territoriesOwnedByFaction(world: WorldState, factionId: Id): string[] {
  return Object.values(world.territories)
    .filter((territory) => territory.ownerId === factionId)
    .map((territory) => territory.name)
    .sort((a, b) => a.localeCompare(b));
}

export function getFactionIdentity(world: WorldState, factionId: Id): FactionIdentity {
  const faction = world.factions[factionId];
  const leader = faction ? world.leaders[faction.leaderId] : undefined;
  const leaderName = leader?.name ?? factionId;
  const countryName = leader?.region ?? 'Unknown';
  const territoryNames = territoriesOwnedByFaction(world, factionId);
  const citiesLine =
    territoryNames.length > 0 ? territoryNames.join(', ') : 'No holdings';

  return {
    factionId,
    leaderName,
    countryName,
    territoryNames,
    primaryLine: `${leaderName} — ${countryName}`,
    compactLine: `${leaderName} of ${countryName}`,
    citiesLine,
  };
}

/** Full display line when space allows: leader, country, and cities. */
export function formatFactionIdentityLine(identity: FactionIdentity): string {
  if (identity.territoryNames.length === 0) {
    return identity.primaryLine;
  }
  return `${identity.primaryLine} (${identity.citiesLine})`;
}

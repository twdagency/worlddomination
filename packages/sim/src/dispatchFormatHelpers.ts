import { findCountry } from './country';
import type { Id, Millis, WorldState } from './types';

export function isPlayerFaction(world: WorldState, factionId: Id): boolean {
  return world.factions[factionId]?.isPlayer === true;
}

export function factionName(world: WorldState, factionId: Id): string {
  const leaderId = world.factions[factionId]?.leaderId;
  return world.leaders[leaderId ?? '']?.name ?? factionId;
}

export function territoryName(world: WorldState, territoryId: Id): string {
  return world.territories[territoryId]?.name ?? territoryId;
}

/** Territory name with owning country (or unclaimed) for dispatch readability. */
export function territoryLabelWithOwner(world: WorldState, territoryId: Id): string {
  const name = territoryName(world, territoryId);
  const ownerId = world.territories[territoryId]?.ownerId;
  if (!ownerId) return `${name} (unclaimed)`;
  const country = findCountry(world, ownerId);
  if (country) return `${name} (${country.name})`;
  const leaderId = world.factions[ownerId]?.leaderId;
  const region = world.leaders[leaderId ?? '']?.region;
  if (region) return `${name} (${region})`;
  return name;
}

export function subject(world: WorldState, factionId: Id): string {
  return isPlayerFaction(world, factionId) ? 'Your' : factionName(world, factionId);
}

export function hoursUntil(expiresAt: Millis, at: Millis): number {
  return Math.max(1, Math.round((expiresAt - at) / 3_600_000));
}

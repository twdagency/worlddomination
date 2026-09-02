import { MS_PER_DAY } from './constants';
import { areAllied, getTreatiesBetween } from './diplomacy';
import { COMPETITOR_INFLUENCE_HALVE_THRESHOLD } from './influenceConstants';
import { haversineKm } from './geo';
import { isScoutUnit } from './scout';
import type {
  Id,
  InfluenceSource,
  InfluenceSourceKind,
  InfluenceState,
  InfluenceStore,
  Millis,
  WorldState,
} from './types';

export const INFLUENCE_CAP = 100;
export const INFLUENCE_FLOOR = -10;
export const INFLUENCE_DECAY_PER_DAY = 1;

/** Great-circle distance below which an owned city is "adjacent" to a target city. */
export const INFLUENCE_ADJACENCY_THRESHOLD_KM = 800;

const HOSTILE_PASSIVE_CAP_PER_DAY = 1;
const WAR_PASSIVE_PER_DAY = -2;

/** Trade routes are not implemented — source is reserved for Sprint 10. */
const TRADE_CONTRIBUTION_PER_DAY = 0;

export function ensureWorldTributes(world: WorldState): WorldState {
  if (world.activeTributes === undefined) {
    return { ...world, activeTributes: [] };
  }
  return world;
}

export function ensureWorldInfluence(world: WorldState): WorldState {
  let next = world;
  if (next.influence === undefined) {
    next = { ...next, influence: {} };
  }
  if (next.activeDiplomaticMissions === undefined) {
    next = { ...next, activeDiplomaticMissions: [] };
  }
  if (next.culturalCampaigns === undefined) {
    next = { ...next, culturalCampaigns: [] };
  }
  return ensureWorldTributes(next);
}

function hasActiveDiplomaticMission(
  world: WorldState,
  actorId: Id,
  cityId: Id,
  at: Millis,
): boolean {
  return (world.activeDiplomaticMissions ?? []).some(
    (mission) =>
      mission.ownerId === actorId &&
      mission.targetCityId === cityId &&
      at < mission.expiresAt,
  );
}

export function getInfluenceState(
  world: WorldState,
  cityId: Id,
  actorId: Id,
): InfluenceState | null {
  return world.influence?.[cityId]?.[actorId] ?? null;
}

export function getInfluence(world: WorldState, cityId: Id, actorId: Id): number {
  return getInfluenceState(world, cityId, actorId)?.value ?? 0;
}

export function getInfluenceSources(
  world: WorldState,
  cityId: Id,
  actorId: Id,
): InfluenceSource[] {
  return getInfluenceState(world, cityId, actorId)?.sources ?? [];
}

export function clearInfluenceForCity(world: WorldState, cityId: Id): WorldState {
  const store = world.influence;
  if (!store || !(cityId in store)) return world;
  const nextStore: InfluenceStore = { ...store };
  delete nextStore[cityId];
  return { ...world, influence: nextStore };
}

/**
 * Clears influence for cities associated with a defeated country.
 * Uses still-owned cities plus capital and last-lost territory (conqueror-held at defeat).
 */
export function clearInfluenceForCountry(world: WorldState, countryId: Id): WorldState {
  const country = world.countries?.[countryId];
  const cityIds = new Set<Id>();

  for (const territory of Object.values(world.territories)) {
    if (territory.ownerId === countryId) {
      cityIds.add(territory.id);
    }
  }

  if (country?.capitalTerritoryId) {
    cityIds.add(country.capitalTerritoryId);
  }
  if (country?.lastLostTerritoryId) {
    cityIds.add(country.lastLostTerritoryId);
  }

  let next = world;
  for (const cityId of cityIds) {
    next = clearInfluenceForCity(next, cityId);
  }
  return next;
}

function clampInfluence(value: number): number {
  return Math.max(INFLUENCE_FLOOR, Math.min(INFLUENCE_CAP, value));
}

function emptyInfluenceState(at: Millis): InfluenceState {
  return {
    value: 0,
    lastAccrualAt: at,
    lastDecayAt: at,
    sources: [],
  };
}

export function setInfluence(
  world: WorldState,
  cityId: Id,
  actorId: Id,
  value: number,
  at: Millis,
): WorldState {
  const store = { ...(world.influence ?? {}) };
  const cityRow = { ...(store[cityId] ?? {}) };
  const prior = cityRow[actorId] ?? emptyInfluenceState(at);
  cityRow[actorId] = {
    ...prior,
    value: clampInfluence(value),
    lastAccrualAt: at,
  };
  store[cityId] = cityRow;
  return { ...world, influence: store };
}

export function applyInfluenceDelta(
  world: WorldState,
  cityId: Id,
  actorId: Id,
  delta: number,
  at: Millis,
): WorldState {
  const current = getInfluence(world, cityId, actorId);
  return setInfluence(world, cityId, actorId, current + delta, at);
}

function leaderForFaction(world: WorldState, factionId: Id) {
  const faction = world.factions[factionId];
  if (!faction) return undefined;
  return world.leaders[faction.leaderId];
}

function hasActiveTreatyOnCity(
  world: WorldState,
  factionA: Id,
  factionB: Id,
  cityId: Id,
  at: Millis,
): boolean {
  return getTreatiesBetween(world, factionA, factionB).some(
    (treaty) => at < treaty.expiresAt && treaty.scope.territoryIds.includes(cityId),
  );
}

function hasActiveTreatyBetween(
  world: WorldState,
  factionA: Id,
  factionB: Id,
  at: Millis,
): boolean {
  return getTreatiesBetween(world, factionA, factionB).some((treaty) => at < treaty.expiresAt);
}

function actorOwnsCityAdjacentTo(
  world: WorldState,
  actorId: Id,
  targetCityId: Id,
): boolean {
  const target = world.territories[targetCityId];
  if (!target) return false;

  for (const territory of Object.values(world.territories)) {
    if (territory.ownerId !== actorId) continue;
    if (territory.id === targetCityId) continue;
    if (haversineKm(territory.coord, target.coord) <= INFLUENCE_ADJACENCY_THRESHOLD_KM) {
      return true;
    }
  }
  return false;
}

function sharesCulture(world: WorldState, actorId: Id, ownerId: Id): boolean {
  const actorLeader = leaderForFaction(world, actorId);
  const ownerLeader = leaderForFaction(world, ownerId);
  if (!actorLeader || !ownerLeader) return false;
  return actorLeader.era === ownerLeader.era && actorLeader.region === ownerLeader.region;
}

function hasRecentScoutPresence(
  world: WorldState,
  actorId: Id,
  cityId: Id,
  at: Millis,
): boolean {
  for (const unit of Object.values(world.units)) {
    if (unit.ownerId !== actorId) continue;
    if (!isScoutUnit(world, unit)) continue;
    if (unit.locationId === cityId) return true;
    if (unit.transit?.toTerritoryId === cityId) return true;
  }

  const records = world.intel[actorId] ?? [];
  return records.some(
    (record) =>
      record.territoryId === cityId &&
      record.source === 'scout' &&
      at - record.observationTime <= MS_PER_DAY,
  );
}

function hasActiveAssaultAgainstCountry(
  world: WorldState,
  actorId: Id,
  targetOwnerId: Id,
): boolean {
  for (const unit of Object.values(world.units)) {
    if (unit.ownerId !== actorId) continue;
    if (unit.transit?.stanceOnArrival !== 'assault') continue;
    const destinationId = unit.transit.toTerritoryId;
    if (!destinationId) continue;
    const destinationOwner = world.territories[destinationId]?.ownerId;
    if (destinationOwner === targetOwnerId) return true;
  }
  return false;
}

function isHostileToOwner(
  world: WorldState,
  actorId: Id,
  ownerId: Id,
  at: Millis,
): boolean {
  if (areAllied(world, actorId, ownerId)) return false;
  if (hasActiveTreatyBetween(world, actorId, ownerId, at)) return false;
  return true;
}

function maxCompetitorInfluence(
  world: WorldState,
  cityId: Id,
  actorId: Id,
): number {
  const row = world.influence?.[cityId];
  if (!row) return 0;

  let max = 0;
  for (const [otherActorId, state] of Object.entries(row)) {
    if (otherActorId === actorId) continue;
    if (state.value > max) max = state.value;
  }
  return max;
}

function withContribution(
  kind: InfluenceSourceKind,
  contribution: number,
  at: Millis,
): InfluenceSource {
  return { kind, contribution, lastAccrualAt: at };
}

export function computePassiveInfluenceSources(
  world: WorldState,
  cityId: Id,
  actorId: Id,
  at: Millis = world.nowMs,
): InfluenceSource[] {
  const city = world.territories[cityId];
  const ownerId = city?.ownerId;
  if (!city || !ownerId) return [];
  if (actorId === ownerId) return [];
  if (world.countries?.[ownerId]?.defeated) return [];

  if (hasActiveAssaultAgainstCountry(world, actorId, ownerId)) {
    return [withContribution('proximity', WAR_PASSIVE_PER_DAY, at)];
  }

  const sources: InfluenceSource[] = [];

  if (actorOwnsCityAdjacentTo(world, actorId, cityId)) {
    sources.push(withContribution('proximity', 1, at));
  }
  if (areAllied(world, actorId, ownerId)) {
    sources.push(withContribution('alliance', 2, at));
  }
  if (hasActiveTreatyOnCity(world, actorId, ownerId, cityId, at)) {
    sources.push(withContribution('treaty', 1, at));
  }
  if (TRADE_CONTRIBUTION_PER_DAY > 0) {
    sources.push(withContribution('trade', TRADE_CONTRIBUTION_PER_DAY, at));
  }
  if (sharesCulture(world, actorId, ownerId)) {
    sources.push(withContribution('culture', 1, at));
  }
  if (hasRecentScoutPresence(world, actorId, cityId, at)) {
    sources.push(withContribution('scout-presence', 1, at));
  }

  const competitorMax = maxCompetitorInfluence(world, cityId, actorId);
  const halve = competitorMax >= COMPETITOR_INFLUENCE_HALVE_THRESHOLD;

  let adjusted = sources.map((source) =>
    halve
      ? { ...source, contribution: source.contribution / 2 }
      : source,
  );

  if (isHostileToOwner(world, actorId, ownerId, at)) {
    const positiveTotal = adjusted
      .filter((source) => source.contribution > 0)
      .reduce((sum, source) => sum + source.contribution, 0);

    if (positiveTotal > HOSTILE_PASSIVE_CAP_PER_DAY) {
      const scale = HOSTILE_PASSIVE_CAP_PER_DAY / positiveTotal;
      adjusted = adjusted.map((source) =>
        source.contribution > 0
          ? { ...source, contribution: source.contribution * scale }
          : source,
      );
    }
  }

  return adjusted;
}

function ratePerDayFromSources(sources: InfluenceSource[]): number {
  return sources.reduce((sum, source) => sum + source.contribution, 0);
}

/** Per-day decay magnitude toward 0 when no passive source or active mission maintains the relationship. */
export function computeInfluenceDecay(
  world: WorldState,
  cityId: Id,
  actorId: Id,
  at: Millis = world.nowMs,
): number {
  const sources = computePassiveInfluenceSources(world, cityId, actorId, at);
  const hasActiveMission = hasActiveDiplomaticMission(world, actorId, cityId, at);
  const hasActiveSource = sources.some((source) => source.contribution !== 0) || hasActiveMission;

  if (hasActiveSource) return 0;

  const value = getInfluence(world, cityId, actorId);
  if (value === 0) return 0;

  return INFLUENCE_DECAY_PER_DAY;
}

function shouldAccruePair(
  world: WorldState,
  cityId: Id,
  actorId: Id,
  at: Millis,
): boolean {
  if (getInfluenceState(world, cityId, actorId)) return true;
  return computePassiveInfluenceSources(world, cityId, actorId, at).length > 0;
}

export function accruePassiveInfluence(world: WorldState, at: Millis = world.nowMs): WorldState {
  const base = ensureWorldInfluence(world);
  let next = base;
  const factionIds = Object.keys(base.factions).sort();
  const cityIds = Object.keys(base.territories).sort();

  for (const cityId of cityIds) {
    for (const actorId of factionIds) {
      if (!shouldAccruePair(next, cityId, actorId, at)) continue;

      const prior = getInfluenceState(next, cityId, actorId);
      const lastAccrualAt = prior?.lastAccrualAt ?? next.startMs;
      const elapsedMs = Math.max(0, at - lastAccrualAt);
      if (elapsedMs === 0 && prior) continue;

      const sources = computePassiveInfluenceSources(next, cityId, actorId, at);
      const ratePerDay = ratePerDayFromSources(sources);
      const missionActive = hasActiveDiplomaticMission(next, actorId, cityId, at);
      const daysElapsed = elapsedMs / MS_PER_DAY;
      const priorValue = prior?.value ?? 0;

      let delta = 0;
      if (ratePerDay !== 0 || missionActive) {
        let effectiveRate = ratePerDay;
        if (missionActive) {
          effectiveRate *= 2;
        }
        delta = effectiveRate * daysElapsed;
      } else if (priorValue > 0) {
        delta = -Math.min(priorValue, INFLUENCE_DECAY_PER_DAY * daysElapsed);
      } else if (priorValue < 0) {
        delta = Math.min(-priorValue, INFLUENCE_DECAY_PER_DAY * daysElapsed);
      }

      const store = { ...(next.influence ?? {}) };
      const cityRow = { ...(store[cityId] ?? {}) };
      cityRow[actorId] = {
        value: clampInfluence(priorValue + delta),
        lastAccrualAt: at,
        lastDecayAt:
          delta < 0 || (priorValue < 0 && delta > 0) ? at : (prior?.lastDecayAt ?? at),
        sources,
      };
      store[cityId] = cityRow;
      next = { ...next, influence: store };
    }
  }

  return next;
}

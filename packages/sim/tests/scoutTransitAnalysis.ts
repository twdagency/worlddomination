import { haversineKm } from '../src/geo';
import { INTEL_DECAY_WINDOW_MS, SCOUT_UNIT_TYPE_ID } from '../src';
import type { Id, SimEvent, WorldState } from '../src/types';

export interface ScoutTransitReport {
  unitId: Id;
  fromTerritoryId: Id;
  toTerritoryId: Id;
  distanceKm: number;
  transitMs: number;
  transitHours: number;
  /** True when travel time exceeds the intel decay window — observation may be stale on arrival. */
  exceedsDecayWindow: boolean;
}

/** Pair scout departure/arrival events and flag transit times vs intel decay. */
export function analyzeFactionScoutTransits(
  world: WorldState,
  events: SimEvent[],
  factionId: Id,
): ScoutTransitReport[] {
  const departures = events.filter(
    (event): event is Extract<SimEvent, { kind: 'departure' }> =>
      event.kind === 'departure' &&
      event.ownerId === factionId &&
      event.unitTypeId === SCOUT_UNIT_TYPE_ID,
  );

  const reports: ScoutTransitReport[] = [];

  for (const departure of departures) {
    const arrival = events.find(
      (event): event is Extract<SimEvent, { kind: 'arrival' }> =>
        event.kind === 'arrival' && event.unitId === departure.unitId && event.at >= departure.at,
    );

    const from = world.territories[departure.fromTerritoryId];
    const to = world.territories[departure.toTerritoryId];
    const distanceKm = from && to ? haversineKm(from.coord, to.coord) : 0;
    const transitMs = arrival ? arrival.at - departure.at : 0;

    reports.push({
      unitId: departure.unitId,
      fromTerritoryId: departure.fromTerritoryId,
      toTerritoryId: departure.toTerritoryId,
      distanceKm: Math.round(distanceKm),
      transitMs,
      transitHours: transitMs / 3_600_000,
      exceedsDecayWindow: transitMs > INTEL_DECAY_WINDOW_MS,
    });
  }

  return reports;
}

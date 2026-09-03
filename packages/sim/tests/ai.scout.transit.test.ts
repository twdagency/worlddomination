import { describe, it, expect } from 'vitest';
import {
  advanceTo,
  decideOrders,
  INTEL_DECAY_WINDOW_MS,
  SCOUT_UNIT_TYPE_ID,
  transitAwareIntelMultiplier,
} from '../src';
import { estimateTravelMs } from '../src/movement';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import type { Territory, WorldState } from '../src/types';

const START_MS = 1_700_900_000_000;
const STEPPE = 'faction-steppe';
const BERLIN = 'territory-berlin';
const SEVENTY_TWO_HOURS_MS = 72 * 3_600_000;

const NEAR_HOSTILE: Territory = {
  id: 'territory-near-hostile',
  name: 'Near Hostile',
  coord: { lat: 52.58, lon: 13.42 },
  ownerId: 'faction-rome',
  baseYield: 50,
  infraLevel: 1,
  resources: {},
};

function genghisScoutAtBerlin(): WorldState {
  const base = createSprint4World(START_MS);
  return {
    ...base,
    units: {
      ...Object.fromEntries(
        Object.entries(base.units).filter(([, unit]) => unit.ownerId !== STEPPE),
      ),
      'unit-steppe-scout': {
        id: 'unit-steppe-scout',
        typeId: SCOUT_UNIT_TYPE_ID,
        ownerId: STEPPE,
        count: 1,
        locationId: BERLIN,
        stance: 'hold',
      },
    },
    intel: {},
  };
}

function genghisScoutWithNearHostile(): WorldState {
  const base = genghisScoutAtBerlin();
  return {
    ...base,
    territories: {
      ...base.territories,
      [NEAR_HOSTILE.id]: NEAR_HOSTILE,
    },
  };
}

describe('transit-aware scout scoring', () => {
  it('transit time at or beyond decay window yields multiplier 0', () => {
    expect(transitAwareIntelMultiplier(INTEL_DECAY_WINDOW_MS)).toBe(0);
    expect(transitAwareIntelMultiplier(INTEL_DECAY_WINDOW_MS + 1)).toBe(0);
  });

  it('closer targets receive a higher multiplier than equally-valuable distant targets', () => {
    const nearMs = INTEL_DECAY_WINDOW_MS * 0.25;
    const farMs = INTEL_DECAY_WINDOW_MS * 0.75;
    expect(transitAwareIntelMultiplier(nearMs)).toBeGreaterThan(transitAwareIntelMultiplier(farMs));
  });

  it('disqualifies sprint4 capitals from Berlin — all exceed decay window', () => {
    const world = genghisScoutAtBerlin();
    const scout = world.units['unit-steppe-scout']!;
    const capitals = ['territory-london', 'territory-paris', 'territory-madrid'];

    for (const territoryId of capitals) {
      const travelMs = estimateTravelMs(world, scout, territoryId);
      expect(travelMs).not.toBeNull();
      expect(travelMs!).toBeGreaterThan(INTEL_DECAY_WINDOW_MS);
      expect(transitAwareIntelMultiplier(travelMs!)).toBe(0);
    }
  });

  it('chooses a reachable near hostile target over stale-on-arrival capitals', () => {
    const world = genghisScoutWithNearHostile();
    const scout = world.units['unit-steppe-scout']!;
    const nearTravelMs = estimateTravelMs(world, scout, NEAR_HOSTILE.id)!;

    expect(nearTravelMs).toBeLessThan(INTEL_DECAY_WINDOW_MS);
    expect(transitAwareIntelMultiplier(nearTravelMs)).toBeGreaterThan(0);

    const orders = decideOrders(world, STEPPE, world.nowMs);
    const move = orders.find((order) => order.kind === 'move');
    expect(move?.kind).toBe('move');
    if (move?.kind === 'move') {
      expect(move.toTerritoryId).toBe(NEAR_HOSTILE.id);
      expect(move.toTerritoryId).not.toBe('territory-madrid');
    }
  });

  it('scout decisions are deterministic across repeated reads', () => {
    const world = genghisScoutWithNearHostile();
    const first = decideOrders(world, STEPPE, world.nowMs);
    const second = decideOrders(world, STEPPE, world.nowMs);
    expect(second).toEqual(first);
  });

  it('72h cold-play #2 records post-transit observation for attribution', () => {
    const { events, world } = advanceTo(createSprint4World(START_MS), START_MS + SEVENTY_TWO_HOURS_MS);

    const observation = {
      alliances: world.alliances,
      scoutBuilds: events.filter(
        (event) =>
          event.kind === 'buildStarted' &&
          event.countryId === STEPPE &&
          event.unitTypeId === SCOUT_UNIT_TYPE_ID,
      ).length,
      scoutMoves: events.filter(
        (event) =>
          event.kind === 'departure' &&
          event.ownerId === STEPPE &&
          event.unitTypeId === SCOUT_UNIT_TYPE_ID,
      ).length,
      genghisOrdersAtEnd: decideOrders(world, STEPPE, world.nowMs).map((order) => order.kind),
    };

    expect(observation).toMatchSnapshot('sprint6-4c-cold-play-72h-observation');

    const baseline = {
      alliances: [{ factionA: 'faction-britain', factionB: 'faction-steppe', formedAt: 1_700_921_600_000 }],
      scoutBuilds: 0,
      scoutMoves: 0,
    };

    expect({
      alliancesFormed: observation.alliances.length > 0,
      britainGenghisAllied: observation.alliances.some(
        (pair) =>
          (pair.factionA === 'faction-britain' && pair.factionB === STEPPE) ||
          (pair.factionA === STEPPE && pair.factionB === 'faction-britain'),
      ),
      scoutBuildDelta: observation.scoutBuilds - baseline.scoutBuilds,
      scoutMoveDelta: observation.scoutMoves - baseline.scoutMoves,
    }).toMatchSnapshot('sprint6-cold-play-attribution');
  });
});

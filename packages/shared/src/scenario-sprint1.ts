import type { WorldState } from 'sim';
import { diplomacyDefaults } from 'sim';
import { LEADERS_BY_ID } from './leaders';
import { UNIT_TYPES_BY_ID } from './units';

export const SPRINT1_TERRITORIES = {
  'territory-london': {
    id: 'territory-london',
    name: 'London',
    coord: { lat: 51.5074, lon: -0.1278 },
    ownerId: 'faction-player',
    baseYield: 120,
    infraLevel: 2,
    resources: { steel: 50, food: 30 },
  },
  'territory-new-york': {
    id: 'territory-new-york',
    name: 'New York',
    coord: { lat: 40.7128, lon: -74.006 },
    ownerId: undefined,
    baseYield: 100,
    infraLevel: 2,
    resources: {},
  },
  'territory-paris': {
    id: 'territory-paris',
    name: 'Paris',
    coord: { lat: 48.8566, lon: 2.3522 },
    ownerId: undefined,
    baseYield: 90,
    infraLevel: 1,
    resources: {},
  },
  'territory-berlin': {
    id: 'territory-berlin',
    name: 'Berlin',
    coord: { lat: 52.52, lon: 13.405 },
    ownerId: undefined,
    baseYield: 85,
    infraLevel: 1,
    resources: {},
  },
} as const;

export function createSprint1World(nowMs: number = Date.now()): WorldState {
  const factions = {
    'faction-player': {
      id: 'faction-player',
      leaderId: 'leader-genghis',
      isPlayer: true,
      funding: 25_000,
      manpower: 8_000,
      manpowerCap: 15_000,
      resources: { fuel: 200, steel: 150 },
    },
  };

  return {
    nowMs,
    day: 1,
    startMs: nowMs,
    rng: { seed: 1337 },
    territories: { ...SPRINT1_TERRITORIES },
    units: {
      'unit-armor-1': {
        id: 'unit-armor-1',
        typeId: 'mg-armor-t5',
        ownerId: 'faction-player',
        count: 1,
        locationId: 'territory-london',
        stance: 'defend',
      },
      'unit-infantry-1': {
        id: 'unit-infantry-1',
        typeId: 'infantry-t2',
        ownerId: 'faction-player',
        count: 3,
        locationId: 'territory-london',
        stance: 'hold',
      },
    },
    factions,
    leaders: { ...LEADERS_BY_ID },
    unitTypes: { ...UNIT_TYPES_BY_ID },
    intel: {},
    ...diplomacyDefaults(factions),
    scenarioId: 'sprint-1-demo',
    nextEventId: 0,
  };
}

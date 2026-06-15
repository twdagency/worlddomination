import type { WorldState } from 'sim';
import { LEADERS_BY_ID } from './leaders';
import { UNIT_TYPES_BY_ID } from './units';

export const SPRINT2_TERRITORIES = {
  'territory-london': {
    id: 'territory-london',
    name: 'London',
    coord: { lat: 51.5074, lon: -0.1278 },
    ownerId: 'faction-player',
    baseYield: 120,
    infraLevel: 2,
    resources: { steel: 50, food: 30 },
  },
  'territory-paris': {
    id: 'territory-paris',
    name: 'Paris',
    coord: { lat: 48.8566, lon: 2.3522 },
    ownerId: 'faction-enemy',
    baseYield: 90,
    infraLevel: 1,
    resources: {},
  },
  'territory-berlin': {
    id: 'territory-berlin',
    name: 'Berlin',
    coord: { lat: 52.52, lon: 13.405 },
    ownerId: 'faction-enemy',
    baseYield: 85,
    infraLevel: 1,
    resources: {},
  },
  'territory-madrid': {
    id: 'territory-madrid',
    name: 'Madrid',
    coord: { lat: 40.4168, lon: -3.7038 },
    ownerId: 'faction-enemy',
    baseYield: 80,
    infraLevel: 1,
    resources: {},
  },
} as const;

/** Sprint 2 demo: assault Paris garrisoned by 200 levies with 10 MG+Armor. */
export function createSprint2World(nowMs: number = Date.now()): WorldState {
  return {
    nowMs,
    day: 1,
    startMs: nowMs,
    rng: { seed: 2026 },
    territories: { ...SPRINT2_TERRITORIES },
    units: {
      'unit-mg-1': {
        id: 'unit-mg-1',
        typeId: 'mg-armor-t5',
        ownerId: 'faction-player',
        count: 10,
        locationId: 'territory-london',
        stance: 'defend',
      },
      'unit-levy-garrison': {
        id: 'unit-levy-garrison',
        typeId: 'levy-t1',
        ownerId: 'faction-enemy',
        count: 200,
        locationId: 'territory-paris',
        stance: 'retreat-if-outnumbered',
      },
      'unit-levy-berlin': {
        id: 'unit-levy-berlin',
        typeId: 'levy-t1',
        ownerId: 'faction-enemy',
        count: 50,
        locationId: 'territory-berlin',
        stance: 'defend',
      },
      'unit-levy-madrid': {
        id: 'unit-levy-madrid',
        typeId: 'levy-t1',
        ownerId: 'faction-enemy',
        count: 80,
        locationId: 'territory-madrid',
        stance: 'defend',
      },
    },
    factions: {
      'faction-player': {
        id: 'faction-player',
        leaderId: 'leader-genghis',
        isPlayer: true,
        funding: 25_000,
        manpower: 8_000,
        manpowerCap: 15_000,
      },
      'faction-enemy': {
        id: 'faction-enemy',
        leaderId: 'leader-caesar',
        isPlayer: false,
        funding: 20_000,
        manpower: 10_000,
        manpowerCap: 20_000,
      },
    },
    leaders: { ...LEADERS_BY_ID },
    unitTypes: { ...UNIT_TYPES_BY_ID },
    intel: {},
    scenarioId: 'sprint-2-combat-demo',
  };
}

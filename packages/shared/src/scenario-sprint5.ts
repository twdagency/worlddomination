import type { WorldState } from 'sim';
import { diplomacyDefaults } from 'sim';
import { LEADERS_BY_ID } from './leaders';
import { UNIT_TYPES_BY_ID } from './units';

// SPRINT-6+: scenarios may declare starting alliances. Sprint 6 ships with no pre-formed alliances.

/**
 * Balkan tri-border layout — distinct from Sprint 4's Western Europe geometry.
 * Player at Belgrade sees nearby Bucharest/Sofia; coastal Istanbul stays fogged.
 */
export const SPRINT5_TERRITORIES = {
  'territory-belgrade': {
    id: 'territory-belgrade',
    name: 'Belgrade',
    coord: { lat: 44.7866, lon: 20.4489 },
    ownerId: 'faction-player',
    baseYield: 120,
    infraLevel: 2,
    extraction: { fuel: 12, steel: 8 },
    resources: { steel: 80, food: 40, fuel: 20 },
  },
  'territory-bucharest': {
    id: 'territory-bucharest',
    name: 'Bucharest',
    coord: { lat: 44.4268, lon: 26.1025 },
    ownerId: 'faction-rome',
    baseYield: 95,
    infraLevel: 1,
    extraction: { rareMetals: 6, fuel: 5, steel: 6 },
    resources: { steel: 40 },
  },
  'territory-sofia': {
    id: 'territory-sofia',
    name: 'Sofia',
    coord: { lat: 42.6977, lon: 23.3219 },
    ownerId: 'faction-steppe',
    baseYield: 85,
    infraLevel: 1,
    extraction: { steel: 10, fuel: 4 },
    resources: { fuel: 30 },
  },
  'territory-istanbul': {
    id: 'territory-istanbul',
    name: 'Istanbul',
    coord: { lat: 41.0082, lon: 28.9784 },
    ownerId: 'faction-britain',
    baseYield: 90,
    infraLevel: 1,
    extraction: { food: 15, fuel: 3 },
    resources: { food: 20 },
  },
} as const;

/** Sprint 5 legibility demo: tri-border Balkans, same leaders as Sprint 4. */
export function createSprint5World(nowMs: number = Date.now()): WorldState {
  const factions = {
    'faction-player': {
      id: 'faction-player',
      leaderId: 'leader-elizabeth',
      isPlayer: true,
      funding: 25_000,
      manpower: 8_000,
      manpowerCap: 15_000,
    },
    'faction-rome': {
      id: 'faction-rome',
      leaderId: 'leader-caesar',
      isPlayer: false,
      funding: 22_000,
      manpower: 9_000,
      manpowerCap: 18_000,
    },
    'faction-steppe': {
      id: 'faction-steppe',
      leaderId: 'leader-genghis',
      isPlayer: false,
      funding: 20_000,
      manpower: 7_000,
      manpowerCap: 16_000,
    },
    'faction-britain': {
      id: 'faction-britain',
      leaderId: 'leader-suleiman',
      isPlayer: false,
      funding: 24_000,
      manpower: 8_500,
      manpowerCap: 17_000,
    },
  };

  return {
    nowMs,
    day: 1,
    startMs: nowMs,
    rng: { seed: 5050 },
    territories: { ...SPRINT5_TERRITORIES },
    units: {
      'unit-player-mg': {
        id: 'unit-player-mg',
        typeId: 'mg-armor-t5',
        ownerId: 'faction-player',
        count: 10,
        locationId: 'territory-belgrade',
        stance: 'defend',
      },
      'unit-rome-levy': {
        id: 'unit-rome-levy',
        typeId: 'levy-t1',
        ownerId: 'faction-rome',
        count: 120,
        locationId: 'territory-bucharest',
        stance: 'retreat-if-outnumbered',
      },
      'unit-steppe-mg': {
        id: 'unit-steppe-mg',
        typeId: 'mg-armor-t5',
        ownerId: 'faction-steppe',
        count: 8,
        locationId: 'territory-sofia',
        stance: 'defend',
      },
      'unit-britain-infantry': {
        id: 'unit-britain-infantry',
        typeId: 'infantry-t2',
        ownerId: 'faction-britain',
        count: 40,
        locationId: 'territory-istanbul',
        stance: 'defend',
      },
    },
    factions,
    leaders: { ...LEADERS_BY_ID },
    unitTypes: { ...UNIT_TYPES_BY_ID },
    intel: {},
    ...diplomacyDefaults(factions),
    scenarioId: 'sprint-5-legibility-demo',
  };
}

import type { WorldState } from 'sim';
import {
  createInitialTutorialState,
  diplomacyDefaults,
  PLAYER_TUTORIAL_FACTION_ID,
  TUTORIAL_ACTIVE_TIME_MULTIPLIER,
  TUTORIAL_HOME_TERRITORY_ID,
} from 'sim';
import { LEADERS_BY_ID } from './leaders';
import { UNIT_TYPES_BY_ID } from './units';

/**
 * Tutorial map uses compressed Channel-adjacent coords so levy marches land in
 * ~4–8 game-hours at 5 km/h (Beat 1 pacing at 30× wall-clock).
 */
export const TUTORIAL_TERRITORIES = {
  'territory-london-tutorial': {
    id: 'territory-london-tutorial',
    name: 'London',
    coord: { lat: 51.5, lon: 0.0 },
    ownerId: PLAYER_TUTORIAL_FACTION_ID,
    baseYield: 90,
    infraLevel: 1,
    extraction: { food: 4, steel: 4 },
    resources: { food: 15 },
  },
  'territory-paris-tutorial': {
    id: 'territory-paris-tutorial',
    name: 'Paris',
    coord: { lat: 51.48, lon: 0.39 },
    ownerId: 'faction-france-tutorial',
    baseYield: 70,
    infraLevel: 1,
    extraction: { food: 3 },
    resources: { food: 10 },
  },
  'territory-burgundy-tutorial': {
    id: 'territory-burgundy-tutorial',
    name: 'Burgundy',
    coord: { lat: 51.2, lon: 0.82 },
    ownerId: 'faction-burgundy-tutorial',
    baseYield: 85,
    infraLevel: 2,
    extraction: { food: 22, steel: 6 },
    resources: { food: 120, steel: 25 },
  },
  'territory-calais-tutorial': {
    id: 'territory-calais-tutorial',
    name: 'Calais',
    coord: { lat: 51.38, lon: 0.25 },
    ownerId: 'faction-burgundy-tutorial',
    baseYield: 75,
    infraLevel: 1,
    extraction: { food: 10 },
    resources: { food: 45 },
  },
} as const;

/** Tutorial: 4-city Europe subset with food pinch and two AI paths (conquest vs treaty). */
export function createTutorialWorld(nowMs: number = Date.now()): WorldState {
  const factions = {
    [PLAYER_TUTORIAL_FACTION_ID]: {
      id: PLAYER_TUTORIAL_FACTION_ID,
      leaderId: 'leader-elizabeth',
      isPlayer: true,
      funding: 8_000,
      manpower: 100,
      manpowerCap: 300,
    },
    'faction-france-tutorial': {
      id: 'faction-france-tutorial',
      leaderId: 'leader-henry-iv',
      isPlayer: false,
      funding: 800,
      manpower: 400,
      manpowerCap: 1_000,
    },
    'faction-burgundy-tutorial': {
      id: 'faction-burgundy-tutorial',
      leaderId: 'leader-charles-bold',
      isPlayer: false,
      funding: 1_200,
      manpower: 600,
      manpowerCap: 1_500,
    },
  };

  return {
    nowMs,
    day: 1,
    startMs: nowMs,
    rng: { seed: 7_026 },
    territories: { ...TUTORIAL_TERRITORIES },
    units: {
      'unit-britain-infantry': {
        id: 'unit-britain-infantry',
        typeId: 'levy-t1',
        ownerId: PLAYER_TUTORIAL_FACTION_ID,
        count: 1,
        locationId: TUTORIAL_HOME_TERRITORY_ID,
        stance: 'defend',
      },
      'unit-france-levy': {
        id: 'unit-france-levy',
        typeId: 'levy-t1',
        ownerId: 'faction-france-tutorial',
        count: 1,
        locationId: 'territory-paris-tutorial',
        stance: 'defend',
      },
      'unit-burgundy-levy-1': {
        id: 'unit-burgundy-levy-1',
        typeId: 'levy-t1',
        ownerId: 'faction-burgundy-tutorial',
        count: 1,
        locationId: 'territory-burgundy-tutorial',
        stance: 'retreat-if-outnumbered',
      },
    },
    factions,
    leaders: {
      'leader-elizabeth': LEADERS_BY_ID['leader-elizabeth'],
      'leader-henry-iv': LEADERS_BY_ID['leader-henry-iv'],
      'leader-charles-bold': LEADERS_BY_ID['leader-charles-bold'],
    },
    unitTypes: { ...UNIT_TYPES_BY_ID },
    intel: {},
    pendingDilemmas: [],
    ...diplomacyDefaults(factions),
    scenarioId: 'tutorial',
    tutorial: createInitialTutorialState(0),
    timeMultiplier: TUTORIAL_ACTIVE_TIME_MULTIPLIER,
  };
}

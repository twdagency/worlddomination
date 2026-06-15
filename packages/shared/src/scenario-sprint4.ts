import { createSprint3World, SPRINT3_TERRITORY_OVERRIDES } from './scenario-sprint3';
import type { WorldState } from 'sim';
import { diplomacyDefaults } from 'sim';
import { LEADERS_BY_ID } from './leaders';
import { UNIT_TYPES_BY_ID } from './units';

// SPRINT-6+: scenarios may declare starting alliances. Sprint 6 ships with no pre-formed alliances.

const SPRINT4_TERRITORIES = {
  'territory-london': {
    ...SPRINT3_TERRITORY_OVERRIDES['territory-london'],
    ownerId: 'faction-player',
  },
  'territory-paris': {
    ...SPRINT3_TERRITORY_OVERRIDES['territory-paris'],
    ownerId: 'faction-rome',
    extraction: { rareMetals: 6, fuel: 5, steel: 6 },
    resources: { steel: 40 },
  },
  'territory-berlin': {
    ...SPRINT3_TERRITORY_OVERRIDES['territory-berlin'],
    ownerId: 'faction-steppe',
    extraction: { steel: 10, fuel: 4 },
    resources: { fuel: 30 },
  },
  'territory-madrid': {
    ...SPRINT3_TERRITORY_OVERRIDES['territory-madrid'],
    ownerId: 'faction-britain',
    extraction: { food: 15, fuel: 3 },
    resources: { food: 20 },
  },
} as const;

/** Sprint 4: player + Caesar / Genghis / Elizabeth AI with distinct personalities. */
export function createSprint4World(nowMs: number = Date.now()): WorldState {
  const base = createSprint3World(nowMs);
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
      leaderId: 'leader-elizabeth',
      isPlayer: false,
      funding: 24_000,
      manpower: 8_500,
      manpowerCap: 17_000,
    },
  };

  return {
    ...base,
    territories: { ...SPRINT4_TERRITORIES },
    units: {
      'unit-player-mg': {
        id: 'unit-player-mg',
        typeId: 'mg-armor-t5',
        ownerId: 'faction-player',
        count: 10,
        locationId: 'territory-london',
        stance: 'defend',
      },
      'unit-rome-levy': {
        id: 'unit-rome-levy',
        typeId: 'levy-t1',
        ownerId: 'faction-rome',
        count: 120,
        locationId: 'territory-paris',
        stance: 'retreat-if-outnumbered',
      },
      'unit-steppe-mg': {
        id: 'unit-steppe-mg',
        typeId: 'mg-armor-t5',
        ownerId: 'faction-steppe',
        count: 8,
        locationId: 'territory-berlin',
        stance: 'defend',
      },
      'unit-britain-infantry': {
        id: 'unit-britain-infantry',
        typeId: 'infantry-t2',
        ownerId: 'faction-britain',
        count: 40,
        locationId: 'territory-madrid',
        stance: 'defend',
      },
    },
    factions,
    leaders: { ...LEADERS_BY_ID },
    unitTypes: { ...UNIT_TYPES_BY_ID },
    intel: {},
    ...diplomacyDefaults(factions),
    scenarioId: 'sprint-4-ai-world',
  };
}

export { SPRINT4_TERRITORIES };

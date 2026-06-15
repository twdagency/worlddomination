import type { Faction, Leader, Territory, Unit, UnitType, WorldState } from '../src/types';

export const COMBAT_UNIT_TYPES: Record<string, UnitType> = {
  'levy-t1': {
    id: 'levy-t1',
    name: 'Levy',
    tier: 1,
    domain: 'land',
    role: 'infantry',
    combatValue: 5,
    baseSpeedKmh: 5,
    fundingCost: 100,
    manpowerCost: 200,
    buildHours: 12,
    billOfMaterials: { food: 10 },
  },
  'infantry-t2': {
    id: 'infantry-t2',
    name: 'Infantry',
    tier: 2,
    domain: 'land',
    role: 'infantry',
    combatValue: 10,
    baseSpeedKmh: 5,
    fundingCost: 500,
    manpowerCost: 400,
    buildHours: 24,
    billOfMaterials: { steel: 20 },
  },
  'riflemen-t3': {
    id: 'riflemen-t3',
    name: 'Riflemen',
    tier: 3,
    domain: 'land',
    role: 'infantry',
    combatValue: 25,
    baseSpeedKmh: 6,
    fundingCost: 2000,
    manpowerCost: 350,
    buildHours: 36,
    billOfMaterials: { steel: 40 },
  },
  'mg-armor-t5': {
    id: 'mg-armor-t5',
    name: 'MG + Armor',
    tier: 5,
    domain: 'land',
    role: 'armor',
    combatValue: 80,
    baseSpeedKmh: 35,
    fundingCost: 8000,
    manpowerCost: 150,
    buildHours: 72,
    billOfMaterials: { steel: 200, fuel: 80 },
  },
};

const BASELINE: Leader = {
  id: 'leader-baseline',
  name: 'Baseline',
  region: 'Test',
  era: 'Modern',
  weights: { aggression: 5, risk: 5, economy: 5, expansion: 5 },
  traits: {},
};

const ATTACKER_FACTION: Faction = {
  id: 'faction-attacker',
  leaderId: 'leader-baseline',
  isPlayer: true,
  funding: 10_000,
  manpower: 5_000,
  manpowerCap: 10_000,
};

const DEFENDER_FACTION: Faction = {
  id: 'faction-defender',
  leaderId: 'leader-baseline',
  isPlayer: false,
  funding: 10_000,
  manpower: 5_000,
  manpowerCap: 10_000,
};

export const CONTESTED: Territory = {
  id: 'territory-contested',
  name: 'Casablanca',
  coord: { lat: 33.5731, lon: -7.5898 },
  ownerId: 'faction-defender',
  baseYield: 50,
  infraLevel: 1,
  resources: {},
};

export const FRIENDLY_FALLBACK: Territory = {
  id: 'territory-lisbon',
  name: 'Lisbon',
  coord: { lat: 38.7223, lon: -9.1393 },
  ownerId: 'faction-defender',
  baseYield: 60,
  infraLevel: 1,
  resources: {},
};

export const ISOLATED: Territory = {
  id: 'territory-isolated',
  name: 'Isolated Post',
  coord: { lat: 0, lon: 0 },
  ownerId: 'faction-defender',
  baseYield: 10,
  infraLevel: 1,
  resources: {},
};

export function makeCombatWorld(overrides: Partial<WorldState> = {}): WorldState {
  const nowMs = 1_700_000_000_000;
  return {
    nowMs,
    day: 1,
    startMs: nowMs,
    rng: { seed: 99 },
    territories: {
      [CONTESTED.id]: CONTESTED,
      [FRIENDLY_FALLBACK.id]: FRIENDLY_FALLBACK,
    },
    units: {},
    factions: {
      'faction-attacker': ATTACKER_FACTION,
      'faction-defender': DEFENDER_FACTION,
    },
    leaders: { [BASELINE.id]: BASELINE },
    unitTypes: COMBAT_UNIT_TYPES,
    scenarioId: 'combat-test',
    ...overrides,
  };
}

export function stack(
  id: string,
  typeId: string,
  ownerId: string,
  count: number,
  locationId: string,
  stance: Unit['stance'] = 'defend',
): Unit {
  return { id, typeId, ownerId, count, locationId, stance };
}

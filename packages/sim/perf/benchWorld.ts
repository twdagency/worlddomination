import { LEADERS_BY_ID } from '../../shared/src/leaders';
import { UNIT_TYPES_BY_ID } from '../../shared/src/units';
import { diplomacyDefaults } from '../src/diplomacy';
import type { Faction, Id, Territory, Unit, WorldState } from '../src/types';

const LEADER_IDS = ['leader-caesar', 'leader-genghis', 'leader-elizabeth', 'leader-alexander'] as const;

/** Deterministic scaling world: 1 player hub + `aiFactionCount` AI territories/units. */
export function buildBenchWorld(aiFactionCount: number, nowMs: number): WorldState {
  const playerId: Id = 'faction-player';
  const territories: Record<Id, Territory> = {};
  const factions: Record<Id, Faction> = {
    [playerId]: {
      id: playerId,
      leaderId: 'leader-elizabeth',
      isPlayer: true,
      funding: 25_000,
      manpower: 8_000,
      manpowerCap: 15_000,
    },
  };
  const units: Record<Id, Unit> = {};

  territories['territory-player'] = {
    id: 'territory-player',
    name: 'Hub',
    coord: { lat: 44.7866, lon: 20.4489 },
    ownerId: playerId,
    baseYield: 120,
    infraLevel: 2,
    resources: { steel: 80, food: 40 },
  };

  units['unit-player'] = {
    id: 'unit-player',
    typeId: 'mg-armor-t5',
    ownerId: playerId,
    count: 10,
    locationId: 'territory-player',
    stance: 'defend',
  };

  for (let i = 0; i < aiFactionCount; i++) {
    const factionId: Id = `faction-ai-${i}`;
    const territoryId: Id = `territory-ai-${i}`;
    const angle = (i / aiFactionCount) * Math.PI * 2;
    const radius = 1.8;

    territories[territoryId] = {
      id: territoryId,
      name: `Sector ${i + 1}`,
      coord: {
        lat: 44.7866 + Math.sin(angle) * radius,
        lon: 20.4489 + Math.cos(angle) * radius,
      },
      ownerId: factionId,
      baseYield: 90,
      infraLevel: 1,
      resources: i % 2 === 0 ? { steel: 30 } : { food: 30 },
      extraction: i % 2 === 0 ? { steel: 8 } : { food: 10 },
    };

    factions[factionId] = {
      id: factionId,
      leaderId: LEADER_IDS[i % LEADER_IDS.length],
      isPlayer: false,
      funding: 20_000 + i * 500,
      manpower: 7_000,
      manpowerCap: 16_000,
    };

    units[`unit-ai-${i}`] = {
      id: `unit-ai-${i}`,
      typeId: i % 3 === 0 ? 'levy-t1' : 'mg-armor-t5',
      ownerId: factionId,
      count: 8 + (i % 4),
      locationId: territoryId,
      stance: i % 2 === 0 ? 'defend' : 'retreat-if-outnumbered',
    };
  }

  return {
    nowMs,
    day: 1,
    startMs: nowMs,
    rng: { seed: 7_000 + aiFactionCount },
    territories,
    units,
    factions,
    leaders: { ...LEADERS_BY_ID },
    unitTypes: { ...UNIT_TYPES_BY_ID },
    intel: {},
    ...diplomacyDefaults(factions),
    scenarioId: `bench-ai-${aiFactionCount}`,
  };
}

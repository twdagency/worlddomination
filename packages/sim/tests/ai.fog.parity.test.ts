import { describe, it, expect } from 'vitest';
import { computeVisibility, SCOUT_UNIT_TYPE_ID, tick } from '../src';
import { createSprint5World } from '../../shared/src/scenario-sprint5';
import { LONDON, PARIS, makeWorld } from './fixtures';
import type { WorldState } from '../src/types';

const BERLIN = 'territory-berlin';
const BUCHAREST = 'territory-bucharest';
const BELGRADE = 'territory-belgrade';
const ISTANBUL = 'territory-istanbul';
const START_MS = 1_700_500_000_000;
const START_S5_MS = 1_700_960_000_000;

/** Symmetric observers — fog rules must not privilege either faction. */
function symmetricScoutWorld(): WorldState {
  return makeWorld({
    nowMs: START_MS,
    startMs: START_MS,
    territories: {
      [LONDON.id]: { ...LONDON, ownerId: 'faction-alpha' },
      [PARIS.id]: { ...PARIS, ownerId: 'faction-beta' },
      [BERLIN]: {
        id: BERLIN,
        name: 'Berlin',
        coord: { lat: 52.52, lon: 13.405 },
        ownerId: 'faction-enemy',
        baseYield: 90,
        infraLevel: 1,
        resources: {},
      },
    },
    factions: {
      'faction-alpha': {
        id: 'faction-alpha',
        leaderId: 'leader-genghis',
        isPlayer: false,
        funding: 20_000,
        manpower: 8_000,
        manpowerCap: 15_000,
      },
      'faction-beta': {
        id: 'faction-beta',
        leaderId: 'leader-caesar',
        isPlayer: false,
        funding: 20_000,
        manpower: 8_000,
        manpowerCap: 15_000,
      },
      'faction-enemy': {
        id: 'faction-enemy',
        leaderId: 'leader-baseline',
        isPlayer: false,
        funding: 15_000,
        manpower: 5_000,
        manpowerCap: 10_000,
      },
    },
    units: {
      'scout-alpha': {
        id: 'scout-alpha',
        typeId: SCOUT_UNIT_TYPE_ID,
        ownerId: 'faction-alpha',
        count: 1,
        locationId: LONDON.id,
        stance: 'hold',
      },
      'scout-beta': {
        id: 'scout-beta',
        typeId: SCOUT_UNIT_TYPE_ID,
        ownerId: 'faction-beta',
        count: 1,
        locationId: PARIS.id,
        stance: 'hold',
      },
    },
    intel: {},
  });
}

function foreignTerritoryStates(
  world: WorldState,
  factionId: string,
  ownedFactionIds: string[],
): Record<string, string> {
  const states = computeVisibility(world, factionId).territoryStates;
  const filtered: Record<string, string> = {};
  for (const [territoryId, visibility] of Object.entries(states)) {
    const ownerId = world.territories[territoryId]?.ownerId;
    if (ownerId && ownedFactionIds.includes(ownerId)) continue;
    filtered[territoryId] = visibility.state;
  }
  return filtered;
}

/**
 * FOG PARITY GUARANTEE — do not weaken without an explicit design decision.
 * Breaking these tests means the AI gained or the player lost asymmetric information.
 */
describe('fog parity', () => {
  it('symmetric scout positions yield matching tri-state on foreign territories', () => {
    const world = symmetricScoutWorld();
    const { world: observed } = tick(world, [], 3_600_000);

    const alphaView = foreignTerritoryStates(observed, 'faction-alpha', ['faction-alpha']);
    const betaView = foreignTerritoryStates(observed, 'faction-beta', ['faction-beta']);

    expect(alphaView[BERLIN]).toBeDefined();
    expect(betaView[BERLIN]).toBeDefined();
    expect(alphaView[BERLIN]).toBe(betaView[BERLIN]);
  });

  it('computeVisibility is identical for repeated reads — no player privilege', () => {
    const world = symmetricScoutWorld();
    const { world: observed } = tick(world, [], 3_600_000);

    const first = computeVisibility(observed, 'faction-alpha');
    const second = computeVisibility(observed, 'faction-alpha');

    expect(second.territoryStates).toEqual(first.territoryStates);
    expect(second.territoryIds).toEqual(first.territoryIds);
  });

  it('sprint5 Balkan geometry: symmetric scouts yield matching tri-state on Istanbul', () => {
    const world = createSprint5World(START_S5_MS);
    const withScouts: WorldState = {
      ...world,
      units: {
        ...world.units,
        'scout-player': {
          id: 'scout-player',
          typeId: SCOUT_UNIT_TYPE_ID,
          ownerId: 'faction-player',
          count: 1,
          locationId: BELGRADE,
          stance: 'hold',
        },
        'scout-rome': {
          id: 'scout-rome',
          typeId: SCOUT_UNIT_TYPE_ID,
          ownerId: 'faction-rome',
          count: 1,
          locationId: BUCHAREST,
          stance: 'hold',
        },
      },
    };
    const { world: observed } = tick(withScouts, [], 3_600_000);

    const playerView = foreignTerritoryStates(observed, 'faction-player', ['faction-player']);
    const romeView = foreignTerritoryStates(observed, 'faction-rome', ['faction-rome']);

    expect(playerView[ISTANBUL]).toBeDefined();
    expect(romeView[ISTANBUL]).toBeDefined();
    expect(playerView[ISTANBUL]).toBe(romeView[ISTANBUL]);
  });
});

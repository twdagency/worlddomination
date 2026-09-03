import { describe, it, expect } from 'vitest';
import {
  formatArrivalNarrative,
  formatDepartureNarrative,
  formatProductionNarrative,
} from '../src/reports';
import { LONDON, NEW_YORK, PARIS, makeWorld } from './fixtures';
import type { SimEvent, WorldState } from '../src/types';

function departureEvent(
  world: WorldState,
  overrides: Partial<Extract<SimEvent, { kind: 'departure' }>> = {},
): Extract<SimEvent, { kind: 'departure' }> {
  return {
    kind: 'departure',
    at: world.nowMs,
    unitId: 'unit-1',
    fromTerritoryId: LONDON.id,
    toTerritoryId: NEW_YORK.id,
    ownerId: 'faction-player',
    unitTypeId: 'mg-armor-t5',
    count: 1,
    stanceOnArrival: 'hold',
    ...overrides,
  };
}

describe('dispatch narratives', () => {
  it('player departure names force and reinforcing intent', () => {
    const world = makeWorld();
    const line = formatDepartureNarrative(world, departureEvent(world));
    expect(line).toMatch(/^DEPARTURE — Your 1×/);
    expect(line).toContain('left London for New York');
    expect(line).toContain('(reinforcing)');
  });

  it('AI assault on player territory reads as assault inbound', () => {
    const world = makeWorld({
      territories: {
        [LONDON.id]: { ...LONDON, ownerId: 'faction-steppe' },
        [PARIS.id]: { ...PARIS, ownerId: 'faction-player' },
      },
      factions: {
        'faction-steppe': {
          id: 'faction-steppe',
          leaderId: 'leader-genghis',
          isPlayer: false,
          funding: 20_000,
          manpower: 8_000,
          manpowerCap: 15_000,
        },
        'faction-player': makeWorld().factions['faction-player'],
      },
    });

    const line = formatDepartureNarrative(
      world,
      departureEvent(world, {
        fromTerritoryId: LONDON.id,
        toTerritoryId: PARIS.id,
        ownerId: 'faction-steppe',
        count: 8,
        stanceOnArrival: 'assault',
      }),
    );

    expect(line).toMatch(/^INTEL — Genghis's 8×/);
    expect(line).toContain('London');
    expect(line).toContain('Paris');
    expect(line).toContain('(assault inbound)');
  });

  it('AI arrival at hostile ground flags contact expected', () => {
    const world = makeWorld({
      territories: {
        [LONDON.id]: LONDON,
        [PARIS.id]: { ...PARIS, ownerId: 'faction-rome' },
      },
      factions: {
        'faction-steppe': {
          id: 'faction-steppe',
          leaderId: 'leader-genghis',
          isPlayer: false,
          funding: 20_000,
          manpower: 8_000,
          manpowerCap: 15_000,
        },
        'faction-rome': {
          id: 'faction-rome',
          leaderId: 'leader-caesar',
          isPlayer: false,
          funding: 20_000,
          manpower: 8_000,
          manpowerCap: 15_000,
        },
        'faction-player': makeWorld().factions['faction-player'],
      },
    });

    const line = formatArrivalNarrative(world, {
      kind: 'arrival',
      at: world.nowMs,
      unitId: 'unit-steppe',
      territoryId: PARIS.id,
      ownerId: 'faction-steppe',
      unitTypeId: 'mg-armor-t5',
      count: 8,
      stanceOnArrival: 'assault',
      fromTerritoryId: LONDON.id,
    });

    expect(line).toMatch(/^INTEL — Genghis's 8×/);
    expect(line).toContain('Paris');
    expect(line).toContain('contact expected');
  });

  it('production names the producing faction', () => {
    const world = makeWorld();
    const playerLine = formatProductionNarrative(world, {
      kind: 'production',
      at: world.nowMs,
      territoryId: LONDON.id,
      unitTypeId: 'levy-t1',
      count: 5,
      countryId: 'faction-player',
    });
    expect(playerLine).toBe('PRODUCTION — Your 5× Levy ready at London');

    const aiWorld = makeWorld({
      factions: {
        'faction-britain': {
          id: 'faction-britain',
          leaderId: 'leader-elizabeth',
          isPlayer: false,
          funding: 15_000,
          manpower: 6_000,
          manpowerCap: 12_000,
        },
        'faction-player': makeWorld().factions['faction-player'],
      },
    });
    const aiLine = formatProductionNarrative(aiWorld, {
      kind: 'production',
      at: aiWorld.nowMs,
      territoryId: LONDON.id,
      unitTypeId: 'levy-t1',
      count: 40,
      countryId: 'faction-britain',
    });
    expect(aiLine).toBe('INTEL — Elizabeth — 40× Levy ready at London');
  });
});

import { describe, it, expect } from 'vitest';
import { computeVisibility, isTerritoryVisible, isUnitVisible } from '../src/visibility';
import { LONDON, NEW_YORK, PARIS, makeWorld } from './fixtures';
import type { Territory, Unit } from '../src/types';

const NEAR_NYC: Territory = {
  id: 'territory-near-nyc',
  name: 'Coast Watch',
  coord: { lat: 40.75, lon: -71.5 },
  ownerId: 'faction-player',
  baseYield: 50,
  infraLevel: 1,
  resources: {},
};

describe('player fog parity (computeVisibility)', () => {
  it('player cannot see ungarrisoned enemy territory outside scout range', () => {
    const world = makeWorld({
      territories: {
        [LONDON.id]: LONDON,
        [NEW_YORK.id]: { ...NEW_YORK, ownerId: 'faction-enemy' },
      },
      factions: {
        'faction-player': makeWorld().factions['faction-player'],
        'faction-enemy': {
          id: 'faction-enemy',
          leaderId: 'leader-caesar',
          isPlayer: false,
          funding: 10_000,
          manpower: 5_000,
          manpowerCap: 10_000,
        },
      },
      units: {
        'unit-1': makeWorld().units['unit-1'],
      },
    });

    expect(isTerritoryVisible(world, 'faction-player', NEW_YORK.id)).toBe(false);
    expect(computeVisibility(world, 'faction-player').territoryIds.has(NEW_YORK.id)).toBe(
      false,
    );
  });

  it('computeVisibility returns identical shape for player and AI factions', () => {
    const world = makeWorld({
      territories: {
        [LONDON.id]: { ...LONDON, ownerId: 'faction-ai' },
        [PARIS.id]: { ...PARIS, ownerId: 'faction-player' },
      },
      factions: {
        'faction-player': makeWorld().factions['faction-player'],
        'faction-ai': {
          id: 'faction-ai',
          leaderId: 'leader-genghis',
          isPlayer: false,
          funding: 10_000,
          manpower: 5_000,
          manpowerCap: 10_000,
        },
      },
    });

    const playerVis = computeVisibility(world, 'faction-player');
    const aiVis = computeVisibility(world, 'faction-ai');

    expect(playerVis).toEqual(
      expect.objectContaining({
        territoryIds: expect.any(Set),
        unitIds: expect.any(Set),
      }),
    );
    expect(aiVis).toEqual(
      expect.objectContaining({
        territoryIds: expect.any(Set),
        unitIds: expect.any(Set),
      }),
    );
    expect([...playerVis.territoryIds].sort()).toEqual([...aiVis.territoryIds].sort());
    expect([...playerVis.unitIds].sort()).toEqual([...aiVis.unitIds].sort());
  });

  it('fog updates when a friendly unit moves into scout range', () => {
    const hiddenEnemy: Unit = {
      id: 'unit-hidden',
      typeId: 'levy-t1',
      ownerId: 'faction-enemy',
      count: 30,
      locationId: NEW_YORK.id,
      stance: 'defend',
    };

    const worldFar = makeWorld({
      territories: {
        [LONDON.id]: LONDON,
        [NEW_YORK.id]: { ...NEW_YORK, ownerId: 'faction-enemy' },
      },
      units: {
        'unit-1': makeWorld().units['unit-1'],
        'unit-hidden': hiddenEnemy,
      },
      factions: {
        'faction-player': makeWorld().factions['faction-player'],
        'faction-enemy': {
          id: 'faction-enemy',
          leaderId: 'leader-caesar',
          isPlayer: false,
          funding: 10_000,
          manpower: 5_000,
          manpowerCap: 10_000,
        },
      },
    });

    expect(isUnitVisible(worldFar, 'faction-player', 'unit-hidden')).toBe(false);

    const worldNear = makeWorld({
      territories: {
        [LONDON.id]: LONDON,
        [NEAR_NYC.id]: NEAR_NYC,
        [NEW_YORK.id]: { ...NEW_YORK, ownerId: 'faction-enemy' },
      },
      units: {
        'unit-scout': {
          id: 'unit-scout',
          typeId: 'mg-armor-t5',
          ownerId: 'faction-player',
          count: 1,
          locationId: NEAR_NYC.id,
          stance: 'defend',
        },
        'unit-hidden': hiddenEnemy,
      },
      factions: {
        'faction-player': makeWorld().factions['faction-player'],
        'faction-enemy': {
          id: 'faction-enemy',
          leaderId: 'leader-caesar',
          isPlayer: false,
          funding: 10_000,
          manpower: 5_000,
          manpowerCap: 10_000,
        },
      },
    });

    expect(isUnitVisible(worldNear, 'faction-player', 'unit-hidden')).toBe(true);
    expect(isTerritoryVisible(worldNear, 'faction-player', NEW_YORK.id)).toBe(true);
  });
});

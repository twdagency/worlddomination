import { describe, it, expect } from 'vitest';
import {
  formatBuildStartedLine,
  formatInfraUpgradedLine,
  formatIntentArrivalLine,
  formatIntentDepartureLine,
  taggedOrderFields,
} from '../src/dispatch';
import { LONDON, NEW_YORK, PARIS, makeWorld } from './fixtures';
import type { WorldState } from '../src/types';

function withLeaders(world: WorldState): WorldState {
  return {
    ...world,
    factions: {
      ...world.factions,
      'faction-steppe': {
        id: 'faction-steppe',
        leaderId: 'leader-genghis',
        isPlayer: false,
        funding: 20_000,
        manpower: 8_000,
        manpowerCap: 15_000,
      },
      'faction-britain': {
        id: 'faction-britain',
        leaderId: 'leader-elizabeth',
        isPlayer: false,
        funding: 24_000,
        manpower: 8_500,
        manpowerCap: 17_000,
      },
    },
  };
}

describe('dispatch intent phrasing', () => {
  const world = withLeaders(makeWorld());
  const tags = taggedOrderFields('faction-steppe', world.nowMs, 'attack');

  it('attack departure uses advancing phrasing', () => {
    const line = formatIntentDepartureLine(world, {
      kind: 'departure',
      at: world.nowMs,
      unitId: 'unit-1',
      fromTerritoryId: LONDON.id,
      toTerritoryId: PARIS.id,
      ownerId: 'faction-steppe',
      unitTypeId: 'mg-armor-t5',
      count: 8,
      stanceOnArrival: 'assault',
      intent: 'attack',
      source: 'direct',
      ...tags,
    });
    expect(line).toBe('INTEL — Genghis forces advancing from London (Test) toward Paris (unclaimed)');
  });

  it('defend departure uses repositioning phrasing', () => {
    const line = formatIntentDepartureLine(world, {
      kind: 'departure',
      at: world.nowMs,
      unitId: 'unit-1',
      fromTerritoryId: LONDON.id,
      toTerritoryId: NEW_YORK.id,
      ownerId: 'faction-steppe',
      unitTypeId: 'mg-armor-t5',
      count: 4,
      stanceOnArrival: 'hold',
      intent: 'defend',
      source: 'direct',
      ...taggedOrderFields('faction-steppe', world.nowMs, 'defend'),
    });
    expect(line).toBe('INTEL — Genghis forces repositioning to New York (unclaimed)');
  });

  it('expand departure uses claim phrasing', () => {
    const line = formatIntentDepartureLine(world, {
      kind: 'departure',
      at: world.nowMs,
      unitId: 'unit-1',
      fromTerritoryId: LONDON.id,
      toTerritoryId: NEW_YORK.id,
      ownerId: 'faction-steppe',
      unitTypeId: 'mg-armor-t5',
      count: 4,
      stanceOnArrival: 'secure',
      intent: 'expand',
      source: 'direct',
      ...taggedOrderFields('faction-steppe', world.nowMs, 'expand'),
    });
    expect(line).toBe('INTEL — Genghis forces moving to claim New York (unclaimed)');
  });

  it('build started and infra upgraded are distinct', () => {
    const buildLine = formatBuildStartedLine(world, {
      kind: 'buildStarted',
      at: world.nowMs,
      territoryId: LONDON.id,
      countryId: 'faction-britain',
      unitTypeId: 'levy-t1',
      count: 40,
      intent: 'build',
      source: 'direct',
      ...taggedOrderFields('faction-britain', world.nowMs, 'build'),
    });
    const infraLine = formatInfraUpgradedLine(world, {
      kind: 'infraUpgraded',
      at: world.nowMs,
      territoryId: LONDON.id,
      countryId: 'faction-britain',
      infraLevel: 2,
      intent: 'build',
      source: 'direct',
      ...taggedOrderFields('faction-britain', world.nowMs, 'build'),
    });
    expect(buildLine).toBe('INTEL — Construction begun at London (Test) (Elizabeth)');
    expect(infraLine).toBe('INTEL — Infrastructure upgraded at London (Test) (Elizabeth)');
    expect(buildLine).not.toEqual(infraLine);
  });

  it('attack arrival flags contact expected', () => {
    const line = formatIntentArrivalLine(world, {
      kind: 'arrival',
      at: world.nowMs,
      unitId: 'unit-1',
      territoryId: PARIS.id,
      ownerId: 'faction-steppe',
      unitTypeId: 'mg-armor-t5',
      count: 8,
      stanceOnArrival: 'assault',
      fromTerritoryId: LONDON.id,
      intent: 'attack',
      source: 'direct',
      ...tags,
    });
    expect(line).toBe('INTEL — Genghis forces arrived at Paris (unclaimed) — contact expected');
  });
});

import { describe, it, expect } from 'vitest';
import {
  applyTempoCommitment,
  committedCount,
  decideOrders,
  tempoCommitFraction,
} from '../src/ai';
import { advanceTo, renderDigestText } from '../src';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { LONDON, PARIS, makeWorld } from './fixtures';
import type { WorldState } from '../src/types';
import { taggedOrderFields } from '../src/dispatch';

function attackWorld(leaderId: string, stackCount: number): WorldState {
  return makeWorld({
    units: {
      'unit-ai': {
        id: 'unit-ai',
        typeId: 'mg-armor-t5',
        ownerId: 'faction-ai',
        count: stackCount,
        locationId: LONDON.id,
        stance: 'defend',
      },
      'unit-player-garrison': {
        id: 'unit-player-garrison',
        typeId: 'levy-t1',
        ownerId: 'faction-player',
        count: 20,
        locationId: PARIS.id,
        stance: 'defend',
      },
    },
    territories: {
      [LONDON.id]: { ...LONDON, ownerId: 'faction-ai' },
      [PARIS.id]: { ...PARIS, ownerId: 'faction-player' },
    },
    factions: {
      'faction-ai': {
        id: 'faction-ai',
        leaderId,
        isPlayer: false,
        funding: 25_000,
        manpower: 20_000,
        manpowerCap: 30_000,
      },
      'faction-player': makeWorld().factions['faction-player'],
    },
  });
}

describe('ai tempo commitment', () => {
  it('maps tempo to bounded commit fractions', () => {
    expect(tempoCommitFraction('fast')).toBe(0.75);
    expect(tempoCommitFraction('steady')).toBe(0.5);
    expect(tempoCommitFraction('slow')).toBe(0.3);
    expect(committedCount(100, tempoCommitFraction('fast'))).toBe(75);
    expect(committedCount(100, tempoCommitFraction('slow'))).toBe(30);
  });

  it('fast leaders commit a larger move fraction than slow on the same board', () => {
    const stackCount = 100;
    const fastWorld = attackWorld('leader-genghis', stackCount);
    const slowWorld = {
      ...attackWorld('leader-genghis', stackCount),
      factions: {
        ...attackWorld('leader-genghis', stackCount).factions,
        'faction-ai': {
          ...attackWorld('leader-genghis', stackCount).factions['faction-ai'],
          leaderId: 'leader-tempo-slow',
        },
      },
      leaders: {
        ...attackWorld('leader-genghis', stackCount).leaders,
        'leader-tempo-slow': {
          ...attackWorld('leader-genghis', stackCount).leaders['leader-genghis']!,
          id: 'leader-tempo-slow',
          tempo: 'slow',
        },
      },
    };

    const fastOrders = decideOrders(fastWorld, 'faction-ai', fastWorld.nowMs);
    const slowOrders = decideOrders(slowWorld, 'faction-ai', slowWorld.nowMs);

    expect(fastOrders[0]?.kind).toBe('move');
    expect(slowOrders[0]?.kind).toBe('move');
    if (fastOrders[0]?.kind === 'move' && slowOrders[0]?.kind === 'move') {
      expect(fastOrders[0].count).toBe(75);
      expect(slowOrders[0].count).toBe(30);
      expect(fastOrders[0].count!).toBeGreaterThan(slowOrders[0].count!);
      expect(fastOrders[0].toTerritoryId).toBe(slowOrders[0].toTerritoryId);
      expect(fastOrders[0].intent).toBe('attack');
      expect(slowOrders[0].intent).toBe('attack');
    }
  });

  it('applyTempoCommitment does not change upgradeInfra orders', () => {
    const world = makeWorld();
    const order = {
      kind: 'upgradeInfra' as const,
      territoryId: LONDON.id,
      ...taggedOrderFields('faction-player', world.nowMs, 'build'),
    };
    expect(applyTempoCommitment(world, 'faction-player', order)).toEqual(order);
  });

  it('tempo commitment is deterministic for equal world state', () => {
    const world = attackWorld('leader-caesar', 80);
    const tick = world.nowMs;
    const a = decideOrders(world, 'faction-ai', tick);
    const b = decideOrders(world, 'faction-ai', tick);
    expect(b).toEqual(a);
    if (a[0]?.kind === 'move') {
      expect(a[0].count).toBe(40);
    }
  });

  it('18h sprint4 digest lines identify faction postures', () => {
    const START = 1_700_000_000_000;
    const { events, world } = advanceTo(createSprint4World(START), START + 18 * 3_600_000);
    const digest = renderDigestText(world, events);
    expect(digest).toContain('Genghis');
    expect(digest).toContain('Caesar');
    expect(digest).toContain('Elizabeth');
    expect(digest).toMatch(/advancing from/);
    expect(digest).toMatch(/Construction begun/);
    expect(digest).toMatch(/Infrastructure upgraded/);
  });
});

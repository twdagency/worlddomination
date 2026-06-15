import { describe, it, expect } from 'vitest';
import { assertAiOrders, decideOrders } from '../src/ai';
import { tick } from '../src/tick';
import { isTerritoryVisible } from '../src/visibility';
import { LONDON, NEW_YORK, PARIS, makeWorld } from './fixtures';
import type { Order, WorldState } from '../src/types';

function makeAiWorld(leaderId: string, overrides: Partial<WorldState> = {}): WorldState {
  const base = makeWorld({
    territories: {
      [LONDON.id]: { ...LONDON, ownerId: 'faction-ai' },
      [PARIS.id]: { ...PARIS, ownerId: 'faction-player', resources: { food: 100 } },
    },
    units: {
      'unit-ai': {
        id: 'unit-ai',
        typeId: 'mg-armor-t5',
        ownerId: 'faction-ai',
        count: 10,
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
    factions: {
      'faction-ai': {
        id: 'faction-ai',
        leaderId,
        isPlayer: false,
        funding: 25_000,
        manpower: 8_000,
        manpowerCap: 15_000,
      },
      'faction-player': {
        id: 'faction-player',
        leaderId: 'leader-baseline',
        isPlayer: true,
        funding: 10_000,
        manpower: 5_000,
        manpowerCap: 10_000,
      },
    },
    ...overrides,
  });
  return base;
}

function onlyAllowedOrders(orders: Order[]): void {
  assertAiOrders(orders);
  for (const order of orders) {
    expect(['move', 'build', 'upgradeInfra']).toContain(order.kind);
  }
}

describe('ai', () => {
  it('is deterministic for the same world state', () => {
    const world = makeAiWorld('leader-genghis');
    const first = decideOrders(world, 'faction-ai', world.nowMs);
    const second = decideOrders(world, 'faction-ai', world.nowMs);
    expect(second).toEqual(first);
    if (first[0]?.kind === 'move') {
      expect(first[0].count).toBe(7);
    }
  });

  it('aggressive leader attacks while mercantile leader builds', () => {
    const genghisOrders = decideOrders(makeAiWorld('leader-genghis'), 'faction-ai', makeAiWorld('leader-genghis').nowMs);
    const elizabethWorld = makeAiWorld('leader-elizabeth', {
      territories: {
        [LONDON.id]: {
          ...LONDON,
          ownerId: 'faction-ai',
          resources: { food: 100 },
          extraction: { food: 10 },
        },
        [PARIS.id]: { ...PARIS, ownerId: 'faction-player' },
      },
    });
    const elizabethOrders = decideOrders(elizabethWorld, 'faction-ai', elizabethWorld.nowMs);

    expect(genghisOrders[0]?.kind).toBe('move');
    if (genghisOrders[0]?.kind === 'move') {
      expect(genghisOrders[0].toTerritoryId).toBe(PARIS.id);
      expect(genghisOrders[0].stanceOnArrival).toBe('assault');
      expect(genghisOrders[0].intent).toBe('attack');
      expect(genghisOrders[0].count).toBe(7);
    }

    expect(elizabethOrders[0]?.kind).toBe('build');
    if (elizabethOrders[0]?.kind === 'build') {
      expect(elizabethOrders[0].unitTypeId).toBe('levy-t1');
      expect(elizabethOrders[0].intent).toBe('build');
      expect(elizabethOrders[0].count).toBe(1);
    }
  });

  it('does not target territories outside fog-of-war', () => {
    const world = makeAiWorld('leader-genghis', {
      territories: {
        [LONDON.id]: { ...LONDON, ownerId: 'faction-ai' },
        [PARIS.id]: { ...PARIS, ownerId: 'faction-player' },
        [NEW_YORK.id]: { ...NEW_YORK, ownerId: 'faction-player' },
      },
    });

    const orders = decideOrders(world, 'faction-ai', world.nowMs);
    onlyAllowedOrders(orders);

    for (const order of orders) {
      if (order.kind !== 'move') continue;
      expect(isTerritoryVisible(world, 'faction-ai', order.toTerritoryId)).toBe(true);
      expect(order.toTerritoryId).not.toBe(NEW_YORK.id);
    }
  });

  it('emits only valid Order[] and never mutates world', () => {
    const world = makeAiWorld('leader-caesar');
    const frozen = structuredClone(world);
    const orders = decideOrders(world, 'faction-ai', world.nowMs);
    onlyAllowedOrders(orders);
    expect(world).toEqual(frozen);
  });

  it('AI move obeys the same real travel times as a player move', () => {
    const world = makeAiWorld('leader-genghis');
    const orders = decideOrders(world, 'faction-ai', world.nowMs);
    expect(orders[0]?.kind).toBe('move');
    if (orders[0]?.kind !== 'move') return;

    const aiResult = tick(world, orders, 0);
    const playerResult = tick(world, [orders[0]], 0);

    expect(aiResult.world.units[orders[0].unitId]?.transit).toEqual(
      playerResult.world.units[orders[0].unitId]?.transit,
    );
  });
});

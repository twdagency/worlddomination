import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { collectAiOrders, dispatchLineForEvent, formatOrderRejectedMessage, previewMoveEtaMs, tick } from '../src';
import { tagOrder } from './fixtures';

const START_MS = 1_700_900_000_000;
const PLAYER = 'faction-player';
const LONDON = 'territory-london';
const PARIS = 'territory-paris';
const UNIT = 'unit-player-mg';

function playerOwnsParis(world: ReturnType<typeof createSprint4World>) {
  return {
    ...world,
    territories: {
      ...world.territories,
      [PARIS]: {
        ...world.territories[PARIS]!,
        ownerId: PLAYER,
      },
    },
  };
}

describe('self-assault prevention', () => {
  it('rejects assault orders to another player-owned territory', () => {
    const world = playerOwnsParis(createSprint4World(START_MS));
    const order = tagOrder(
      world,
      {
        kind: 'move',
        unitId: UNIT,
        toTerritoryId: PARIS,
        stanceOnArrival: 'assault',
      },
      PLAYER,
    );

    const result = tick(world, [order], 0);

    expect(result.events.some((event) => event.kind === 'departure')).toBe(false);
    expect(result.events.some((event) => event.kind === 'orderRejected')).toBe(true);
    expect(result.world.units[UNIT]?.locationId).toBe(LONDON);
    expect(result.world.units[UNIT]?.transit).toBeUndefined();
  });

  it('accepts hold orders to another player-owned territory', () => {
    const world = playerOwnsParis(createSprint4World(START_MS));
    const order = tagOrder(
      world,
      {
        kind: 'move',
        unitId: UNIT,
        toTerritoryId: PARIS,
        stanceOnArrival: 'hold',
      },
      PLAYER,
    );

    const travelMs = previewMoveEtaMs(world, UNIT, PARIS)!.travelMs;
    const result = tick(world, [order], travelMs);

    expect(result.events.some((event) => event.kind === 'departure')).toBe(true);
    expect(result.events.some((event) => event.kind === 'orderRejected')).toBe(false);
    expect(result.world.units[UNIT]?.locationId).toBe(PARIS);
  });

  it('accepts secure orders to another player-owned territory', () => {
    const world = playerOwnsParis(createSprint4World(START_MS));
    const order = tagOrder(
      world,
      {
        kind: 'move',
        unitId: UNIT,
        toTerritoryId: PARIS,
        stanceOnArrival: 'secure',
      },
      PLAYER,
    );

    const travelMs = previewMoveEtaMs(world, UNIT, PARIS)!.travelMs;
    const result = tick(world, [order], travelMs);

    expect(result.events.some((event) => event.kind === 'departure')).toBe(true);
    expect(result.events.some((event) => event.kind === 'orderRejected')).toBe(false);
    expect(result.world.units[UNIT]?.locationId).toBe(PARIS);
  });

  it('silently rejects assault to own territory for non-player factions', () => {
    const base = playerOwnsParis(createSprint4World(START_MS));
    const world = {
      ...base,
      factions: {
        ...base.factions,
        [PLAYER]: {
          ...base.factions[PLAYER]!,
          isPlayer: false,
        },
      },
    };
    const order = tagOrder(
      world,
      {
        kind: 'move',
        unitId: UNIT,
        toTerritoryId: PARIS,
        stanceOnArrival: 'assault',
      },
      PLAYER,
    );

    const result = tick(world, [order], 0);

    expect(result.events.some((event) => event.kind === 'orderRejected')).toBe(false);
    expect(result.events.some((event) => event.kind === 'departure')).toBe(false);
    expect(result.world.units[UNIT]?.locationId).toBe(LONDON);
  });

  it('never scores assault moves to own territory in AI attack candidates', () => {
    const world = createSprint4World(START_MS);
    const orders = collectAiOrders(world, START_MS);

    for (const order of orders) {
      if (order.kind !== 'move' || order.stanceOnArrival !== 'assault') continue;
      const unit = world.units[order.unitId];
      const destinationOwner = world.territories[order.toTerritoryId]?.ownerId;
      expect(destinationOwner).not.toBe(unit?.ownerId);
    }
  });
});

describe('orderRejected dispatch formatting', () => {
  it('formats rejection copy for own-territory assault', () => {
    expect(formatOrderRejectedMessage('cannot-assault-own-territory')).toBe(
      'Cannot issue assault on own territory.',
    );

    const world = playerOwnsParis(createSprint4World(START_MS));
    const order = tagOrder(
      world,
      {
        kind: 'move',
        unitId: UNIT,
        toTerritoryId: PARIS,
        stanceOnArrival: 'assault',
      },
      PLAYER,
    );
    const result = tick(world, [order], 0);
    const rejected = result.events.find((event) => event.kind === 'orderRejected');
    expect(rejected).toBeDefined();

    const line = dispatchLineForEvent(result.world, rejected!, PLAYER);
    expect(line).toBe('REJECTED — Cannot issue assault on own territory.');
  });
});

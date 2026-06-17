import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { dispatchLineForEvent, filterDispatchesForFaction, tick } from '../src';
import { tagOrder } from './fixtures';

const START_MS = 1_700_900_000_000;
const PLAYER = 'faction-player';
const PARIS = 'territory-paris';
const UNIT = 'unit-player-mg';

describe('orderRejected dispatch visibility', () => {
  it('surfaces rejection to the player faction only', () => {
    const world = {
      ...createSprint4World(START_MS),
      territories: {
        ...createSprint4World(START_MS).territories,
        [PARIS]: {
          ...createSprint4World(START_MS).territories[PARIS]!,
          ownerId: PLAYER,
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
    const rejected = result.events.find((event) => event.kind === 'orderRejected');
    expect(rejected).toBeDefined();

    const visible = filterDispatchesForFaction(result.world, result.events, PLAYER);
    expect(visible.some((event) => event.kind === 'orderRejected')).toBe(true);
    expect(dispatchLineForEvent(result.world, rejected!, PLAYER)).toContain(
      'Cannot issue assault on own territory',
    );
  });
});

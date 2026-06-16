import { describe, expect, it } from 'vitest';
import {
  applyMoveOrders,
  formAlliance,
  intentFromMoveStance,
  resolveHostileArrival,
  taggedOrderFields,
} from 'sim';
import { createSprint4World } from 'shared';
import { getDashboardNavCards, playerHostileAssaultsInTransit } from '../src/game/playerView';

const START_MS = 1_700_000_000_000;
const PLAYER = 'faction-player';
const GENGHIS = 'faction-steppe';
const BERLIN = 'territory-berlin';
const PARIS = 'territory-paris';
const LONDON = 'territory-london';

function assaultMoveOrder(
  world: ReturnType<typeof createSprint4World>,
  unitId: string,
  toTerritoryId: string,
) {
  const stanceOnArrival = 'assault' as const;
  return {
    kind: 'move' as const,
    unitId,
    toTerritoryId,
    stanceOnArrival,
    ...taggedOrderFields(
      PLAYER,
      world.nowMs,
      intentFromMoveStance(stanceOnArrival, PLAYER, toTerritoryId, world),
    ),
  };
}

describe('order badge selector', () => {
  it('does not badge Order when movable forces are idle at home', () => {
    const world = createSprint4World(START_MS);
    const cards = getDashboardNavCards(world, []);
    const order = cards.find((card) => card.screen === 'Order');

    expect(playerHostileAssaultsInTransit(world)).toBe(0);
    expect(order?.badgeCount).toBe(0);
  });

  it('clears Order badge after alliance forms and cancels hostile assaults', () => {
    const base = createSprint4World(START_MS);
    const order = assaultMoveOrder(base, 'unit-player-mg', BERLIN);
    const inTransit = { ...base, units: applyMoveOrders(base, [order]).units };

    expect(playerHostileAssaultsInTransit(inTransit)).toBeGreaterThan(0);

    const formed = formAlliance(inTransit, PLAYER, GENGHIS, START_MS + 1_000);
    const cards = getDashboardNavCards(formed.world, []);
    const orderCard = cards.find((card) => card.screen === 'Order');

    expect(playerHostileAssaultsInTransit(formed.world)).toBe(0);
    expect(orderCard?.badgeCount).toBe(0);
  });

  it('clears Order badge after ally capture redirects an in-flight assault', () => {
    let world = formAlliance(createSprint4World(START_MS), PLAYER, GENGHIS, START_MS).world;
    const order = assaultMoveOrder(world, 'unit-player-mg', PARIS);
    world = { ...world, units: applyMoveOrders(world, [order]).units };

    expect(playerHostileAssaultsInTransit(world)).toBeGreaterThan(0);

    world = {
      ...world,
      territories: {
        ...world.territories,
        [PARIS]: { ...world.territories[PARIS]!, ownerId: GENGHIS },
      },
    };

    const attacker = {
      ...world.units['unit-player-mg']!,
      locationId: PARIS,
      transit: undefined,
    };
    const result = resolveHostileArrival(
      world,
      attacker,
      PARIS,
      START_MS + 1_000,
      'assault',
      LONDON,
    );

    const afterWorld = { ...world, units: result.units };
    const cards = getDashboardNavCards(afterWorld, []);
    const orderCard = cards.find((card) => card.screen === 'Order');

    expect(playerHostileAssaultsInTransit(afterWorld)).toBe(0);
    expect(orderCard?.badgeCount).toBe(0);
  });
});

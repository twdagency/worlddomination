import { describe, expect, it } from 'vitest';
import { createSprint4World, resolvePlayerFactionId } from 'shared';
import { filterOrderDestinationsForStance } from '../src/game/orderDestinations';
import { playerOrderDestinations } from '../src/game/playerView';

const START_MS = 1_700_900_000_000;
const LONDON = 'territory-london';
const PARIS = 'territory-paris';

function worldWithPlayerParis() {
  const base = createSprint4World(START_MS);
  const playerId = resolvePlayerFactionId(base);
  return {
    world: {
      ...base,
      territories: {
        ...base.territories,
        [PARIS]: {
          ...base.territories[PARIS]!,
          ownerId: playerId,
        },
      },
    },
    playerId: playerId!,
  };
}

describe('order destination self-assault filter', () => {
  it('excludes player territories from assault stance destinations', () => {
    const { world, playerId } = worldWithPlayerParis();
    const destinations = playerOrderDestinations(world, LONDON);

    const assaultTargets = filterOrderDestinationsForStance(
      world,
      playerId,
      'assault',
      destinations,
    ).map((entry) => entry.territoryId);

    expect(assaultTargets).not.toContain(PARIS);
    expect(assaultTargets.length).toBeLessThan(destinations.length);
  });

  it('includes player territories for hold stance destinations', () => {
    const { world, playerId } = worldWithPlayerParis();
    const destinations = playerOrderDestinations(world, LONDON);

    const holdTargets = filterOrderDestinationsForStance(
      world,
      playerId,
      'hold',
      destinations,
    ).map((entry) => entry.territoryId);

    expect(holdTargets).toContain(PARIS);
    expect(holdTargets.length).toBe(destinations.length);
  });

  it('expands destination list when switching from assault to hold', () => {
    const { world, playerId } = worldWithPlayerParis();
    const destinations = playerOrderDestinations(world, LONDON);

    const assaultTargets = filterOrderDestinationsForStance(
      world,
      playerId,
      'assault',
      destinations,
    );
    const holdTargets = filterOrderDestinationsForStance(world, playerId, 'hold', destinations);

    expect(holdTargets.length).toBeGreaterThan(assaultTargets.length);
    expect(holdTargets.some((entry) => entry.territoryId === PARIS)).toBe(true);
    expect(assaultTargets.some((entry) => entry.territoryId === PARIS)).toBe(false);
  });
});

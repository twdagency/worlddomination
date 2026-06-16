import { describe, expect, it } from 'vitest';
import { createSprint4World, resolvePlayerFactionId } from 'shared';
import { filterOrderDestinationsForStance } from '../src/game/orderDestinations';
import { playerOrderDestinations } from '../src/game/playerView';

const START_MS = 1_700_800_000_000;
const LONDON = 'territory-london';
const PARIS = 'territory-paris';

describe('order destination diagnostics (#15 UI)', () => {
  it('DIAGNOSTIC: assault stance excludes other player-owned territories', () => {
    const base = createSprint4World(START_MS);
    const playerId = resolvePlayerFactionId(base)!;
    const world = {
      ...base,
      territories: {
        ...base.territories,
        [PARIS]: {
          ...base.territories[PARIS]!,
          ownerId: playerId,
        },
      },
    };

    const destinations = filterOrderDestinationsForStance(
      world,
      playerId,
      'assault',
      playerOrderDestinations(world, LONDON),
    ).map((entry) => entry.territoryId);

    expect(destinations).not.toContain(PARIS);
  });
});

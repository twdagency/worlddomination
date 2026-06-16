import { describe, expect, it } from 'vitest';
import { createSprint4World, resolvePlayerFactionId } from 'shared';
import { playerOrderDestinations } from '../src/game/playerView';

const START_MS = 1_700_800_000_000;
const LONDON = 'territory-london';
const PARIS = 'territory-paris';

describe('order destination diagnostics (#15 UI)', () => {
  it('DIAGNOSTIC: destination picker includes other player-owned territories', () => {
    const world = {
      ...createSprint4World(START_MS),
      territories: {
        ...createSprint4World(START_MS).territories,
        [PARIS]: {
          ...createSprint4World(START_MS).territories[PARIS]!,
          ownerId: resolvePlayerFactionId(createSprint4World(START_MS)),
        },
      },
    };

    const destinations = playerOrderDestinations(world, LONDON).map(
      (entry) => entry.territoryId,
    );

    expect(destinations).toContain(PARIS);
  });
});

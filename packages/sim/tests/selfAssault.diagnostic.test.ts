import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { previewMoveEtaMs, tick } from '../src';
import { tagOrder } from './fixtures';

const START_MS = 1_700_800_000_000;
const PLAYER = 'faction-player';
const LONDON = 'territory-london';
const PARIS = 'territory-paris';

describe('self-assault diagnostics (#15)', () => {
  it('DIAGNOSTIC: sim rejects assault order to another player-owned territory', () => {
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
        unitId: 'unit-player-mg',
        toTerritoryId: PARIS,
        stanceOnArrival: 'assault',
      },
      PLAYER,
    );
    const result = tick(world, [order], 0);

    expect(result.events.some((event) => event.kind === 'departure')).toBe(false);
    expect(result.events.some((event) => event.kind === 'orderRejected')).toBe(true);
    expect(result.events.some((event) => event.kind === 'battle')).toBe(false);
    expect(result.world.units['unit-player-mg']?.locationId).toBe(LONDON);
  });

  it('DIAGNOSTIC: sim rejects zero-distance move to same territory only', () => {
    const world = createSprint4World(START_MS);
    const order = tagOrder(
      world,
      {
        kind: 'move',
        unitId: 'unit-player-mg',
        toTerritoryId: LONDON,
        stanceOnArrival: 'assault',
      },
      PLAYER,
    );
    const result = tick(world, [order], 0);

    expect(result.events.some((event) => event.kind === 'departure')).toBe(false);
    expect(previewMoveEtaMs(world, 'unit-player-mg', LONDON)).toBeNull();
  });
});

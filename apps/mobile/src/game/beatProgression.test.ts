import { describe, expect, it } from 'vitest';
import { createTutorialWorld } from 'shared';
import {
  PLAYER_TUTORIAL_FACTION_ID,
  TUTORIAL_BURGUNDY_FACTION_ID,
  TUTORIAL_CALAIS_TERRITORY_ID,
  TUTORIAL_PARIS_TERRITORY_ID,
  playerProposeTreaty,
  tick,
  taggedOrderFields,
} from 'sim';
import { withBeatProgression } from './beatProgression';

const START_MS = 1_700_500_000_000;

function worldAtPinchBeat() {
  let world = createTutorialWorld(START_MS);
  const playerId = PLAYER_TUTORIAL_FACTION_ID;

  world = tick(
    world,
    [
      {
        kind: 'move',
        unitId: 'unit-britain-infantry',
        toTerritoryId: TUTORIAL_PARIS_TERRITORY_ID,
        stanceOnArrival: 'assault',
        ...taggedOrderFields(playerId, world.nowMs, 'expand'),
      },
    ],
    0,
  ).world;
  world = tick(world, [], world.nowMs + 7 * 24 * 3_600_000).world;

  world = tick(
    world,
    [
      {
        kind: 'upgradeInfra',
        territoryId: TUTORIAL_PARIS_TERRITORY_ID,
        ...taggedOrderFields(playerId, world.nowMs, 'build'),
      },
    ],
    0,
  ).world;

  expect(world.tutorial?.currentBeat).toBe('pinch');
  return world;
}

describe('withBeatProgression', () => {
  it('advances pinch to governance when a Burgundy treaty forms outside tick', () => {
    const world = worldAtPinchBeat();
    const treaty = playerProposeTreaty(
      world,
      PLAYER_TUTORIAL_FACTION_ID,
      TUTORIAL_BURGUNDY_FACTION_ID,
      TUTORIAL_CALAIS_TERRITORY_ID,
      world.nowMs,
    );

    const progressed = withBeatProgression(treaty);

    expect(progressed.world.tutorial?.completedBeats).toContain('pinch');
    expect(progressed.world.tutorial?.currentBeat).toBe('governance');
    expect(
      progressed.world.pendingDilemmas?.some((row) => row.dilemmaId === 'foreign-rule'),
    ).toBe(true);
  });
});

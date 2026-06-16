import { describe, expect, it } from 'vitest';
import { createTutorialWorld } from '../../shared/src/scenario-tutorial';
import {
  PLAYER_TUTORIAL_FACTION_ID,
  previewMoveEtaMs,
  TUTORIAL_HOME_TERRITORY_ID,
  TUTORIAL_PARIS_TERRITORY_ID,
} from '../src';

const START_MS = 1_700_750_000_000;
const PHASE_5_PLAYTHROUGH_FUNDING = 8_000;

describe('DIAGNOSTIC tutorial scenario invariants', () => {
  it('createTutorialWorld produces a Beat-1-completable starting state', () => {
    const world = createTutorialWorld(START_MS);
    const playerId = PLAYER_TUTORIAL_FACTION_ID;
    const player = world.factions[playerId];
    const playerUnits = Object.values(world.units).filter((unit) => unit.ownerId === playerId);
    const londonUnits = playerUnits.filter(
      (unit) => unit.locationId === TUTORIAL_HOME_TERRITORY_ID && !unit.transit,
    );

    const snapshot = {
      funding: player?.funding,
      playerUnits,
      london: world.territories[TUTORIAL_HOME_TERRITORY_ID],
      paris: world.territories[TUTORIAL_PARIS_TERRITORY_ID],
      parisMarchPreview: previewMoveEtaMs(world, 'unit-britain-infantry', TUTORIAL_PARIS_TERRITORY_ID),
    };

    // eslint-disable-next-line no-console
    console.log('DIAGNOSTIC #6b tutorial starting state:', JSON.stringify(snapshot, null, 2));

    expect(player).toBeDefined();
    expect(player!.funding).toBe(PHASE_5_PLAYTHROUGH_FUNDING);
    expect(player!.funding).toBeGreaterThan(0);
    expect(londonUnits.length).toBeGreaterThanOrEqual(1);
    expect(snapshot.parisMarchPreview?.travelMs).toBeGreaterThan(0);
  });
});

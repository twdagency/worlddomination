import { describe, expect, it } from 'vitest';
import { resolvePlayerFactionId } from 'shared';
import { createTutorialWorld } from '../../shared/src/scenario-tutorial';
import {
  previewMoveEtaMs,
  TUTORIAL_HOME_TERRITORY_ID,
  TUTORIAL_PARIS_TERRITORY_ID,
} from '../src';

const START_MS = 1_700_750_000_000;
const PHASE_5_PLAYTHROUGH_FUNDING = 8_000;

describe('tutorial scenario invariants', () => {
  it('resolvePlayerFactionId identifies the tutorial player faction', () => {
    const world = createTutorialWorld(START_MS);
    expect(resolvePlayerFactionId(world)).toBe('faction-britain-tutorial');
  });

  it('createTutorialWorld produces a Beat-1-completable starting state', () => {
    const world = createTutorialWorld(START_MS);
    const playerId = resolvePlayerFactionId(world)!;
    const player = world.factions[playerId];
    const playerUnits = Object.values(world.units).filter((unit) => unit.ownerId === playerId);
    const londonUnits = playerUnits.filter(
      (unit) => unit.locationId === TUTORIAL_HOME_TERRITORY_ID && !unit.transit,
    );

    expect(player).toBeDefined();
    expect(player!.funding).toBe(PHASE_5_PLAYTHROUGH_FUNDING);
    expect(player!.funding).toBeGreaterThan(0);
    expect(londonUnits.length).toBeGreaterThanOrEqual(1);
    expect(
      previewMoveEtaMs(world, 'unit-britain-infantry', TUTORIAL_PARIS_TERRITORY_ID)?.travelMs,
    ).toBeGreaterThan(0);
  });
});

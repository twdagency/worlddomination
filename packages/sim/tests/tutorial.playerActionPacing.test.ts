import { describe, expect, it } from 'vitest';
import { createTutorialWorld } from '../../shared/src/scenario-tutorial';
import {
  buildDurationMs,
  previewMoveEtaMs,
  TUTORIAL_MAX_PLAYER_ACTION_WALL_MS,
  tutorialPlayerActionGameCapMs,
} from '../src';

const START_MS = 1_700_200_000_000;
const UNIT = 'unit-britain-infantry';
const PARIS = 'territory-paris-tutorial';
const PLAYER = 'faction-britain-tutorial';

describe('tutorial player-action pacing', () => {
  it('caps player march wall time to 2 seconds during active tutorial', () => {
    const world = createTutorialWorld(START_MS);
    const preview = previewMoveEtaMs(world, UNIT, PARIS);
    expect(preview).not.toBeNull();

    const capGameMs = tutorialPlayerActionGameCapMs(world);
    expect(preview!.travelMs).toBeLessThanOrEqual(capGameMs);

    const wallMs = preview!.travelMs / (world.timeMultiplier ?? 1);
    expect(wallMs).toBeLessThanOrEqual(TUTORIAL_MAX_PLAYER_ACTION_WALL_MS);
    expect(wallMs).toBeGreaterThan(0);
  });

  it('caps player build duration during active tutorial', () => {
    const world = createTutorialWorld(START_MS);
    const levy = world.unitTypes['levy-t1']!;
    const rawHours = levy.buildHours * 3_600_000;
    expect(rawHours).toBeGreaterThan(tutorialPlayerActionGameCapMs(world));

    const duration = buildDurationMs(world, levy, PLAYER);
    expect(duration).toBe(tutorialPlayerActionGameCapMs(world));
  });

  it('does not cap after tutorial graduation', () => {
    const world = createTutorialWorld(START_MS);
    const graduated = {
      ...world,
      tutorial: {
        ...world.tutorial!,
        active: false,
        graduatedAt: START_MS,
      },
    };
    const preview = previewMoveEtaMs(graduated, UNIT, PARIS);
    expect(preview!.travelMs).toBeGreaterThan(tutorialPlayerActionGameCapMs(world));
  });
});

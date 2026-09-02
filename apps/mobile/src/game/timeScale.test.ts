import { describe, expect, it } from 'vitest';
import { createSprint4World, createTutorialWorld } from 'shared';
import { TUTORIAL_ACTIVE_TIME_MULTIPLIER } from 'sim';
import { gameTargetAfterWallElapsed, remainingWallMs } from './timeScale';

const START_MS = 1_700_000_000_000;

describe('timeScale', () => {
  it('advances tutorial worlds 30× faster than wall time', () => {
    const world = { ...createTutorialWorld(START_MS), nowMs: START_MS };
    expect(world.timeMultiplier).toBe(TUTORIAL_ACTIVE_TIME_MULTIPLIER);
    expect(gameTargetAfterWallElapsed(world, 1_000)).toBe(START_MS + 30_000);
  });

  it('keeps campaign worlds at 1×', () => {
    const world = { ...createSprint4World(START_MS), nowMs: START_MS, timeMultiplier: 1 };
    expect(gameTargetAfterWallElapsed(world, 1_000)).toBe(START_MS + 1_000);
  });

  it('converts remaining game time into wall time at the current multiplier', () => {
    const world = { ...createTutorialWorld(START_MS), nowMs: START_MS };
    expect(remainingWallMs(world, START_MS + 60_000)).toBe(2_000);
  });
});

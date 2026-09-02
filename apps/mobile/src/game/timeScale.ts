import { getTimeMultiplier, type WorldState } from 'sim';

/** Convert wall-clock idle time into a game-time catch-up target. */
export function gameTargetAfterWallElapsed(world: WorldState, wallElapsedMs: number): number {
  return world.nowMs + Math.max(0, wallElapsedMs) * getTimeMultiplier(world);
}

/** Remaining wait in wall-clock ms, accounting for tutorial/campaign pacing. */
export function remainingWallMs(world: WorldState, completeAtMs: number): number {
  const remainingGameMs = Math.max(0, completeAtMs - world.nowMs);
  return remainingGameMs / getTimeMultiplier(world);
}

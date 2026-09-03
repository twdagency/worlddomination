import { describe, expect, it } from 'vitest';
import { createTutorialWorld } from 'shared';
import { previewMoveEtaMs } from 'sim';
import { remainingWallMs } from './timeScale';

const START_MS = 1_700_200_000_000;

describe('order preview wall ETA', () => {
  it('tutorial Paris march preview resolves within the 2s player-action cap', () => {
    const world = createTutorialWorld(START_MS);
    const preview = previewMoveEtaMs(world, 'unit-britain-infantry', 'territory-paris-tutorial');
    expect(preview).not.toBeNull();

    const wallEtaMs = remainingWallMs(world, preview!.etaMs);
    expect(wallEtaMs).toBeLessThanOrEqual(2_000);
    expect(wallEtaMs).toBeGreaterThan(0);
  });
});

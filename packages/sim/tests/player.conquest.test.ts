import { describe, it, expect } from 'vitest';
import { advanceTo, previewMoveEtaMs } from '../src/clock';
import { taggedOrderFields } from '../src/dispatch';
import { tick } from '../src/tick';
import { createSprint4World } from '../../shared/src/scenario-sprint4';

describe('player conquest ownership', () => {
  it('transfers territory ownerId to player after assault victory', () => {
    const startMs = 1_700_000_000_000;
    const world = createSprint4World(startMs);

    const preview = previewMoveEtaMs(world, 'unit-player-mg', 'territory-paris');
    expect(preview).not.toBeNull();

    const { world: afterDepart } = tick(
      world,
      [
        {
          kind: 'move',
          unitId: 'unit-player-mg',
          toTerritoryId: 'territory-paris',
          stanceOnArrival: 'assault',
          ...taggedOrderFields('faction-player', startMs, 'attack'),
        },
      ],
      0,
    );

    expect(afterDepart.territories['territory-london']?.ownerId).toBe('faction-player');
    expect(afterDepart.units['unit-player-mg']?.transit).toBeDefined();

    const arriveMs = afterDepart.units['unit-player-mg']!.transit!.arriveMs;
    const { world: afterArrival, events } = advanceTo(afterDepart, arriveMs);

    expect(events.some((event) => event.kind === 'secured' || event.kind === 'battle')).toBe(true);
    expect(afterArrival.territories['territory-paris']?.ownerId).toBe('faction-player');
  });
});

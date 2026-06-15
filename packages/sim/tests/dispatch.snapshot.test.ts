import { describe, it, expect } from 'vitest';
import { advanceTo, renderDigestText } from '../src';
import { createSprint4World } from '../../shared/src/scenario-sprint4';

const SNAPSHOT_START_MS = 1_700_000_000_000;
const TWELVE_HOURS_MS = 12 * 3_600_000;

describe('dispatch snapshot', () => {
  it('locks 12h skip digest on createSprint4World', () => {
    const world = createSprint4World(SNAPSHOT_START_MS);
    const { events, world: advanced } = advanceTo(world, SNAPSHOT_START_MS + TWELVE_HOURS_MS);
    const digest = renderDigestText(advanced, events);
    expect(digest).toMatchSnapshot();
  });
});

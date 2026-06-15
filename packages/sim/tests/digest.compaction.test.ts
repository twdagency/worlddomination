import { describe, it, expect } from 'vitest';
import {
  advanceTo,
  compactDispatchFeed,
  DISPATCH_LINE_CAP,
  renderCompactDigestText,
} from '../src';
import { createSprint4World } from '../../shared/src/scenario-sprint4';

const SNAPSHOT_START_MS = 1_700_000_000_000;
const TWENTY_FOUR_HOURS_MS = 24 * 3_600_000;

function countDigestLines(digest: string): number {
  return digest.split('\n').filter((line) => line.length > 0).length;
}

describe('digest compaction', () => {
  it('24h skip on createSprint4World produces at most 40 digest lines', () => {
    const world = createSprint4World(SNAPSHOT_START_MS);
    const { events, world: advanced } = advanceTo(
      world,
      SNAPSHOT_START_MS + TWENTY_FOUR_HOURS_MS,
    );
    const digest = renderCompactDigestText(advanced, events, TWENTY_FOUR_HOURS_MS);
    expect(countDigestLines(digest)).toBeLessThanOrEqual(DISPATCH_LINE_CAP);
  });

  it('12h skip keeps full feed (no compaction)', () => {
    const world = createSprint4World(SNAPSHOT_START_MS);
    const twelveHours = 12 * 3_600_000;
    const { events, world: advanced } = advanceTo(world, SNAPSHOT_START_MS + twelveHours);
    const compacted = compactDispatchFeed(advanced, events, twelveHours);
    const full = compactDispatchFeed(advanced, events, twelveHours - 1);
    expect(compacted.length).toBe(full.length);
    expect(compacted.length).toBeGreaterThan(0);
  });

  it('folds medium build events into per-faction summaries on long skips', () => {
    const world = createSprint4World(SNAPSHOT_START_MS);
    const { events, world: advanced } = advanceTo(
      world,
      SNAPSHOT_START_MS + TWENTY_FOUR_HOURS_MS,
    );
    const digest = renderCompactDigestText(advanced, events, TWENTY_FOUR_HOURS_MS);
    const buildStarts = events.filter((event) => event.kind === 'buildStarted');
    if (buildStarts.length > 1) {
      expect(digest).toMatch(/construction projects begun/);
      expect(digest).not.toContain('Construction begun at');
    }
  });

  it('preserves repeated assault departures as distinct high-importance lines', () => {
    const world = createSprint4World(SNAPSHOT_START_MS);
    const { events, world: advanced } = advanceTo(
      world,
      SNAPSHOT_START_MS + TWENTY_FOUR_HOURS_MS,
    );
    const assaultDepartures = events.filter(
      (event) => event.kind === 'departure' && event.intent === 'attack',
    );
    const digest = renderCompactDigestText(advanced, events, TWENTY_FOUR_HOURS_MS);
    const advancingLines = digest
      .split('\n')
      .filter((line) => line.includes('forces advancing'));
    expect(assaultDepartures.length).toBeGreaterThan(1);
    expect(advancingLines.length).toBe(assaultDepartures.length);
  });
});

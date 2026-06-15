import { describe, it, expect } from 'vitest';
import {
  advanceTo,
  buildDispatchFeed,
  dispatchLineForEvent,
  renderCompactDigestText,
  resolveEventImportance,
} from '../src';
import { createSprint4World } from '../../shared/src/scenario-sprint4';

const SNAPSHOT_START_MS = 1_700_000_000_000;
const TWENTY_FOUR_HOURS_MS = 24 * 3_600_000;

describe('digest preservation', () => {
  it('every high-importance event line appears in compacted 24h digest', () => {
    const world = createSprint4World(SNAPSHOT_START_MS);
    const { events, world: advanced } = advanceTo(
      world,
      SNAPSHOT_START_MS + TWENTY_FOUR_HOURS_MS,
    );

    const highEvents = events.filter(
      (event) => resolveEventImportance(advanced, event) === 'high',
    );
    expect(highEvents.length).toBeGreaterThan(0);

    const digest = renderCompactDigestText(advanced, events, TWENTY_FOUR_HOURS_MS);
    const feedLines = buildDispatchFeed(advanced, highEvents, (event, w) =>
      dispatchLineForEvent(w, event),
    ).map((item) => item.line);

    for (const line of feedLines) {
      expect(digest).toContain(line);
    }
  });

  it('faction posture remains readable in compacted 24h digest', () => {
    const world = createSprint4World(SNAPSHOT_START_MS);
    const { events, world: advanced } = advanceTo(
      world,
      SNAPSHOT_START_MS + TWENTY_FOUR_HOURS_MS,
    );
    const digest = renderCompactDigestText(advanced, events, TWENTY_FOUR_HOURS_MS);
    expect(digest).toMatch(/Caesar — tick/);
    expect(digest).toMatch(/Caesar forces advancing/);
    expect(digest).toMatch(/Genghis/);
    expect(digest).toMatch(/Philip II/);
  });
});

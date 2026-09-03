import { describe, it, expect } from 'vitest';
import {
  advanceTo,
  compactDispatchFeed,
  DISPATCH_LINE_CAP,
  renderCompactDigestText,
  stampEvents,
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

  it('folds live AI influence traffic and keeps player missions individual', () => {
    const world = createSprint4World(SNAPSHOT_START_MS);
    const { events } = stampEvents(world, [
      {
        kind: 'diplomaticMissionStarted',
        at: SNAPSHOT_START_MS,
        ownerId: 'faction-rome',
        targetCityId: 'territory-london',
        expiresAt: SNAPSHOT_START_MS + 86_400_000,
        importance: 'medium',
      },
      {
        kind: 'diplomaticMissionStarted',
        at: SNAPSHOT_START_MS + 1,
        ownerId: 'faction-rome',
        targetCityId: 'territory-paris',
        expiresAt: SNAPSHOT_START_MS + 86_400_000,
        importance: 'medium',
      },
      {
        kind: 'culturalCampaignApplied',
        at: SNAPSHOT_START_MS + 2,
        ownerId: 'faction-rome',
        targetCityId: 'territory-london',
        influenceDelta: 5,
        importance: 'medium',
      },
      {
        kind: 'culturalCampaignApplied',
        at: SNAPSHOT_START_MS + 3,
        ownerId: 'faction-rome',
        targetCityId: 'territory-berlin',
        influenceDelta: 5,
        importance: 'medium',
      },
      {
        kind: 'diplomaticMissionStarted',
        at: SNAPSHOT_START_MS + 4,
        ownerId: 'faction-player',
        targetCityId: 'territory-paris',
        expiresAt: SNAPSHOT_START_MS + 86_400_000,
        importance: 'medium',
      },
      {
        kind: 'battle',
        at: SNAPSHOT_START_MS + 5,
        territoryId: 'territory-paris',
        report: {
          narrative: 'Assault on Paris',
          attackerId: 'faction-player',
          defenderId: 'faction-rome',
          attackerLosses: 0,
          defenderLosses: 1,
          attackerPower: 10,
          defenderPower: 8,
          winnerId: 'faction-player',
        },
        importance: 'high',
      },
    ]);

    const feed = compactDispatchFeed(world, events, 0);
    const lines = feed.map((item) => item.line);

    expect(lines.filter((line) => line.includes('diplomatic missions'))).toHaveLength(1);
    expect(lines.some((line) => line.includes('2 diplomatic missions'))).toBe(true);
    expect(lines.filter((line) => line.includes('cultural campaigns'))).toHaveLength(1);
    expect(lines.filter((line) => line.startsWith('DIPLOMATIC MISSION'))).toHaveLength(1);
    expect(feed.some((item) => item.event.kind === 'battle')).toBe(true);
  });

  it('leaves a single AI influence line ungrouped during live play', () => {
    const world = createSprint4World(SNAPSHOT_START_MS);
    const { events } = stampEvents(world, [
      {
        kind: 'diplomaticMissionStarted',
        at: SNAPSHOT_START_MS,
        ownerId: 'faction-rome',
        targetCityId: 'territory-london',
        expiresAt: SNAPSHOT_START_MS + 86_400_000,
        importance: 'medium',
      },
    ]);

    const feed = compactDispatchFeed(world, events, 0);
    expect(feed).toHaveLength(1);
    expect(feed[0]?.line).toMatch(/^DIPLOMATIC MISSION/);
  });
});

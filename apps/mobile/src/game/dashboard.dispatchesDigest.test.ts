import { describe, expect, it } from 'vitest';
import { createSprint4World, resolvePlayerFactionId } from 'shared';
import { stampEvents } from 'sim';
import {
  DASHBOARD_DISPATCHES_DIGEST_LIMIT,
  getDashboardDispatchesDigest,
  getDashboardUnreadDispatchCount,
} from '../game/playerView';
import { testSimEvent } from '../test/simEventFixtures';

const START_MS = 1_700_000_000_000;

describe('dashboard dispatches digest', () => {
  it('ranks high-importance dispatches ahead of routine traffic', () => {
    const world = createSprint4World(START_MS);
    const playerId = resolvePlayerFactionId(world)!;
    const { events } = stampEvents(world, [
      testSimEvent({
        kind: 'production',
        at: START_MS + 100,
        territoryId: 'territory-london',
        unitTypeId: 'levy-t1',
        count: 1,
        countryId: playerId,
        importance: 'low',
      }),
      testSimEvent({
        kind: 'battle',
        at: START_MS,
        territoryId: 'territory-paris',
        report: {
          narrative: 'Assault on Paris',
          attackerId: playerId,
          defenderId: 'faction-rome',
          attackerLosses: 0,
          defenderLosses: 1,
          attackerPower: 10,
          defenderPower: 8,
          winnerId: playerId,
        },
        importance: 'high',
      }),
    ]);

    const digest = getDashboardDispatchesDigest(world, events);
    expect(digest[0]?.eventId).toBe(events[1]?.eventId);
    expect(digest.length).toBeLessThanOrEqual(DASHBOARD_DISPATCHES_DIGEST_LIMIT);
  });

  it('counts high-importance crisis-window dispatches as unread', () => {
    const world = createSprint4World(START_MS);
    const playerId = resolvePlayerFactionId(world)!;
    const { events } = stampEvents(world, [
      testSimEvent({
        kind: 'battle',
        at: START_MS,
        territoryId: 'territory-paris',
        report: {
          narrative: 'Assault on Paris',
          attackerId: playerId,
          defenderId: 'faction-rome',
          attackerLosses: 0,
          defenderLosses: 1,
          attackerPower: 10,
          defenderPower: 8,
          winnerId: playerId,
        },
        importance: 'high',
      }),
    ]);

    expect(getDashboardUnreadDispatchCount(world, events, { atMs: 0, throughEventSerial: -1 })).toBe(1);
  });

  it('omits ambient AI influence from the dashboard digest', () => {
    const world = createSprint4World(START_MS);
    const playerId = resolvePlayerFactionId(world)!;
    const { events } = stampEvents(world, [
      testSimEvent({
        kind: 'diplomaticMissionStarted',
        at: START_MS + 10,
        ownerId: 'faction-rome',
        targetCityId: 'territory-london',
        expiresAt: START_MS + 86_400_000,
        importance: 'medium',
      }),
      testSimEvent({
        kind: 'culturalCampaignApplied',
        at: START_MS + 20,
        ownerId: 'faction-rome',
        targetCityId: 'territory-london',
        influenceDelta: 5,
        importance: 'medium',
      }),
      testSimEvent({
        kind: 'diplomaticMissionStarted',
        at: START_MS + 30,
        ownerId: playerId,
        targetCityId: 'territory-paris',
        expiresAt: START_MS + 86_400_000,
        importance: 'medium',
      }),
    ]);

    const digest = getDashboardDispatchesDigest(world, events);
    expect(digest.every((item) => item.kind !== 'culturalCampaignApplied')).toBe(true);
    expect(digest.some((item) => item.eventId === events[2]?.eventId)).toBe(true);
  });
});

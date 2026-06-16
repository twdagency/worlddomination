import { describe, expect, it } from 'vitest';
import { allianceBrokenEvent } from 'sim';
import { stampEvents } from 'sim';
import { createSprint4World } from 'shared';
import { buildDisplayDispatchFeed } from '../src/game/actions';
import { resolvePlayerFactionId } from 'shared';

const START_MS = 1_700_000_000_000;

describe('dispatch list keys', () => {
  it('uses eventId for feed keys when alliance-broken fan-out shares timestamps', () => {
    const world = createSprint4World(START_MS);
    const stamped = stampEvents(world, [
      allianceBrokenEvent('faction-rome', 'faction-steppe', START_MS),
      allianceBrokenEvent('faction-britain', 'faction-steppe', START_MS),
    ]);

    const playerId = resolvePlayerFactionId(stamped.world)!;
    const feed = buildDisplayDispatchFeed(stamped.world, stamped.events, 0);
    const keys = feed.map((item) => item.key);
    const eventIds = feed.map((item) => item.event.eventId);

    expect(keys).toEqual(eventIds);
    expect(new Set(keys).size).toBe(2);
    expect(keys.every((key) => key.startsWith('event-'))).toBe(true);

    const visibleToPlayer = feed.filter((item) =>
      item.event.kind === 'allianceBroken'
        ? item.event.breaker === playerId || item.event.betrayed === playerId
        : true,
    );
    if (visibleToPlayer.length >= 2) {
      expect(new Set(visibleToPlayer.map((item) => item.key)).size).toBe(visibleToPlayer.length);
    }
  });
});

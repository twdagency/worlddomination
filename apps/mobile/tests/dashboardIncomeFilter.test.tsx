import { describe, expect, it } from 'vitest';
import { createSprint4World, resolvePlayerFactionId } from 'shared';
import type { SimEvent } from 'sim';
import {
  dispatchLineForEvent,
  formatIncomeDispatchLine,
  hasDisplayableIncome,
  stampEvents,
} from 'sim';
import { buildDisplayDispatchFeed, formatDispatchLine } from '../src/game/actions';
import {
  getDashboardDispatchesDigest,
  getDashboardUnreadDispatchCount,
} from '../src/game/playerView';
import { testSimEvent } from '../src/test/simEventFixtures';

const START_MS = 1_700_000_000_000;

describe('dashboard income filter', () => {
  it('omits sub-displayable income events from the digest', () => {
    const world = createSprint4World(START_MS);
    const playerId = resolvePlayerFactionId(world)!;
    const { events } = stampEvents(world, [
      testSimEvent({
        kind: 'income',
        at: START_MS,
        funding: 0.0004930555555555555,
        resourcesByTerritory: {},
        importance: 'low',
      }),
      testSimEvent({
        kind: 'production',
        at: START_MS + 100,
        territoryId: 'territory-london',
        unitTypeId: 'levy-t1',
        count: 1,
        factionId: playerId,
        importance: 'low',
      }),
    ]);

    const digest = getDashboardDispatchesDigest(world, events);
    expect(digest.some((item) => item.kind === 'income')).toBe(false);
    expect(digest).toHaveLength(1);
    expect(digest[0]?.kind).toBe('production');
  });

  it('does not count sub-displayable income toward unread badge', () => {
    const world = createSprint4World(START_MS);
    const { events } = stampEvents(world, [
      testSimEvent({
        kind: 'income',
        at: START_MS,
        funding: 0.42,
        resourcesByTerritory: {},
        importance: 'low',
      }),
    ]);

    expect(
      getDashboardUnreadDispatchCount(world, events, { atMs: 0, throughEventSerial: -1 }),
    ).toBe(0);
  });

  it('renders rounded income lines through the unified formatter', () => {
    const world = createSprint4World(START_MS);
    const event = testSimEvent({
      kind: 'income',
      at: START_MS,
      funding: 44172.74999999999,
      resourcesByTerritory: {
        'territory-london': { fuel: 1296.2, steel: 864.7 },
      },
      importance: 'low',
    }) as Extract<SimEvent, { kind: 'income' }>;

    const simLine = dispatchLineForEvent(world, event, resolvePlayerFactionId(world)!);
    const mobileLine = formatDispatchLine(event, world);
    const feed = buildDisplayDispatchFeed(world, [event], 0);

    expect(simLine).toContain('+$44,172 funding');
    expect(simLine).toContain('+1296 fuel');
    expect(simLine).toContain('+864 steel');
    expect(simLine).not.toMatch(/44172\.75/);
    expect(mobileLine).toBe(simLine);
    expect(feed[0]?.line).toBe(simLine);
    expect(hasDisplayableIncome(event)).toBe(true);
    expect(formatIncomeDispatchLine(world, event)).toBe(simLine);
  });
});

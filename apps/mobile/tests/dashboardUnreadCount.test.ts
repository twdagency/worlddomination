import { describe, expect, it } from 'vitest';
import { createSprint4World, resolvePlayerFactionId } from 'shared';
import { stampEvents } from 'sim';
import { computeDispatchReadState } from '../src/game/dispatchReadState';
import { getDashboardUnreadDispatchCount } from '../src/game/playerView';
import { testSimEvent } from '../src/test/simEventFixtures';

const playerId = () => resolvePlayerFactionId(createSprint4World(500))!;

function battleEvent(at: number, factionId: string) {
  return testSimEvent({
    kind: 'battle',
    at,
    territoryId: 'territory-paris',
    report: {
      narrative: 'Assault on Paris',
      attackerId: factionId,
      defenderId: 'faction-rome',
      attackerLosses: 0,
      defenderLosses: 1,
      attackerPower: 10,
      defenderPower: 8,
      winnerId: factionId,
    },
    importance: 'high',
  });
}

function incomeEvent(at: number) {
  return testSimEvent({
    kind: 'income',
    at,
    funding: 500,
    resourcesByTerritory: {},
    importance: 'low',
  });
}

describe('getDashboardUnreadDispatchCount', () => {
  it('returns 0 when there are no dispatches', () => {
    const world = createSprint4World(500);
    expect(getDashboardUnreadDispatchCount(world, [], { atMs: 0, throughEventSerial: -1 })).toBe(0);
  });

  it('counts all high-importance dispatches when read state is default', () => {
    const world = createSprint4World(500);
    const pid = playerId();
    const { events } = stampEvents(world, [
      battleEvent(100, pid),
      battleEvent(200, pid),
      battleEvent(300, pid),
    ]);

    expect(getDashboardUnreadDispatchCount(world, events, { atMs: 0, throughEventSerial: -1 })).toBe(3);
  });

  it('counts only dispatches after read state atMs', () => {
    const world = createSprint4World(500);
    const pid = playerId();
    const { events } = stampEvents(world, [
      battleEvent(100, pid),
      battleEvent(200, pid),
      battleEvent(300, pid),
    ]);

    expect(getDashboardUnreadDispatchCount(world, events, { atMs: 250, throughEventSerial: -1 })).toBe(1);
  });

  it('returns 0 when all dispatches are before read state', () => {
    const world = createSprint4World(500);
    const pid = playerId();
    const { events } = stampEvents(world, [
      battleEvent(100, pid),
      battleEvent(200, pid),
      battleEvent(300, pid),
    ]);

    expect(getDashboardUnreadDispatchCount(world, events, { atMs: 300, throughEventSerial: -1 })).toBe(0);
    expect(getDashboardUnreadDispatchCount(world, events, { atMs: 500, throughEventSerial: -1 })).toBe(0);
  });

  it('does not count low-importance dispatches toward the badge', () => {
    const world = createSprint4World(500);
    const pid = playerId();
    const { events } = stampEvents(world, [
      incomeEvent(100),
      battleEvent(200, pid),
      incomeEvent(300),
    ]);

    expect(getDashboardUnreadDispatchCount(world, events, { atMs: 0, throughEventSerial: -1 })).toBe(1);
  });

  it('returns 0 after read state passes all current dispatches', () => {
    const world = createSprint4World(500);
    const pid = playerId();
    const { events } = stampEvents(world, [battleEvent(100, pid), battleEvent(200, pid)]);

    expect(getDashboardUnreadDispatchCount(world, events, { atMs: 0, throughEventSerial: -1 })).toBe(2);
    expect(getDashboardUnreadDispatchCount(world, events, { atMs: 250, throughEventSerial: -1 })).toBe(0);
  });

  it('clears unread when lastViewed uses sim time ahead of wall clock', () => {
    const wallNow = 1_700_000_000_000;
    const simNow = wallNow + 32 * 3_600_000;
    const world = createSprint4World(simNow);
    const pid = resolvePlayerFactionId(world)!;
    const { events } = stampEvents(world, [battleEvent(simNow, pid)]);

    expect(getDashboardUnreadDispatchCount(world, events, { atMs: wallNow, throughEventSerial: -1 })).toBe(1);
    expect(getDashboardUnreadDispatchCount(world, events, { atMs: simNow, throughEventSerial: -1 })).toBe(0);
  });

  it('shows badge for same-ms departure issued after dashboard mark', () => {
    const world = createSprint4World(1_000);
    const read = computeDispatchReadState(1_000, []);
    const { events } = stampEvents(world, [
      {
        kind: 'departure',
        at: 1_000,
        unitId: 'unit-1',
        fromTerritoryId: 'territory-london',
        toTerritoryId: 'territory-paris',
        ownerId: playerId(),
        unitTypeId: 'levy-t1',
        count: 1,
        stanceOnArrival: 'assault',
        intent: 'attack',
        source: 'direct',
        beatId: 'beat-1',
        decisionTickMs: 1_000,
        importance: 'high',
      },
    ]);

    expect(getDashboardUnreadDispatchCount(world, events, read)).toBe(1);
  });
});

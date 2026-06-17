import { describe, expect, it } from 'vitest';
import { createSprint4World, resolvePlayerFactionId } from 'shared';
import { stampEvents } from 'sim';
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
    expect(getDashboardUnreadDispatchCount(world, [], 0)).toBe(0);
  });

  it('counts all high-importance dispatches when lastViewedAt is 0', () => {
    const world = createSprint4World(500);
    const pid = playerId();
    const { events } = stampEvents(world, [
      battleEvent(100, pid),
      battleEvent(200, pid),
      battleEvent(300, pid),
    ]);

    expect(getDashboardUnreadDispatchCount(world, events, 0)).toBe(3);
  });

  it('counts only dispatches after lastViewedAt', () => {
    const world = createSprint4World(500);
    const pid = playerId();
    const { events } = stampEvents(world, [
      battleEvent(100, pid),
      battleEvent(200, pid),
      battleEvent(300, pid),
    ]);

    expect(getDashboardUnreadDispatchCount(world, events, 250)).toBe(1);
  });

  it('returns 0 when all dispatches are at or before lastViewedAt', () => {
    const world = createSprint4World(500);
    const pid = playerId();
    const { events } = stampEvents(world, [
      battleEvent(100, pid),
      battleEvent(200, pid),
      battleEvent(300, pid),
    ]);

    expect(getDashboardUnreadDispatchCount(world, events, 300)).toBe(0);
    expect(getDashboardUnreadDispatchCount(world, events, 500)).toBe(0);
  });

  it('does not count low-importance dispatches toward the badge', () => {
    const world = createSprint4World(500);
    const pid = playerId();
    const { events } = stampEvents(world, [
      incomeEvent(100),
      battleEvent(200, pid),
      incomeEvent(300),
    ]);

    expect(getDashboardUnreadDispatchCount(world, events, 0)).toBe(1);
  });

  it('returns 0 after lastViewedAt passes all current dispatches', () => {
    const world = createSprint4World(500);
    const pid = playerId();
    const { events } = stampEvents(world, [battleEvent(100, pid), battleEvent(200, pid)]);

    expect(getDashboardUnreadDispatchCount(world, events, 0)).toBe(2);
    expect(getDashboardUnreadDispatchCount(world, events, 250)).toBe(0);
  });
});

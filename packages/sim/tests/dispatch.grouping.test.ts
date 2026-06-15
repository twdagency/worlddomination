import { describe, it, expect } from 'vitest';
import { buildDispatchFeed, computeBeatId, groupEventsByBeat } from '../src/dispatch';
import { LONDON, PARIS, makeWorld } from './fixtures';
import type { SimEvent, WorldState } from '../src/types';

function withSteppe(world: WorldState): WorldState {
  return {
    ...world,
    factions: {
      ...world.factions,
      'faction-steppe': {
        id: 'faction-steppe',
        leaderId: 'leader-genghis',
        isPlayer: false,
        funding: 20_000,
        manpower: 8_000,
        manpowerCap: 15_000,
      },
      'faction-rome': {
        id: 'faction-rome',
        leaderId: 'leader-caesar',
        isPlayer: false,
        funding: 22_000,
        manpower: 9_000,
        manpowerCap: 18_000,
      },
    },
  };
}

describe('dispatch beat grouping', () => {
  const world = withSteppe(makeWorld());
  const decisionTickMs = world.nowMs;
  const beatId = computeBeatId('faction-steppe', decisionTickMs);

  const shared = {
    beatId,
    decisionTickMs,
    intent: 'attack' as const,
    source: 'direct' as const,
  };

  const departure: SimEvent = {
    kind: 'departure',
    at: world.nowMs,
    unitId: 'unit-1',
    fromTerritoryId: LONDON.id,
    toTerritoryId: PARIS.id,
    ownerId: 'faction-steppe',
    unitTypeId: 'mg-armor-t5',
    count: 8,
    stanceOnArrival: 'assault',
    ...shared,
  };

  const buildStarted: SimEvent = {
    kind: 'buildStarted',
    at: world.nowMs,
    territoryId: PARIS.id,
    factionId: 'faction-steppe',
    unitTypeId: 'levy-t1',
    count: 1,
    intent: 'build',
    beatId: computeBeatId('faction-rome', decisionTickMs),
    decisionTickMs,
    source: 'direct' as const,
  };

  it('groups events sharing beatId under one header', () => {
    const arrival: SimEvent = {
      kind: 'arrival',
      at: world.nowMs,
      unitId: 'unit-1',
      territoryId: PARIS.id,
      ownerId: 'faction-steppe',
      unitTypeId: 'mg-armor-t5',
      count: 8,
      stanceOnArrival: 'assault',
      fromTerritoryId: LONDON.id,
      ...shared,
    };
    const events = [departure, arrival];
    const groups = groupEventsByBeat(world, events);
    expect(groups).toHaveLength(1);
    expect(groups[0].events).toHaveLength(2);
    expect(groups[0].header).toContain('Genghis');
  });

  it('renders one header for the first row of a beat in the feed', () => {
    const events = [departure, buildStarted];
    const feed = buildDispatchFeed(world, events);
    const headers = feed.filter((item) => item.header).map((item) => item.header);
    expect(headers).toHaveLength(2);
    expect(feed[0].header).toBeDefined();
    expect(feed[1].header).toBeDefined();
  });

  it('computeBeatId is stable for faction + tick + source', () => {
    expect(computeBeatId('faction-steppe', decisionTickMs)).toBe(beatId);
    expect(computeBeatId('faction-steppe', decisionTickMs + 1)).not.toBe(beatId);
    expect(computeBeatId('faction-rome', decisionTickMs)).not.toBe(beatId);
    expect(computeBeatId('faction-steppe', decisionTickMs, 'scout')).not.toBe(beatId);
  });

  it('direct and scout beats group separately at the same tick', () => {
    const scoutReport: SimEvent = {
      kind: 'intelReport',
      at: world.nowMs,
      observerFaction: 'faction-steppe',
      territoryId: PARIS.id,
      source: 'scout',
      variant: 'activity',
      subjectFactionId: 'faction-rome',
      intent: 'defend',
      beatId: computeBeatId('faction-steppe', decisionTickMs, 'scout'),
      decisionTickMs,
    };
    const groups = groupEventsByBeat(world, [departure, scoutReport]);
    expect(groups).toHaveLength(2);
  });
});

import { describe, it, expect } from 'vitest';
import { advanceTo, computeStance, orderIntentsInWindow, STANCE_WINDOW_MS } from '../src';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import type { SimEvent, WorldState } from '../src';

const AS_OF = 1_700_000_000_000;
const BEAT = { beatId: 'abc', decisionTickMs: AS_OF, source: 'direct' as const };

function emptyWorld(): WorldState {
  return createSprint4World(AS_OF);
}

function departure(
  ownerId: string,
  intent: 'attack' | 'defend' | 'expand',
  at: number = AS_OF,
): SimEvent {
  return {
    kind: 'departure',
    at,
    unitId: 'u1',
    fromTerritoryId: 't1',
    toTerritoryId: 't2',
    ownerId,
    unitTypeId: 'mg-armor-t5',
    count: 1,
    stanceOnArrival: intent === 'attack' ? 'assault' : intent === 'expand' ? 'secure' : 'hold',
    intent,
    ...BEAT,
  };
}

function buildStarted(factionId: string, at: number = AS_OF): SimEvent {
  return {
    kind: 'buildStarted',
    at,
    territoryId: 't1',
    countryId: factionId,
    unitTypeId: 'mg-armor-t5',
    count: 1,
    intent: 'build',
    ...BEAT,
  };
}

describe('computeStance', () => {
  const world = emptyWorld();

  it('returns Quiet when no orders appear in the window', () => {
    expect(computeStance(world, 'faction-caesar', [], AS_OF)).toBe('Quiet');
  });

  it('returns Hostile when attack intents are a majority', () => {
    const events = [
      departure('faction-caesar', 'attack', AS_OF - 1_000),
      departure('faction-caesar', 'attack', AS_OF - 2_000),
      departure('faction-caesar', 'defend', AS_OF - 3_000),
    ];
    expect(computeStance(world, 'faction-caesar', events, AS_OF)).toBe('Hostile');
  });

  it('returns Defensive when defend intents are a majority', () => {
    const events = [
      departure('faction-genghis', 'defend', AS_OF - 1_000),
      departure('faction-genghis', 'defend', AS_OF - 2_000),
      departure('faction-genghis', 'attack', AS_OF - 3_000),
    ];
    expect(computeStance(world, 'faction-genghis', events, AS_OF)).toBe('Defensive');
  });

  it('returns Developing when build and expand intents are a majority', () => {
    const events = [
      buildStarted('faction-elizabeth', AS_OF - 1_000),
      buildStarted('faction-elizabeth', AS_OF - 2_000),
      departure('faction-elizabeth', 'expand', AS_OF - 3_000),
      departure('faction-elizabeth', 'attack', AS_OF - 4_000),
    ];
    expect(computeStance(world, 'faction-elizabeth', events, AS_OF)).toBe('Developing');
  });

  it('returns Active when no intent category holds a majority', () => {
    const events = [
      departure('faction-caesar', 'attack', AS_OF - 1_000),
      departure('faction-caesar', 'defend', AS_OF - 2_000),
      buildStarted('faction-caesar', AS_OF - 3_000),
    ];
    expect(computeStance(world, 'faction-caesar', events, AS_OF)).toBe('Active');
  });

  it('ignores events outside the recent window', () => {
    const events = [
      departure('faction-caesar', 'attack', AS_OF - STANCE_WINDOW_MS - 1_000),
      departure('faction-caesar', 'defend', AS_OF - 1_000),
    ];
    expect(computeStance(world, 'faction-caesar', events, AS_OF)).toBe('Defensive');
    expect(orderIntentsInWindow(events, 'faction-caesar', AS_OF, STANCE_WINDOW_MS)).toEqual(['defend']);
  });

  it('matches intuitive 24h sprint4 reads from emitted orders', () => {
    const start = 1_700_000_000_000;
    const { events, world: advanced } = advanceTo(world, start + STANCE_WINDOW_MS);
    expect(computeStance(advanced, 'faction-rome', events, advanced.nowMs)).toBe('Hostile');
    expect(computeStance(advanced, 'faction-steppe', events, advanced.nowMs)).toBe('Developing');
    expect(computeStance(advanced, 'faction-britain', events, advanced.nowMs)).toBe('Developing');
  });
});

import { describe, expect, it } from 'vitest';
import { createSprint4World } from 'shared';
import { stampEvents } from 'sim';
import {
  computeDispatchReadState,
  DEFAULT_DISPATCH_READ_STATE,
  dispatchEventSerial,
  isDispatchUnreadSince,
  parseDispatchReadState,
  serializeDispatchReadState,
} from './dispatchReadState';

const departureDraft = {
  kind: 'departure' as const,
  at: 1_000,
  unitId: 'unit-1',
  fromTerritoryId: 'territory-london',
  toTerritoryId: 'territory-paris',
  ownerId: 'faction-player',
  unitTypeId: 'levy-t1',
  count: 1,
  stanceOnArrival: 'assault' as const,
  intent: 'attack' as const,
  source: 'direct' as const,
  beatId: 'beat-1',
  decisionTickMs: 1_000,
  importance: 'high' as const,
};

describe('dispatchReadState', () => {
  it('treats same-ms departures after mark as unread via event serial', () => {
    const world = createSprint4World(1_000);
    const read = computeDispatchReadState(1_000, []);
    const { events } = stampEvents(world, [departureDraft]);

    expect(isDispatchUnreadSince(events[0]!, read)).toBe(true);
    expect(isDispatchUnreadSince(events[0]!, DEFAULT_DISPATCH_READ_STATE)).toBe(true);
  });

  it('marks same-ms dispatches read when included in computeDispatchReadState', () => {
    const world = createSprint4World(1_000);
    const { events } = stampEvents(world, [departureDraft]);
    const read = computeDispatchReadState(1_000, events);
    expect(isDispatchUnreadSince(events[0]!, read)).toBe(false);
  });

  it('round-trips storage and parses legacy plain-ms values', () => {
    const read = { atMs: 1_700_000_000_000, throughEventSerial: 42 };
    expect(parseDispatchReadState(serializeDispatchReadState(read))).toEqual(read);
    expect(parseDispatchReadState(String(read.atMs))).toEqual({
      atMs: read.atMs,
      throughEventSerial: -1,
    });
  });

  it('parses event serial from event ids', () => {
    expect(dispatchEventSerial('event-11')).toBe(11);
    expect(dispatchEventSerial('legacy-0')).toBe(-1);
  });
});

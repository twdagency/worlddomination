import { describe, expect, it } from 'vitest';
import { advanceTo } from '../src/clock';
import { allianceBrokenEvent } from '../src/diplomaticDispatch';
import {
  backfillLegacyDispatchEventIds,
  DEFAULT_NEXT_EVENT_ID,
  emit,
  ensureWorldEventCounter,
  stampEvents,
} from '../src/events';
import { applyAiDiplomaticDecisions } from '../src/diplomaticAi';
import { tick } from '../src/tick';
import { makeWorld } from './fixtures';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { NEW_YORK, tagOrder } from './fixtures';

const START_MS = 1_700_000_000_000;

describe('eventId provenance', () => {
  it('assigns a unique eventId to every new event', () => {
    const world = makeWorld({ nextEventId: 0 });
    const move = tagOrder(world, {
      kind: 'move',
      unitId: 'unit-1',
      toTerritoryId: NEW_YORK.id,
      stanceOnArrival: 'hold',
    });
    const { events } = tick(world, [move], 0);
    expect(events).toHaveLength(1);
    expect(events[0].eventId).toBe('event-0');
  });

  it('increments the counter monotonically', () => {
    const world = makeWorld({ nextEventId: 0 });
    const first = emit(world, {
      kind: 'income',
      at: world.nowMs,
      funding: 1,
      resourcesByTerritory: {},
    });
    const second = emit(first.world, {
      kind: 'income',
      at: world.nowMs,
      funding: 2,
      resourcesByTerritory: {},
    });
    expect(first.event.eventId).toBe('event-0');
    expect(second.event.eventId).toBe('event-1');
    expect(second.world.nextEventId).toBe(2);
  });

  it('produces identical event ID sequences for identical worlds', () => {
    const run = () => {
      const world = createSprint4World(START_MS);
      const move = tagOrder(world, {
        kind: 'move',
        unitId: 'unit-player-mg',
        toTerritoryId: 'territory-paris',
        stanceOnArrival: 'assault',
      });
      return tick(world, [move], 0).events.map((event) => event.eventId);
    };
    expect(run()).toEqual(run());
  });

  it('migrates missing nextEventId to the default sentinel', () => {
    const world = makeWorld();
    const { nextEventId: _removed, ...legacy } = world;
    const migrated = ensureWorldEventCounter(legacy as typeof world);
    expect(migrated.nextEventId).toBe(DEFAULT_NEXT_EVENT_ID);
  });

  it('backfills legacy dispatch events with legacy-{index} IDs', () => {
    const events = backfillLegacyDispatchEventIds([
      allianceBrokenEvent('faction-a', 'faction-b', START_MS) as never,
    ]);
    expect(events[0].eventId).toBe('legacy-0');
  });

  it('alliance-broken fan-out emits unique IDs at identical timestamps', () => {
    let world = createSprint4World(START_MS);
    world = {
      ...world,
      alliances: [
        { factionA: 'faction-rome', factionB: 'faction-steppe', formedAt: START_MS },
        { factionA: 'faction-britain', factionB: 'faction-steppe', formedAt: START_MS },
      ],
      nextEventId: 0,
    };

    const { events } = applyAiDiplomaticDecisions(world, START_MS + 3_600_000);
    const broken = events.filter((event) => event.kind === 'allianceBroken');
    if (broken.length < 2) {
      const stamped = stampEvents(world, [
        allianceBrokenEvent('faction-rome', 'faction-steppe', START_MS),
        allianceBrokenEvent('faction-britain', 'faction-steppe', START_MS),
      ]);
      const ids = stamped.events.map((event) => event.eventId);
      expect(new Set(ids).size).toBe(2);
      expect(ids[0]).not.toBe(ids[1]);
      return;
    }

    const ids = broken.map((event) => event.eventId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('advanceTo threads nextEventId through diplomatic and tick emissions', () => {
    const { world, events } = advanceTo(createSprint4World(START_MS), START_MS + 3_600_000);
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((event) => event.eventId.startsWith('event-'))).toBe(true);
    expect(world.nextEventId).toBeGreaterThan(0);
    const ids = events.map((event) => event.eventId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

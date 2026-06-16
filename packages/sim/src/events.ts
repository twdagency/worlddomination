import type { Id, SimEvent, SimEventBase, SimEventDraft, WorldState } from './types';

/** Starting counter for migrated saves — avoids collision with legacy backfill IDs. */
export const DEFAULT_NEXT_EVENT_ID = 1_000_000;

export const LEGACY_EVENT_ID_PREFIX = 'legacy-';

export function nextEventId(world: WorldState): { world: WorldState; eventId: Id } {
  const counter = world.nextEventId ?? 0;
  const eventId = `event-${counter}`;
  return {
    world: { ...world, nextEventId: counter + 1 },
    eventId,
  };
}

export function emit<T extends SimEventDraft>(
  world: WorldState,
  event: T,
): { world: WorldState; event: SimEventBase & T } {
  const { world: stampedWorld, eventId } = nextEventId(world);
  return { world: stampedWorld, event: { ...event, eventId } };
}

export function stampEvents(
  world: WorldState,
  events: Array<SimEventDraft | SimEvent>,
): { world: WorldState; events: SimEvent[] } {
  let current = world;
  const stamped: SimEvent[] = [];

  for (const event of events) {
    if ('eventId' in event && event.eventId) {
      stamped.push(event as SimEvent);
      continue;
    }
    const result = emit(current, event as SimEventDraft);
    current = result.world;
    stamped.push(result.event);
  }

  return { world: current, events: stamped };
}

/** Backfill counter on saves created before Sprint 7c. */
export function ensureWorldEventCounter(world: WorldState): WorldState {
  if (world.nextEventId !== undefined) return world;
  return { ...world, nextEventId: DEFAULT_NEXT_EVENT_ID };
}

/** Best-effort IDs for display-only events persisted before Sprint 7c. */
export function backfillLegacyDispatchEventIds(events: SimEvent[]): SimEvent[] {
  return events.map((event, index) => {
    if (event.eventId) return event;
    return { ...event, eventId: `${LEGACY_EVENT_ID_PREFIX}${index}` };
  });
}

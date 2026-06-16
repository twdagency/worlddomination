import type { SimEvent, SimEventDraft } from 'sim';

let counter = 0;

export function testSimEvent(draft: SimEventDraft): SimEvent {
  counter += 1;
  return { ...draft, eventId: `test-event-${counter}` };
}

export function resetTestSimEventIds(): void {
  counter = 0;
}

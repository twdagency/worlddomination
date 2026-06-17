import type { Millis, SimEvent } from 'sim';

export interface DispatchReadState {
  atMs: Millis;
  throughEventSerial: number;
}

export const DEFAULT_DISPATCH_READ_STATE: DispatchReadState = {
  atMs: 0,
  throughEventSerial: -1,
};

export function dispatchEventSerial(eventId: string): number {
  if (!eventId.startsWith('event-')) return -1;
  const serial = Number(eventId.slice('event-'.length));
  return Number.isFinite(serial) ? serial : -1;
}

export function isDispatchUnreadSince(
  event: SimEvent & { at: number },
  read: DispatchReadState,
): boolean {
  if (event.at < read.atMs) return false;
  if (event.at > read.atMs) return true;
  return dispatchEventSerial(event.eventId) > read.throughEventSerial;
}

export function computeDispatchReadState(
  worldNowMs: Millis,
  dispatches: SimEvent[],
): DispatchReadState {
  let atMs = worldNowMs;
  let throughEventSerial = -1;
  for (const event of dispatches) {
    if ('at' in event && typeof event.at === 'number') {
      atMs = Math.max(atMs, event.at);
    }
    throughEventSerial = Math.max(throughEventSerial, dispatchEventSerial(event.eventId));
  }
  return { atMs, throughEventSerial };
}

export function parseDispatchReadState(raw: string | null): DispatchReadState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<DispatchReadState>;
    if (typeof parsed.atMs === 'number' && typeof parsed.throughEventSerial === 'number') {
      return { atMs: parsed.atMs, throughEventSerial: parsed.throughEventSerial };
    }
  } catch {
    // Legacy plain-ms string — fall through.
  }
  const legacyMs = Number.parseInt(raw, 10);
  if (!Number.isFinite(legacyMs)) return null;
  return { atMs: legacyMs, throughEventSerial: -1 };
}

export function serializeDispatchReadState(read: DispatchReadState): string {
  return JSON.stringify(read);
}

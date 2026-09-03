import type { Id, Millis, OrderIntent, SimEvent, WorldState } from './types';

export type FactionStance = 'Hostile' | 'Defensive' | 'Developing' | 'Active' | 'Quiet';

export const STANCE_WINDOW_MS = 24 * 60 * 60 * 1000;

const ORDER_EVENT_KINDS = new Set<SimEvent['kind']>(['departure', 'buildStarted', 'infraUpgraded']);

function factionIdForOrderEvent(event: SimEvent): Id | undefined {
  if (event.kind === 'departure') return event.ownerId;
  if (event.kind === 'buildStarted' || event.kind === 'infraUpgraded') return event.countryId;
  return undefined;
}

function intentForOrderEvent(event: SimEvent): OrderIntent | undefined {
  if (!ORDER_EVENT_KINDS.has(event.kind)) return undefined;
  if ('intent' in event) return event.intent;
  return undefined;
}

/** Collect order intents emitted by `factionId` within `[asOfMs - windowMs, asOfMs]`. */
export function orderIntentsInWindow(
  events: SimEvent[],
  factionId: Id,
  asOfMs: Millis,
  windowMs: number,
): OrderIntent[] {
  const start = asOfMs - windowMs;
  const intents: OrderIntent[] = [];

  for (const event of events) {
    if (!('at' in event) || event.at < start || event.at > asOfMs) continue;
    if (!ORDER_EVENT_KINDS.has(event.kind)) continue;
    if (factionIdForOrderEvent(event) !== factionId) continue;
    const intent = intentForOrderEvent(event);
    if (intent) intents.push(intent);
  }

  return intents;
}

/**
 * Read-only posture label from observable order emissions only.
 * Does not inspect AI scoring or hidden state.
 */
export function computeStance(
  _world: WorldState,
  factionId: Id,
  events: SimEvent[],
  asOfMs: Millis,
  recentWindowMs: number = STANCE_WINDOW_MS,
): FactionStance {
  const intents = orderIntentsInWindow(events, factionId, asOfMs, recentWindowMs);
  if (intents.length === 0) return 'Quiet';

  let hostile = 0;
  let defensive = 0;
  let developing = 0;

  for (const intent of intents) {
    if (intent === 'attack') hostile += 1;
    else if (intent === 'defend') defensive += 1;
    else developing += 1; // build + expand
  }

  const total = intents.length;
  if (hostile > total / 2) return 'Hostile';
  if (defensive > total / 2) return 'Defensive';
  if (developing > total / 2) return 'Developing';
  return 'Active';
}

export function stanceLabel(stance: FactionStance): string {
  return stance;
}

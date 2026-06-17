import {
  canBuild,
  dispatchLineForEvent,
  filterDispatchesForFaction,
  formatBuildBlockedMessage,
  type SimEvent,
  type TransitOrder,
  type WorldState,
} from 'sim';
import { formatDispatchLine } from './actions';
import { resolvePlayerFactionId } from 'shared';

export type ActionKind =
  | 'move'
  | 'build'
  | 'upgradeInfra'
  | 'proposeAlliance'
  | 'proposeTreaty'
  | 'breakAlliance'
  | 'acceptProposal'
  | 'declineProposal';

export type ToastTone = 'success' | 'error' | 'info';

export interface ActionFeedbackContext {
  unitId?: string;
  fromTerritoryId?: string;
  toTerritoryId?: string;
  stanceOnArrival?: TransitOrder['stanceOnArrival'];
  territoryId?: string;
  unitTypeId?: string;
  count?: number;
  targetFactionId?: string;
  allyFactionId?: string;
  proposalId?: string;
  moveEtaMs?: number;
  /** Pre-sim validation message when the action never reaches the sim. */
  blockedMessage?: string;
}

export interface InlineFeedback {
  summary: string;
  isError: boolean;
  territoryId?: string;
  factionId?: string;
  unitId?: string;
}

export interface ActionFeedback {
  action: ActionKind;
  success: boolean;
  toastMessage: string;
  toastTone: ToastTone;
  inline: InlineFeedback;
  /** Events merged into the dispatch log for this action. */
  dispatchEvents: SimEvent[];
}

function territoryLabel(world: WorldState, territoryId: string | undefined): string {
  if (!territoryId) return 'Unknown';
  return world.territories[territoryId]?.name ?? territoryId;
}

function leaderLabel(world: WorldState, factionId: string | undefined): string {
  if (!factionId) return 'Unknown';
  const leaderId = world.factions[factionId]?.leaderId;
  return world.leaders[leaderId ?? '']?.name ?? factionId;
}

function playerVisibleEvents(world: WorldState, events: SimEvent[]): SimEvent[] {
  const playerId = resolvePlayerFactionId(world);
  if (!playerId) return [];
  return filterDispatchesForFaction(world, events, playerId);
}

function primaryDispatchLine(world: WorldState, events: SimEvent[]): string | null {
  const visible = playerVisibleEvents(world, events);
  if (visible.length === 0) return null;
  const event = visible[visible.length - 1];
  return formatDispatchLine(event, world);
}

function toneForEventKind(kind: SimEvent['kind']): ToastTone {
  if (kind === 'buildBlocked' || kind === 'orderRejected') return 'error';
  if (
    kind === 'allianceDeclined' ||
    kind === 'treatyDeclined' ||
    kind === 'allianceBroken'
  ) {
    return 'info';
  }
  return 'success';
}

function buildMoveFeedback(
  world: WorldState,
  events: SimEvent[],
  context: ActionFeedbackContext,
): ActionFeedback {
  const departure = events.find((event) => event.kind === 'departure');
  const from = territoryLabel(world, context.fromTerritoryId);
  const to = territoryLabel(world, context.toTerritoryId);
  const etaLabel = context.moveEtaMs
    ? new Date(context.moveEtaMs).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'soon';

  if (departure) {
    const summary = `Forces moving from ${from} to ${to}, ETA ${etaLabel}`;
    return {
      action: 'move',
      success: true,
      toastMessage: summary,
      toastTone: 'success',
      inline: {
        summary,
        isError: false,
        unitId: context.unitId,
        territoryId: context.toTerritoryId,
      },
      dispatchEvents: playerVisibleEvents(world, events),
    };
  }

  const rejected = events.find((event) => event.kind === 'orderRejected');
  if (rejected && rejected.kind === 'orderRejected') {
    const summary =
      primaryDispatchLine(world, events) ?? `Cannot issue order — ${from} to ${to}`;
    return {
      action: 'move',
      success: false,
      toastMessage: summary.replace(/^REJECTED — /, 'Cannot complete order — '),
      toastTone: 'error',
      inline: {
        summary,
        isError: true,
        unitId: context.unitId,
        territoryId: context.toTerritoryId,
      },
      dispatchEvents: playerVisibleEvents(world, events),
    };
  }

  const fallback = primaryDispatchLine(world, events) ?? `Cannot issue order — ${from} to ${to}`;
  return {
    action: 'move',
    success: false,
    toastMessage: fallback,
    toastTone: 'error',
    inline: {
      summary: fallback,
      isError: true,
      unitId: context.unitId,
    },
    dispatchEvents: playerVisibleEvents(world, events),
  };
}

function buildProductionFeedback(
  world: WorldState,
  events: SimEvent[],
  context: ActionFeedbackContext,
  action: 'build' | 'upgradeInfra',
): ActionFeedback {
  const blocked = events.find((event) => event.kind === 'buildBlocked');
  if (blocked && blocked.kind === 'buildBlocked') {
    const message = blocked.reason.startsWith('BLOCKED')
      ? blocked.reason.replace(/^BLOCKED — /, '')
      : blocked.reason;
    const toastMessage = `Cannot complete action — ${message}`;
    return {
      action,
      success: false,
      toastMessage,
      toastTone: 'error',
      inline: {
        summary: toastMessage,
        isError: true,
        territoryId: context.territoryId,
      },
      dispatchEvents: playerVisibleEvents(world, events),
    };
  }

  const started = events.find(
    (event) => event.kind === 'buildStarted' || event.kind === 'infraUpgraded',
  );
  if (started) {
    const toastMessage = primaryDispatchLine(world, events) ?? 'Action recorded';
    return {
      action,
      success: true,
      toastMessage,
      toastTone: 'success',
      inline: {
        summary: toastMessage,
        isError: false,
        territoryId: context.territoryId,
      },
      dispatchEvents: playerVisibleEvents(world, events),
    };
  }

  const toastMessage = primaryDispatchLine(world, events) ?? 'Action could not be completed';
  return {
    action,
    success: false,
    toastMessage,
    toastTone: 'error',
    inline: {
      summary: toastMessage,
      isError: true,
      territoryId: context.territoryId,
    },
    dispatchEvents: playerVisibleEvents(world, events),
  };
}

function buildDiplomacyFeedback(
  world: WorldState,
  events: SimEvent[],
  action: Extract<
    ActionKind,
    | 'proposeAlliance'
    | 'proposeTreaty'
    | 'breakAlliance'
    | 'acceptProposal'
    | 'declineProposal'
  >,
  context: ActionFeedbackContext,
): ActionFeedback {
  const visible = playerVisibleEvents(world, events);
  const primary = visible[visible.length - 1];
  const factionId = context.targetFactionId ?? context.allyFactionId;

  if (!primary) {
    const message =
      context.blockedMessage ??
      `${leaderLabel(world, factionId)} — no diplomatic change recorded`;
    return {
      action,
      success: false,
      toastMessage: message,
      toastTone: 'info',
      inline: { summary: message, isError: true, factionId },
      dispatchEvents: visible,
    };
  }

  const playerId = resolvePlayerFactionId(world);
  const toastMessage = dispatchLineForEvent(world, primary, playerId);
  const success = !(
    primary.kind === 'allianceDeclined' ||
    primary.kind === 'treatyDeclined'
  );

  return {
    action,
    success,
    toastMessage,
    toastTone: toneForEventKind(primary.kind),
    inline: {
      summary: toastMessage,
      isError: !success,
      factionId,
    },
    dispatchEvents: visible,
  };
}

/** Pure feedback derivation for toast, inline, and dispatch layers. */
export function buildActionFeedback(
  action: ActionKind,
  world: WorldState,
  events: SimEvent[],
  context: ActionFeedbackContext = {},
): ActionFeedback {
  if (context.blockedMessage) {
    return {
      action,
      success: false,
      toastMessage: context.blockedMessage,
      toastTone: 'error',
      inline: {
        summary: context.blockedMessage,
        isError: true,
        territoryId: context.territoryId,
        factionId: context.targetFactionId ?? context.allyFactionId,
        unitId: context.unitId,
      },
      dispatchEvents: [],
    };
  }

  switch (action) {
    case 'move':
      return buildMoveFeedback(world, events, context);
    case 'build':
      return buildProductionFeedback(world, events, context, 'build');
    case 'upgradeInfra':
      return buildProductionFeedback(world, events, context, 'upgradeInfra');
    case 'proposeAlliance':
    case 'proposeTreaty':
    case 'breakAlliance':
    case 'acceptProposal':
    case 'declineProposal':
      return buildDiplomacyFeedback(world, events, action, context);
  }
}

/** Client-side build validation before hitting the sim (mirrors TerritoryScreen checks). */
export function previewBuildBlockedMessage(
  world: WorldState,
  territoryId: string,
  unitTypeId: string,
  count: number = 1,
): string | undefined {
  const playerId = resolvePlayerFactionId(world);
  if (!playerId) return 'No player faction';
  const check = canBuild(world, territoryId, unitTypeId, count, playerId);
  if (check.ok) return undefined;
  const unitType = world.unitTypes[unitTypeId];
  return formatBuildBlockedMessage(unitType, check.reason);
}

export interface ActionFeedbackDispatchInput {
  action: ActionKind;
  priorWorld: WorldState;
  nextWorld: WorldState;
  events: SimEvent[];
  context?: ActionFeedbackContext;
  showToast: (message: string, tone?: ToastTone) => void;
}

export interface ActionFeedbackDispatchResult {
  world: WorldState;
  dispatches: SimEvent[];
  feedback: ActionFeedback;
}

/**
 * Three-layer action feedback dispatcher.
 * Toast via callback; inline returned in feedback; dispatch events merged into the log.
 */
export function dispatchActionFeedback(
  input: ActionFeedbackDispatchInput,
  mergeDispatches: (
    world: WorldState,
    existing: SimEvent[],
    incoming: SimEvent[],
  ) => SimEvent[],
  existingDispatches: SimEvent[],
): ActionFeedbackDispatchResult {
  const feedback = buildActionFeedback(
    input.action,
    input.nextWorld,
    input.events,
    input.context,
  );

  input.showToast(feedback.toastMessage, feedback.toastTone);

  const merged = mergeDispatches(input.nextWorld, existingDispatches, input.events);

  return {
    world: input.nextWorld,
    dispatches: merged,
    feedback,
  };
}

import { getDilemmaById, playerFactionId } from 'sim';
import type { Id, WorldState } from 'sim';
import type { Dilemma, DilemmaUrgency } from 'shared';

export interface DilemmaModalState {
  visible: boolean;
  dilemmaId: Id | null;
  urgency: DilemmaUrgency | null;
  dilemmaSnapshot: Dilemma | null;
  canDismiss: boolean;
  blocksNavigation: boolean;
}

export interface DilemmaModalCandidate {
  dilemmaId: Id;
  urgency: Exclude<DilemmaUrgency, 'background'>;
}

const URGENCY_RANK: Record<Exclude<DilemmaUrgency, 'background'>, number> = {
  crisis: 0,
  standard: 1,
};

/** First auto-popup dilemma: crisis before standard; background never popups. */
export function shouldShowDilemmaModal(
  world: WorldState | null,
  dismissedDilemmaIds: ReadonlySet<Id>,
): DilemmaModalCandidate | null {
  if (!world?.pendingDilemmas?.length) return null;

  const playerId = playerFactionId(world);
  const pending = world.pendingDilemmas.filter(
    (entry) => !playerId || entry.factionId === playerId,
  );

  const ranked = pending.flatMap((entry) => {
    const dilemma = getDilemmaById(entry.dilemmaId);
    if (!dilemma || dilemma.urgency === 'background') return [];
    return [
      {
        dilemmaId: entry.dilemmaId,
        urgency: dilemma.urgency,
      } satisfies DilemmaModalCandidate,
    ];
  }).sort((left, right) => URGENCY_RANK[left.urgency] - URGENCY_RANK[right.urgency]);

  const crisis = ranked.find((entry) => entry.urgency === 'crisis');
  if (crisis) return crisis;

  return ranked.find(
    (entry) => entry.urgency === 'standard' && !dismissedDilemmaIds.has(entry.dilemmaId),
  ) ?? null;
}

export function resolveDilemmaModalState(input: {
  world: WorldState | null;
  dismissedDilemmaIds: ReadonlySet<Id>;
  manualDilemmaId: Id | null;
}): DilemmaModalState {
  const empty: DilemmaModalState = {
    visible: false,
    dilemmaId: null,
    urgency: null,
    dilemmaSnapshot: null,
    canDismiss: false,
    blocksNavigation: false,
  };

  if (!input.world) return empty;

  let targetId: Id | null = null;
  let urgency: DilemmaUrgency | null = null;

  if (input.manualDilemmaId) {
    const manual = getDilemmaById(input.manualDilemmaId);
    const isPending = input.world.pendingDilemmas?.some(
      (entry) => entry.dilemmaId === input.manualDilemmaId,
    );
    if (manual && isPending) {
      targetId = input.manualDilemmaId;
      urgency = manual.urgency;
    }
  }

  if (!targetId) {
    const auto = shouldShowDilemmaModal(input.world, input.dismissedDilemmaIds);
    if (!auto) return empty;
    targetId = auto.dilemmaId;
    urgency = auto.urgency;
  }

  const dilemmaSnapshot = getDilemmaById(targetId);
  if (!dilemmaSnapshot || urgency === 'background') return empty;

  const isCrisis = urgency === 'crisis';

  return {
    visible: true,
    dilemmaId: targetId,
    urgency,
    dilemmaSnapshot,
    canDismiss: !isCrisis,
    blocksNavigation: isCrisis,
  };
}

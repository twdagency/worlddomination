import { getDilemmaById } from 'sim';
import { resolvePlayerFactionId } from 'shared';
import type { Id, WorldState } from 'sim';

export interface PendingDilemmaCard {
  dilemmaId: Id;
  title: string;
  factionId: Id;
}

export function selectPendingDilemmaCards(world: WorldState | null): PendingDilemmaCard[] {
  if (!world?.pendingDilemmas?.length) return [];

  const playerId = resolvePlayerFactionId(world);
  const cards: PendingDilemmaCard[] = [];

  for (const entry of world.pendingDilemmas) {
    if (playerId && entry.factionId !== playerId) continue;
    const dilemma = getDilemmaById(entry.dilemmaId);
    if (!dilemma) continue;
    cards.push({
      dilemmaId: entry.dilemmaId,
      title: dilemma.title,
      factionId: entry.factionId,
    });
  }

  if (!playerId) return cards;

  return cards.sort((left, right) => {
    if (left.factionId === playerId && right.factionId !== playerId) return -1;
    if (right.factionId === playerId && left.factionId !== playerId) return 1;
    return 0;
  });
}

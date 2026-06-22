import type { Id } from './types';

/** Lexicographic ordering for symmetric faction pairs (alliances, treaty parties). */
export function normalizeFactionPair(factionA: Id, factionB: Id): [Id, Id] {
  return factionA < factionB ? [factionA, factionB] : [factionB, factionA];
}

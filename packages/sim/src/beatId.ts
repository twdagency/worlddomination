import type { Id, IntelSource, Millis } from './types';

/** Deterministic beat id from faction + AI decision tick + intel source (seed-safe). */
export function computeBeatId(
  factionId: Id,
  decisionTickMs: Millis,
  source: IntelSource = 'direct',
): string {
  let hash = 2_166_136_261;
  const input = `${factionId}:${decisionTickMs}:${source}`;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 1_677_761_9);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

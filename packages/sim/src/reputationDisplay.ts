export type ReputationCategory = 'Trusted' | 'Neutral' | 'Wary' | 'Hostile';

/** Player-facing reputation bands — single source for UI thresholds. */
export function reputationCategory(score: number): ReputationCategory {
  if (score > 30) return 'Trusted';
  if (score >= -30) return 'Neutral';
  if (score >= -60) return 'Wary';
  return 'Hostile';
}

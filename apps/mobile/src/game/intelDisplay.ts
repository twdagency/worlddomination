import type { TerritorySnapshot } from 'sim';
export { formatIntelSourceLabel } from 'sim';
import { formatAwayDuration } from '../utils/format';

/** Human-readable staleness for tri-state territory rows. */
export function formatIntelAge(nowMs: number, observedAt: number): string {
  return `as of ${formatAwayDuration(nowMs - observedAt)} ago`;
}

/** Compact snapshot summary on stale territory cards. */
export function formatSnapshotHint(snapshot: TerritorySnapshot): string {
  const parts = [`Infra ${snapshot.infraLevel}`];
  if (snapshot.visibleEnemyGarrison > 0) {
    parts.push(`enemy ~${snapshot.visibleEnemyGarrison}`);
  } else if (snapshot.garrisonCount > 0) {
    parts.push(`garrison ~${snapshot.garrisonCount}`);
  }
  if (snapshot.inTransitCount > 0) {
    parts.push(`in transit ~${snapshot.inTransitCount}`);
  }
  return parts.join(' · ');
}

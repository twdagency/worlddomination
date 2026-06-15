import type { IntelSource, TerritorySnapshot } from 'sim';
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

/**
 * Source attribution for intel UI. Returns null when only `direct` is present —
 * Phase 2 stale rows are direct-sourced and show no extra label until scouts land.
 */
export function formatIntelSourceLabel(sources: IntelSource[]): string | null {
  const attributed = sources.filter((source) => source !== 'direct');
  if (attributed.length === 0) return null;

  const labels: Record<IntelSource, string> = {
    direct: '',
    scout: 'via scouts',
    allied: 'via ally',
    treaty: 'per treaty',
  };

  const text = attributed.map((source) => labels[source]).filter(Boolean).join(' · ');
  return text.length > 0 ? text : null;
}

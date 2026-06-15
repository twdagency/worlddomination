import type { DashboardCatchUpSummary } from '../../game/playerView';
import { formatAwayDuration } from '../../utils/format';

export function formatCatchUpBody(summary: DashboardCatchUpSummary): string {
  if (summary.mode === 'current') {
    return 'Empire is current — no catch-up required.';
  }

  const criticalLabels =
    summary.critical.length > 0
      ? summary.critical.map((item) => item.label).join('; ')
      : 'none';

  return `${summary.totalCount} events occurred. Critical: ${criticalLabels}. Notable: ${summary.notableCount}. Routine: ${summary.routineCount}.`;
}

export function formatCatchUpHeading(summary: DashboardCatchUpSummary): string {
  if (summary.mode === 'current') {
    return 'Current status';
  }
  return `While you were away (${formatAwayDuration(summary.awayMs)})`;
}

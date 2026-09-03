import { DASHBOARD_AWAY_COLLAPSE_MS } from '../game/playerView';

export interface PersistentHeaderModel {
  gameDay: number;
  gameDateLabel: string;
  gameTimeLabel: string;
  fundingLabel: string;
  awayLabel: string | null;
  showAwayIndicator: boolean;
  urgentCount: number;
}

export function buildPersistentHeaderModel(input: {
  gameDay: number;
  gameDateLabel: string;
  gameTimeLabel: string;
  fundingLabel: string;
  awayMs: number;
  urgentCount: number;
  formatAwayDuration: (ms: number) => string;
}): PersistentHeaderModel {
  const showAwayIndicator = input.awayMs >= DASHBOARD_AWAY_COLLAPSE_MS;

  return {
    gameDay: input.gameDay,
    gameDateLabel: input.gameDateLabel,
    gameTimeLabel: input.gameTimeLabel,
    fundingLabel: input.fundingLabel,
    showAwayIndicator,
    awayLabel: showAwayIndicator ? input.formatAwayDuration(input.awayMs) : null,
    urgentCount: input.urgentCount,
  };
}

export function formatUrgentBadgeCount(count: number): string {
  if (count <= 0) return '';
  return count > 9 ? '9+' : String(count);
}

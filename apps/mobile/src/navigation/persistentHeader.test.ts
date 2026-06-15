import { describe, expect, it } from 'vitest';
import { DASHBOARD_AWAY_COLLAPSE_MS } from '../game/playerView';
import {
  buildPersistentHeaderModel,
  formatUrgentBadgeCount,
} from './persistentHeaderModel';

describe('persistent header model', () => {
  it('shows away indicator only after the collapse threshold', () => {
    const active = buildPersistentHeaderModel({
      gameDay: 12,
      gameDateLabel: 'Mon, Jan 1',
      fundingLabel: '$25,000',
      awayMs: DASHBOARD_AWAY_COLLAPSE_MS - 1,
      urgentCount: 0,
      formatAwayDuration: (ms) => `${ms}ms`,
    });

    expect(active.showAwayIndicator).toBe(false);
    expect(active.awayLabel).toBeNull();

    const away = buildPersistentHeaderModel({
      gameDay: 12,
      gameDateLabel: 'Mon, Jan 1',
      fundingLabel: '$25,000',
      awayMs: DASHBOARD_AWAY_COLLAPSE_MS,
      urgentCount: 2,
      formatAwayDuration: () => '6h',
    });

    expect(away.showAwayIndicator).toBe(true);
    expect(away.awayLabel).toBe('6h');
    expect(away.urgentCount).toBe(2);
  });

  it('caps urgent badge display at 9+', () => {
    expect(formatUrgentBadgeCount(0)).toBe('');
    expect(formatUrgentBadgeCount(3)).toBe('3');
    expect(formatUrgentBadgeCount(12)).toBe('9+');
  });
});

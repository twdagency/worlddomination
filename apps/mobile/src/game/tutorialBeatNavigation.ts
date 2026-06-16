import type { TutorialBeatId } from 'sim';
import type { DashboardScreenName } from './playerView';

/** Beat → screen the banner instructs the player to open (auto-collapse on arrival). */
export const TUTORIAL_BEAT_NAV_TARGET: Partial<Record<TutorialBeatId, DashboardScreenName>> = {
  movement: 'Order',
  combat: 'Dispatches',
  economy: 'Territory',
};

export interface ActiveTutorialRoute {
  tab: string;
  stackScreen?: string;
}

export function matchesTutorialNavTarget(
  target: DashboardScreenName,
  route: ActiveTutorialRoute,
): boolean {
  if (target === 'Order' || target === 'Territory' || target === 'Diplomacy' || target === 'Forces') {
    return route.tab === 'Actions' && route.stackScreen === target;
  }
  return route.tab === target;
}

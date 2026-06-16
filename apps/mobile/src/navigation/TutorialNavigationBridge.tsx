import type { NavigationState } from '@react-navigation/native';
import type { TutorialBeatId } from 'sim';
import {
  matchesTutorialNavTarget,
  TUTORIAL_BEAT_NAV_TARGET,
  type ActiveTutorialRoute,
} from '../game/tutorialBeatNavigation';

export function resolveActiveRoute(state: NavigationState | undefined): ActiveTutorialRoute | null {
  if (!state) return null;

  const tabRoute = state.routes[state.index ?? 0];
  if (!tabRoute) return null;

  const nested = tabRoute.state;
  if (nested && nested.routes.length > 0) {
    const stackRoute = nested.routes[nested.index ?? 0];
    return { tab: tabRoute.name, stackScreen: stackRoute?.name };
  }

  return { tab: tabRoute.name };
}

/** Collapses the tutorial banner when the player reaches the beat's target screen. */
export function maybeCollapseTutorialBannerOnNavigation(
  state: NavigationState | undefined,
  options: {
    isTutorialActive: boolean;
    currentBeat: TutorialBeatId | null;
    collapseTutorialBanner: () => void;
  },
): void {
  const { isTutorialActive, currentBeat, collapseTutorialBanner } = options;
  if (!isTutorialActive || !currentBeat) return;

  const target = TUTORIAL_BEAT_NAV_TARGET[currentBeat];
  if (!target) return;

  const route = resolveActiveRoute(state);
  if (route && matchesTutorialNavTarget(target, route)) {
    collapseTutorialBanner();
  }
}

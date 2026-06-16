import React, { useEffect } from 'react';
import type { NavigationState } from '@react-navigation/native';
import { useNavigationState } from '@react-navigation/native';
import { useGame } from '../game/GameContext';
import {
  matchesTutorialNavTarget,
  TUTORIAL_BEAT_NAV_TARGET,
  type ActiveTutorialRoute,
} from '../game/tutorialBeatNavigation';

function resolveActiveRoute(state: NavigationState | undefined): ActiveTutorialRoute | null {
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
export function TutorialNavigationBridge() {
  const { isTutorialActive, currentBeat, collapseTutorialBanner } = useGame();
  const navState = useNavigationState((state) => state);

  useEffect(() => {
    if (!isTutorialActive || !currentBeat) return;

    const target = TUTORIAL_BEAT_NAV_TARGET[currentBeat];
    if (!target) return;

    const route = resolveActiveRoute(navState);
    if (route && matchesTutorialNavTarget(target, route)) {
      collapseTutorialBanner();
    }
  }, [navState, isTutorialActive, currentBeat, collapseTutorialBanner]);

  return null;
}

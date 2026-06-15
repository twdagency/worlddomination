import type { NavigatorScreenParams } from '@react-navigation/native';
import type { DashboardNavTarget, DashboardScreenName } from '../game/playerView';
import { isActionMenuScreen, type ActionMenuScreen, type PrimaryTabScreen } from './tabConfig';
import type { ActionStackParamList } from './types';

export type ResolvedNavigation =
  | { tab: Exclude<PrimaryTabScreen, 'Actions'> }
  | {
      tab: 'Actions';
      stack: NavigatorScreenParams<ActionStackParamList>;
    };

const PRIMARY_ONLY: Record<string, Exclude<PrimaryTabScreen, 'Actions'>> = {
  Dashboard: 'Dashboard',
  Dispatches: 'Dispatches',
  World: 'World',
};

function actionStackTarget(
  screen: ActionMenuScreen,
  extras?: Pick<DashboardNavTarget, 'factionId' | 'territoryId'>,
): NavigatorScreenParams<ActionStackParamList> {
  switch (screen) {
    case 'Diplomacy':
      return {
        screen: 'Diplomacy',
        params: extras?.factionId ? { expandFactionId: extras.factionId } : undefined,
      };
    case 'Territory':
      return {
        screen: 'Territory',
        params: extras?.territoryId ? { territoryId: extras.territoryId } : undefined,
      };
    case 'Order':
      return { screen: 'Order' };
    case 'Forces':
      return { screen: 'Forces' };
  }
}

/** Map dashboard / urgent-queue targets onto the Phase 2 tab + action-stack structure. */
export function resolveDashboardNavigation(
  screen: DashboardScreenName,
  extras?: Pick<DashboardNavTarget, 'factionId' | 'territoryId'>,
): ResolvedNavigation {
  const primary = PRIMARY_ONLY[screen];
  if (primary) {
    return { tab: primary };
  }

  if (isActionMenuScreen(screen)) {
    return {
      tab: 'Actions',
      stack: actionStackTarget(screen, extras),
    };
  }

  return { tab: 'Dashboard' };
}

export function resolveDashboardTarget(target: DashboardNavTarget): ResolvedNavigation {
  return resolveDashboardNavigation(target.screen, target);
}

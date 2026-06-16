import type { NavigatorScreenParams } from '@react-navigation/native';
import type { DashboardNavTarget, DashboardScreenName } from '../game/playerView';
import { isActionMenuScreen, type ActionMenuScreen, type PrimaryTabScreen } from './tabConfig';
import type { ActionStackParamList, HomeStackParamList } from './types';

export type ResolvedNavigation =
  | {
      tab: 'Dashboard';
      stack: NavigatorScreenParams<HomeStackParamList>;
    }
  | { tab: Exclude<PrimaryTabScreen, 'Actions' | 'Dashboard'> }
  | {
      tab: 'Actions';
      stack: NavigatorScreenParams<ActionStackParamList>;
    };

const PRIMARY_ONLY: Record<string, Exclude<PrimaryTabScreen, 'Actions' | 'Dashboard'>> = {
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

/** Map dashboard / urgent-queue targets onto the tab + stack structure. */
export function resolveDashboardNavigation(
  screen: DashboardScreenName,
  extras?: Pick<DashboardNavTarget, 'factionId' | 'territoryId' | 'dispatchId'>,
): ResolvedNavigation {
  if (screen === 'Dashboard') {
    return { tab: 'Dashboard', stack: { screen: 'DashboardHome' } };
  }

  if (screen === 'Dispatches') {
    return {
      tab: 'Dashboard',
      stack: {
        screen: 'Dispatches',
        params: extras?.dispatchId ? { dispatchId: extras.dispatchId } : undefined,
      },
    };
  }

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

  return { tab: 'Dashboard', stack: { screen: 'DashboardHome' } };
}

export function resolveDashboardTarget(target: DashboardNavTarget): ResolvedNavigation {
  return resolveDashboardNavigation(target.screen, target);
}

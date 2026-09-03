import type { NavigationState } from '@react-navigation/native';
import { describe, expect, it, vi } from 'vitest';
import { maybeCollapseTutorialBannerOnNavigation } from './TutorialNavigationBridge';

function navState(route: {
  tab: string;
  stackScreen?: string;
}): NavigationState {
  if (!route.stackScreen) {
    return {
      stale: false,
      type: 'tab',
      key: 'root',
      index: 0,
      routeNames: [route.tab],
      routes: [{ key: `${route.tab}-1`, name: route.tab }],
    };
  }

  return {
    stale: false,
    type: 'tab',
    key: 'root',
    index: 0,
    routeNames: [route.tab],
    routes: [
      {
        key: `${route.tab}-1`,
        name: route.tab,
        state: {
          stale: false,
          type: 'stack',
          key: 'stack',
          index: 0,
          routeNames: ['DashboardHome', 'Dispatches'],
          routes: [{ key: 'detail', name: route.stackScreen }],
        },
      },
    ],
  };
}

describe('tutorial navigation bridge', () => {
  it('collapses the combat beat banner when Dispatches is pushed on Home stack', () => {
    const collapseTutorialBanner = vi.fn();

    maybeCollapseTutorialBannerOnNavigation(
      navState({ tab: 'Dashboard', stackScreen: 'Dispatches' }),
      {
        isTutorialActive: true,
        currentBeat: 'combat',
        collapseTutorialBanner,
      },
    );

    expect(collapseTutorialBanner).toHaveBeenCalledTimes(1);
  });

  it('collapses the influence beat banner when Order is opened', () => {
    const collapseTutorialBanner = vi.fn();

    maybeCollapseTutorialBannerOnNavigation(
      navState({ tab: 'Actions', stackScreen: 'Order' }),
      {
        isTutorialActive: true,
        currentBeat: 'influence',
        collapseTutorialBanner,
      },
    );

    expect(collapseTutorialBanner).toHaveBeenCalledTimes(1);
  });

  it('does not collapse when only the dashboard root is visible', () => {
    const collapseTutorialBanner = vi.fn();

    maybeCollapseTutorialBannerOnNavigation(navState({ tab: 'Dashboard' }), {
      isTutorialActive: true,
      currentBeat: 'combat',
      collapseTutorialBanner,
    });

    expect(collapseTutorialBanner).not.toHaveBeenCalled();
  });
});

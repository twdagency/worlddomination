import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import type { Id } from 'sim';
import type { RootTabParamList } from './types';

export type DeepLinkTarget =
  | { tab: 'home'; screen?: 'dashboard' | 'dispatches'; dispatchId?: Id; unreadOnly?: boolean }
  | { tab: 'world'; screen?: 'world'; territoryId?: Id }
  | {
      tab: 'actions';
      screen?: 'menu' | 'order' | 'diplomacy' | 'territory' | 'forces';
      orderTerritoryId?: Id;
      territoryId?: Id;
    };

type RootNavigation = NavigationProp<RootTabParamList & ParamListBase>;

export function navigateTo(navigation: RootNavigation, target: DeepLinkTarget): void {
  switch (target.tab) {
    case 'home': {
      if (target.screen === 'dispatches') {
        navigation.navigate('Dashboard', {
          screen: 'Dispatches',
          params: {
            dispatchId: target.dispatchId,
            unreadOnly: target.unreadOnly,
          },
        });
        return;
      }
      navigation.navigate('Dashboard', { screen: 'DashboardHome' });
      return;
    }
    case 'world': {
      navigation.navigate('World');
      return;
    }
    case 'actions': {
      const screen = target.screen ?? 'menu';
      switch (screen) {
        case 'menu':
          navigation.navigate('Actions', { screen: 'ActionMenu' });
          return;
        case 'order':
          navigation.navigate('Actions', { screen: 'Order' });
          return;
        case 'diplomacy':
          navigation.navigate('Actions', { screen: 'Diplomacy' });
          return;
        case 'territory':
          navigation.navigate('Actions', {
            screen: 'Territory',
            params: target.territoryId ? { territoryId: target.territoryId } : undefined,
          });
          return;
        case 'forces':
          navigation.navigate('Actions', { screen: 'Forces' });
      }
    }
  }
}

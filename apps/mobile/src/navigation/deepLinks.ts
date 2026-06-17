import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import type { Id } from 'sim';
import type { RootTabParamList } from './types';

export type DeepLinkTarget =
  | {
      tab: 'home';
      screen?: 'dashboard' | 'dispatches' | 'defeatedCountries';
      dispatchId?: Id;
      unreadOnly?: boolean;
    }
  | {
      tab: 'world';
      screen?: 'world';
      focusTerritoryId?: Id;
      focusCountryId?: Id;
      territoryFilter?: 'defeated';
    }
  | {
      tab: 'actions';
      screen?: 'menu' | 'order' | 'diplomacy' | 'territory' | 'forces';
      territoryId?: Id;
      presetDestinationId?: Id;
      presetForceId?: Id;
      focusCountryId?: Id;
    };

export type ContextEntity =
  | { kind: 'territory'; id: Id }
  | { kind: 'country'; id: Id }
  | { kind: 'leader'; id: Id }
  | { kind: 'dispatch'; id: Id };

type RootNavigation = NavigationProp<RootTabParamList & ParamListBase>;

/** Returns appropriate deep link for tapping a contextual entity. */
export function deepLinkForEntity(
  entity: ContextEntity,
  intent: 'view' | 'order' | 'diplomacy' = 'view',
): DeepLinkTarget | null {
  switch (entity.kind) {
    case 'territory':
      if (intent === 'order') {
        return {
          tab: 'actions',
          screen: 'order',
          presetDestinationId: entity.id,
        };
      }
      return { tab: 'actions', screen: 'territory', territoryId: entity.id };
    case 'country':
      if (intent === 'diplomacy') {
        return { tab: 'actions', screen: 'diplomacy', focusCountryId: entity.id };
      }
      return { tab: 'world', focusCountryId: entity.id };
    case 'leader':
      return null;
    case 'dispatch':
      return { tab: 'home', screen: 'dispatches', dispatchId: entity.id };
    default:
      return null;
  }
}

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
      if (target.screen === 'defeatedCountries') {
        navigation.navigate('Dashboard', { screen: 'DefeatedCountries' });
        return;
      }
      navigation.navigate('Dashboard', { screen: 'DashboardHome' });
      return;
    }
    case 'world': {
      navigation.navigate('World', {
        screen: 'WorldHome',
        params: {
          focusTerritoryId: target.focusTerritoryId,
          focusCountryId: target.focusCountryId,
          territoryFilter: target.territoryFilter,
        },
      });
      return;
    }
    case 'actions': {
      const screen = target.screen ?? 'menu';
      switch (screen) {
        case 'menu':
          navigation.navigate('Actions', { screen: 'ActionMenu' });
          return;
        case 'order':
          navigation.navigate('Actions', {
            screen: 'Order',
            params:
              target.presetDestinationId || target.presetForceId
                ? {
                    presetDestinationId: target.presetDestinationId,
                    presetForceId: target.presetForceId,
                  }
                : undefined,
          });
          return;
        case 'diplomacy':
          navigation.navigate('Actions', {
            screen: 'Diplomacy',
            params: target.focusCountryId
              ? { focusCountryId: target.focusCountryId }
              : undefined,
          });
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

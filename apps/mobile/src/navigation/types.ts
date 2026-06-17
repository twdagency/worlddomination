import type { NavigatorScreenParams } from '@react-navigation/native';
import type { ActionMenuScreen } from './tabConfig';

export type HomeStackParamList = {
  DashboardHome: undefined;
  Dispatches: { dispatchId?: string; unreadOnly?: boolean } | undefined;
  DefeatedCountries: undefined;
};

export type ActionStackParamList = {
  ActionMenu: undefined;
  Order:
    | {
        presetDestinationId?: string;
        presetForceId?: string;
        orderMode?: 'move' | 'build' | 'influence';
        presetCityId?: string;
        presetInfluenceAction?: string;
      }
    | undefined;
  Diplomacy: { expandFactionId?: string; focusCountryId?: string } | undefined;
  Territory: { territoryId?: string } | undefined;
  Forces: undefined;
};

export type WorldStackParamList = {
  WorldHome:
    | { focusTerritoryId?: string; focusCountryId?: string; territoryFilter?: 'defeated' }
    | undefined;
  DefeatedCountries: undefined;
};

export type RootTabParamList = {
  Dashboard: NavigatorScreenParams<HomeStackParamList> | undefined;
  World: NavigatorScreenParams<WorldStackParamList> | undefined;
  Actions: NavigatorScreenParams<ActionStackParamList> | undefined;
};

export type ActionTaskRoute = ActionMenuScreen;

import type { NavigatorScreenParams } from '@react-navigation/native';
import type { ActionMenuScreen } from './tabConfig';

export type ActionStackParamList = {
  ActionMenu: undefined;
  Order: undefined;
  Diplomacy: { expandFactionId?: string } | undefined;
  Territory: { territoryId?: string } | undefined;
  Forces: undefined;
};

export type RootTabParamList = {
  Dashboard: undefined;
  Dispatches: undefined;
  World: undefined;
  Actions: NavigatorScreenParams<ActionStackParamList> | undefined;
};

export type ActionTaskRoute = ActionMenuScreen;

import { terminal } from '../theme/terminal';

export const HOME_STACK_SCREEN_OPTIONS = {
  headerStyle: { backgroundColor: terminal.card },
  headerTintColor: terminal.accent,
  headerTitleStyle: { fontFamily: terminal.mono, fontSize: 15 },
  contentStyle: { backgroundColor: terminal.bg },
  headerShown: false as const,
};

export const HOME_STACK_DETAIL_SCREENS = ['Dispatches'] as const;

export const WORLD_STACK_SCREEN_OPTIONS = HOME_STACK_SCREEN_OPTIONS;

import { terminal } from '../theme/terminal';

export const ACTION_STACK_SCREEN_OPTIONS = {
  headerStyle: { backgroundColor: terminal.card },
  headerTintColor: terminal.accent,
  headerTitleStyle: { fontFamily: terminal.mono, fontSize: 15 },
  contentStyle: { backgroundColor: terminal.bg },
  headerShown: false as const,
};

export const ACTION_STACK_TASK_SCREENS = ['Order', 'Diplomacy', 'Territory', 'Forces'] as const;

/** Primary bottom-tab destinations (max 4 per design canon). */
export const PRIMARY_TAB_SCREENS = ['Dashboard', 'Dispatches', 'World', 'Actions'] as const;

export type PrimaryTabScreen = (typeof PRIMARY_TAB_SCREENS)[number];

/** Task screens reachable from the Actions hub (not primary tabs). */
export const ACTION_MENU_SCREENS = ['Order', 'Diplomacy', 'Territory', 'Forces'] as const;

export type ActionMenuScreen = (typeof ACTION_MENU_SCREENS)[number];

export const PRIMARY_TAB_COUNT = PRIMARY_TAB_SCREENS.length;

export interface ActionMenuItem {
  screen: ActionMenuScreen;
  label: string;
  iconName: string;
}

export const ACTION_MENU_ITEMS: readonly ActionMenuItem[] = [
  { screen: 'Order', label: 'Order', iconName: 'flash-outline' },
  { screen: 'Diplomacy', label: 'Diplomacy', iconName: 'people-outline' },
  { screen: 'Territory', label: 'Territory', iconName: 'map-outline' },
  { screen: 'Forces', label: 'Forces', iconName: 'shield-outline' },
] as const;

export interface PrimaryTabIconConfig {
  screen: PrimaryTabScreen;
  label: string;
  iconName: string;
  activeIconName: string;
}

export const PRIMARY_TAB_ICONS: readonly PrimaryTabIconConfig[] = [
  { screen: 'Dashboard', label: 'Home', iconName: 'home-outline', activeIconName: 'home' },
  { screen: 'Dispatches', label: 'Dispatches', iconName: 'mail-outline', activeIconName: 'mail' },
  { screen: 'World', label: 'World', iconName: 'globe-outline', activeIconName: 'globe' },
  { screen: 'Actions', label: 'Actions', iconName: 'grid-outline', activeIconName: 'grid' },
] as const;

export function isPrimaryTabScreen(value: string): value is PrimaryTabScreen {
  return (PRIMARY_TAB_SCREENS as readonly string[]).includes(value);
}

export function isActionMenuScreen(value: string): value is ActionMenuScreen {
  return (ACTION_MENU_SCREENS as readonly string[]).includes(value);
}

export function actionMenuItemForScreen(screen: ActionMenuScreen): ActionMenuItem | undefined {
  return ACTION_MENU_ITEMS.find((item) => item.screen === screen);
}

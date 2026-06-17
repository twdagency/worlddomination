/** Primary bottom-tab destinations (design canon Layer 5 — three-tab hub). */
export const PRIMARY_TAB_SCREENS = ['Dashboard', 'World', 'Actions'] as const;

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
  testID: string;
  accessibilityLabel: string;
}

export const PRIMARY_TAB_ICONS: readonly PrimaryTabIconConfig[] = [
  {
    screen: 'Dashboard',
    label: 'Home',
    iconName: 'home-outline',
    activeIconName: 'home',
    testID: 'tab-home',
    accessibilityLabel: 'Home tab',
  },
  {
    screen: 'World',
    label: 'World',
    iconName: 'globe-outline',
    activeIconName: 'globe',
    testID: 'tab-world',
    accessibilityLabel: 'World tab',
  },
  {
    screen: 'Actions',
    label: 'Actions',
    iconName: 'grid-outline',
    activeIconName: 'grid',
    testID: 'tab-actions',
    accessibilityLabel: 'Actions tab',
  },
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

/** Maps legacy persisted tab names onto the Phase 6 three-tab structure. */
export function normalizePersistedTabName(tab: string | null | undefined): PrimaryTabScreen {
  if (tab === 'Dispatches') return 'Dashboard';
  if (isPrimaryTabScreen(tab ?? '')) return tab as PrimaryTabScreen;
  return 'Dashboard';
}

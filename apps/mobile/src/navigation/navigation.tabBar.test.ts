import { describe, expect, it } from 'vitest';
import {
  ACTION_MENU_ITEMS,
  ACTION_MENU_SCREENS,
  normalizePersistedTabName,
  PRIMARY_TAB_COUNT,
  PRIMARY_TAB_ICONS,
  PRIMARY_TAB_SCREENS,
  isActionMenuScreen,
  isPrimaryTabScreen,
} from '../navigation/tabConfig';
import { resolveTabBarBottomInset } from '../navigation/tabBarMetrics';

describe('tab bar configuration', () => {
  it('exposes exactly three icon-led primary destinations in Home, World, Actions order', () => {
    expect(PRIMARY_TAB_COUNT).toBe(3);
    expect(PRIMARY_TAB_SCREENS).toEqual(['Dashboard', 'World', 'Actions']);
    expect(PRIMARY_TAB_SCREENS).not.toContain('Dispatches');
  });

  it('assigns icons and labels to every primary tab', () => {
    expect(PRIMARY_TAB_ICONS).toHaveLength(3);
    for (const tab of PRIMARY_TAB_ICONS) {
      expect(tab.label.length).toBeGreaterThan(0);
      expect(tab.iconName.length).toBeGreaterThan(0);
      expect(tab.activeIconName.length).toBeGreaterThan(0);
      expect(tab.testID.length).toBeGreaterThan(0);
      expect(tab.accessibilityLabel.length).toBeGreaterThan(0);
    }
    expect(PRIMARY_TAB_ICONS.map((tab) => tab.label)).toEqual(['Home', 'World', 'Actions']);
  });

  it('routes task screens through the action menu hub', () => {
    expect(ACTION_MENU_SCREENS).toEqual(['Order', 'Diplomacy', 'Territory', 'Forces']);
    expect(ACTION_MENU_ITEMS.map((item) => item.screen)).toEqual([...ACTION_MENU_SCREENS]);
  });

  it('validates primary vs action screen membership', () => {
    expect(isPrimaryTabScreen('Dashboard')).toBe(true);
    expect(isPrimaryTabScreen('Dispatches')).toBe(false);
    expect(isPrimaryTabScreen('Diplomacy')).toBe(false);
    expect(isActionMenuScreen('Diplomacy')).toBe(true);
    expect(isActionMenuScreen('Dispatches')).toBe(false);
  });

  it('migrates legacy Dispatches tab persistence to Home', () => {
    expect(normalizePersistedTabName('Dispatches')).toBe('Dashboard');
    expect(normalizePersistedTabName('World')).toBe('World');
    expect(normalizePersistedTabName(null)).toBe('Dashboard');
  });

  it('uses device inset when larger than platform minimum', () => {
    expect(resolveTabBarBottomInset(48)).toBe(48);
  });

  it('falls back to platform minimum when device inset is zero', () => {
    expect(resolveTabBarBottomInset(0)).toBeGreaterThanOrEqual(12);
  });
});

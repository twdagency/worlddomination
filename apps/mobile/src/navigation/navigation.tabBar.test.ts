import { describe, expect, it } from 'vitest';
import {
  ACTION_MENU_ITEMS,
  ACTION_MENU_SCREENS,
  PRIMARY_TAB_COUNT,
  PRIMARY_TAB_SCREENS,
  isActionMenuScreen,
  isPrimaryTabScreen,
} from '../navigation/tabConfig';

describe('tab bar configuration', () => {
  it('exposes exactly four icon-led primary destinations', () => {
    expect(PRIMARY_TAB_COUNT).toBe(4);
    expect(PRIMARY_TAB_SCREENS).toEqual(['Dashboard', 'Dispatches', 'World', 'Actions']);
  });

  it('routes task screens through the action menu hub', () => {
    expect(ACTION_MENU_SCREENS).toEqual(['Order', 'Diplomacy', 'Territory', 'Forces']);
    expect(ACTION_MENU_ITEMS.map((item) => item.screen)).toEqual([...ACTION_MENU_SCREENS]);
  });

  it('validates primary vs action screen membership', () => {
    expect(isPrimaryTabScreen('Dashboard')).toBe(true);
    expect(isPrimaryTabScreen('Diplomacy')).toBe(false);
    expect(isActionMenuScreen('Diplomacy')).toBe(true);
    expect(isActionMenuScreen('Dispatches')).toBe(false);
  });
});

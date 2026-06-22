import { beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../src/theme/terminal';
import {
  clearTooltipDismissals,
  loadTooltipDismissals,
  persistTooltipDismissal,
} from '../src/game/tooltipDismissal';

describe('tooltipDismissal storage', () => {
  beforeEach(() => {
    vi.mocked(AsyncStorage.getItem).mockReset();
    vi.mocked(AsyncStorage.setItem).mockReset();
    vi.mocked(AsyncStorage.removeItem).mockReset();
  });

  it('loads persisted dismissals from AsyncStorage', async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(
      JSON.stringify(['influence-card-first-view']),
    );
    const state = await loadTooltipDismissals();
    expect([...state.dismissed]).toEqual(['influence-card-first-view']);
  });

  it('persists dismissal ids to AsyncStorage', async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify([]));
    await persistTooltipDismissal('tooltip-influence-coup-attempt');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.tooltipDismissals,
      JSON.stringify(['tooltip-influence-coup-attempt']),
    );
  });

  it('clears dismissals from storage', async () => {
    await clearTooltipDismissals();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.tooltipDismissals);
  });
});

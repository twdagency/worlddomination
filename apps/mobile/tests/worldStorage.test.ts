import { describe, expect, it, vi, beforeEach } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSprint4World, LEADERS_BY_ID, UNIT_TYPES_BY_ID } from 'shared';
import { ensureWorldMigrations } from 'sim';
import {
  clearCampaignStorage,
  loadDispatches,
  loadWorld,
} from '../src/storage/worldStorage';
import { STORAGE_KEYS } from '../src/theme/terminal';

const START_MS = 1_700_000_000_000;

describe('worldStorage resilience', () => {
  beforeEach(() => {
    vi.mocked(AsyncStorage.getItem).mockReset();
    vi.mocked(AsyncStorage.multiRemove).mockReset();
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    vi.mocked(AsyncStorage.multiRemove).mockResolvedValue(undefined);
  });

  it('returns null when stored world JSON is corrupt', async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue('{not-json');
    await expect(loadWorld()).resolves.toBeNull();
  });

  it('returns empty dispatches when stored dispatch JSON is corrupt', async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue('{not-json');
    await expect(loadDispatches()).resolves.toEqual([]);
  });

  it('migrates a well-formed stored world', async () => {
    const stored = ensureWorldMigrations(createSprint4World(START_MS), {
      leaders: LEADERS_BY_ID,
      unitTypes: UNIT_TYPES_BY_ID,
    });
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(stored));
    const loaded = await loadWorld();
    expect(loaded?.scenarioId).toBe(stored.scenarioId);
  });

  it('clears scenarioId with the rest of campaign storage', async () => {
    await clearCampaignStorage();
    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(
      expect.arrayContaining([
        STORAGE_KEYS.world,
        STORAGE_KEYS.dispatches,
        STORAGE_KEYS.scenarioId,
      ]),
    );
  });
});

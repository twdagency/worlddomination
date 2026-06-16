import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SimEvent, WorldState } from 'sim';
import { ensureWorldMigrations, backfillLegacyDispatchEventIds } from 'sim';
import { LEADERS_BY_ID } from 'shared';
import { UNIT_TYPES_BY_ID } from 'shared';
import { STORAGE_KEYS } from '../theme/terminal';

export async function loadWorld(): Promise<WorldState | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.world);
  if (!raw) return null;
  return ensureWorldMigrations(JSON.parse(raw) as WorldState, {
    unitTypes: UNIT_TYPES_BY_ID,
    leaders: LEADERS_BY_ID,
  });
}

export async function saveWorld(world: WorldState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.world, JSON.stringify(world));
}

export async function loadDispatches(): Promise<SimEvent[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.dispatches);
  if (!raw) return [];
  return backfillLegacyDispatchEventIds(JSON.parse(raw) as SimEvent[]);
}

export async function saveDispatches(events: SimEvent[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.dispatches, JSON.stringify(events));
}

export async function loadLastActiveMs(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.lastActiveMs);
  return raw ? Number(raw) : null;
}

export async function saveLastActiveMs(ms: number): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.lastActiveMs, String(ms));
}

export async function loadScenarioId(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEYS.scenarioId);
}

export async function saveScenarioId(id: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.scenarioId, id);
}

export async function loadTutorialOnboarded(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.tutorialOnboarded);
  return raw === 'true';
}

export async function saveTutorialOnboarded(onboarded: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.tutorialOnboarded, onboarded ? 'true' : 'false');
}

export async function clearCampaignStorage(): Promise<void> {
  await AsyncStorage.multiRemove([
    STORAGE_KEYS.world,
    STORAGE_KEYS.dispatches,
    STORAGE_KEYS.lastActiveMs,
  ]);
}

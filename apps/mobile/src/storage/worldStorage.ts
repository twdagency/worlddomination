import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SimEvent, WorldState } from 'sim';
import { STORAGE_KEYS } from '../theme/terminal';

export async function loadWorld(): Promise<WorldState | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.world);
  if (!raw) return null;
  return JSON.parse(raw) as WorldState;
}

export async function saveWorld(world: WorldState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.world, JSON.stringify(world));
}

export async function loadDispatches(): Promise<SimEvent[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.dispatches);
  if (!raw) return [];
  return JSON.parse(raw) as SimEvent[];
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

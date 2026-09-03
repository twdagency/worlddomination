import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SimEvent, WorldState } from 'sim';
import { ensureWorldMigrations, backfillLegacyDispatchEventIds } from 'sim';
import { LEADERS_BY_ID } from 'shared';
import { UNIT_TYPES_BY_ID } from 'shared';
import { STORAGE_KEYS } from '../theme/terminal';
import { clearTooltipDismissals } from '../game/tooltipDismissal';
import {
  parseDispatchReadState,
  serializeDispatchReadState,
  type DispatchReadState,
} from '../game/dispatchReadState';

function parseStoredJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function loadWorld(): Promise<WorldState | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.world);
  const parsed = parseStoredJson<WorldState>(raw);
  if (!parsed) return null;
  try {
    return ensureWorldMigrations(parsed, {
      unitTypes: UNIT_TYPES_BY_ID,
      leaders: LEADERS_BY_ID,
    });
  } catch {
    return null;
  }
}

export async function saveWorld(world: WorldState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.world, JSON.stringify(world));
}

export async function loadDispatches(): Promise<SimEvent[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.dispatches);
  const parsed = parseStoredJson<SimEvent[]>(raw);
  if (!Array.isArray(parsed)) return [];
  try {
    return backfillLegacyDispatchEventIds(parsed);
  } catch {
    return [];
  }
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

export async function loadDispatchReadState(): Promise<DispatchReadState | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.lastViewedDispatchesAt);
  return parseDispatchReadState(raw);
}

export async function saveDispatchReadState(read: DispatchReadState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.lastViewedDispatchesAt, serializeDispatchReadState(read));
}

/** @deprecated Use loadDispatchReadState */
export async function loadLastViewedDispatchesAt(): Promise<number | null> {
  const read = await loadDispatchReadState();
  return read?.atMs ?? null;
}

/** @deprecated Use saveDispatchReadState */
export async function saveLastViewedDispatchesAt(ms: number): Promise<void> {
  await saveDispatchReadState({ atMs: ms, throughEventSerial: -1 });
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
    STORAGE_KEYS.lastViewedDispatchesAt,
    STORAGE_KEYS.scenarioId,
  ]);
  await clearTooltipDismissals();
}

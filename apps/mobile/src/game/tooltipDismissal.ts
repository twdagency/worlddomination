import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../theme/terminal';

export interface TooltipDismissalState {
  dismissed: Set<string>;
}

function parseDismissals(raw: string | null): TooltipDismissalState {
  if (!raw) return { dismissed: new Set() };
  try {
    const parsed = JSON.parse(raw) as string[];
    return { dismissed: new Set(Array.isArray(parsed) ? parsed : []) };
  } catch {
    return { dismissed: new Set() };
  }
}

export async function loadTooltipDismissals(): Promise<TooltipDismissalState> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.tooltipDismissals);
  return parseDismissals(raw);
}

export async function persistTooltipDismissal(tooltipId: string): Promise<void> {
  const current = await loadTooltipDismissals();
  current.dismissed.add(tooltipId);
  await AsyncStorage.setItem(
    STORAGE_KEYS.tooltipDismissals,
    JSON.stringify([...current.dismissed].sort()),
  );
}

export async function clearTooltipDismissals(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.tooltipDismissals);
}

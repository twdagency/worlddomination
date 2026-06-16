import { Platform } from 'react-native';

export const TAB_BAR_MIN_BOTTOM_INSET =
  Platform.select({ android: 28, ios: 20, default: 12 }) ?? 12;

export function resolveTabBarBottomInset(deviceInset: number): number {
  return Math.max(deviceInset, TAB_BAR_MIN_BOTTOM_INSET);
}

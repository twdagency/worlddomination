export type ToastTone = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  tone: ToastTone;
}

export const TOAST_VISIBLE_MS = 4_000;

/** Single-slot toast queue — new toast replaces the current one. */
export function nextToastState(
  _current: ToastMessage | null,
  message: string,
  tone: ToastTone,
  id: string,
): ToastMessage {
  return { id, message, tone };
}

export function clearToastState(): null {
  return null;
}

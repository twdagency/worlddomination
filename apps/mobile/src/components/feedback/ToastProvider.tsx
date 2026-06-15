import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { terminal } from '../../theme/terminal';
import {
  clearToastState,
  TOAST_VISIBLE_MS,
  type ToastMessage,
  type ToastTone,
} from '../../game/toastQueue';

interface ToastContextValue {
  toast: ToastMessage | null;
  showToast: (message: string, tone?: ToastTone) => void;
  dismissToast: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const dismissToast = useCallback(() => {
    setToast(clearToastState());
  }, []);

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = `${Date.now()}`;
    setToast({ id, message, tone });
    void AccessibilityInfo.announceForAccessibility(message);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismissToast, TOAST_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [toast, dismissToast]);

  const value = useMemo(
    () => ({ toast, showToast, dismissToast }),
    [toast, showToast, dismissToast],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

function toneStyle(tone: ToastTone) {
  if (tone === 'error') return styles.error;
  if (tone === 'success') return styles.success;
  return styles.info;
}

export function ToastViewport() {
  const insets = useSafeAreaInsets();
  const { toast, dismissToast } = useToast();

  if (!toast) return null;

  return (
    <View pointerEvents="box-none" style={[styles.viewport, { top: insets.top + 44 }]}>
      <Pressable
        onPress={dismissToast}
        style={[styles.toast, toneStyle(toast.tone)]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <Text style={styles.text}>{toast.message}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 100,
  },
  toast: {
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  success: {
    backgroundColor: terminal.card,
    borderColor: terminal.accent,
  },
  error: {
    backgroundColor: terminal.card,
    borderColor: terminal.danger,
  },
  info: {
    backgroundColor: terminal.card,
    borderColor: terminal.border,
  },
  text: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 13,
    lineHeight: 18,
  },
});

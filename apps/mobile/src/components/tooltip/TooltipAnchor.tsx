import React, { useEffect, useRef } from 'react';
import { Pressable, View, type View as ViewType } from 'react-native';
import { useTooltip } from './TooltipContext';
import type { AnchorLayout, TooltipDefinition } from './types';

const DEFAULT_MOUNT_DELAY_MS = 500;

export interface TooltipAnchorProps {
  tooltip: TooltipDefinition;
  trigger: 'first-mount' | 'tap' | 'long-press' | 'manual';
  isVisible?: boolean;
  enabled?: boolean;
  mountDelayMs?: number;
  onDismiss?: () => void;
  children: React.ReactNode;
}

function measureAnchor(view: ViewType | null): Promise<AnchorLayout | null> {
  return new Promise((resolve) => {
    if (!view || !('measureInWindow' in view)) {
      resolve(null);
      return;
    }
    view.measureInWindow((x, y, width, height) => {
      resolve({ x, y, width, height });
    });
  });
}

export function TooltipAnchor({
  tooltip,
  trigger,
  isVisible = false,
  enabled = true,
  mountDelayMs = DEFAULT_MOUNT_DELAY_MS,
  onDismiss,
  children,
}: TooltipAnchorProps) {
  const anchorRef = useRef<View>(null);
  const { ready, showTooltip, dismissTooltip, isDismissed } = useTooltip();
  const mountedRef = useRef(false);

  const openTooltip = async () => {
    if (!enabled || isDismissed(tooltip.id)) return;
    const layout = await measureAnchor(anchorRef.current);
    showTooltip(tooltip, layout);
  };

  useEffect(() => {
    if (trigger !== 'first-mount' || !ready || !enabled || mountedRef.current) return;
    if (isDismissed(tooltip.id)) return;
    mountedRef.current = true;
    const timer = setTimeout(() => {
      void openTooltip();
    }, mountDelayMs);
    return () => clearTimeout(timer);
    // isDismissed intentionally omitted — hydration updates must not cancel the mount timer.
  }, [trigger, ready, enabled, mountDelayMs, tooltip.id]);

  useEffect(() => {
    if (trigger !== 'manual') return;
    if (isVisible) {
      void openTooltip();
    } else {
      dismissTooltip(tooltip.id);
      onDismiss?.();
    }
  }, [trigger, isVisible, tooltip.id]);

  if (trigger === 'tap' || trigger === 'long-press') {
    return (
      <View ref={anchorRef} collapsable={false}>
        <Pressable
          onPress={trigger === 'tap' ? () => void openTooltip() : undefined}
          onLongPress={trigger === 'long-press' ? () => void openTooltip() : undefined}
          accessibilityRole="button"
        >
          {children}
        </Pressable>
      </View>
    );
  }

  return (
    <View ref={anchorRef} collapsable={false}>
      {children}
    </View>
  );
}

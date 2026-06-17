import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  loadTooltipDismissals,
  persistTooltipDismissal,
} from '../../game/tooltipDismissal';
import { TooltipOverlay } from './TooltipOverlay';
import type { AnchorLayout, TooltipDefinition } from './types';

interface ActiveTooltip {
  definition: TooltipDefinition;
  anchor: AnchorLayout | null;
}

export interface TooltipContextValue {
  ready: boolean;
  activeTooltipId: string | null;
  showTooltip: (definition: TooltipDefinition, anchor?: AnchorLayout | null) => void;
  dismissTooltip: (tooltipId?: string) => void;
  dismissActiveTooltip: () => void;
  isDismissed: (tooltipId: string) => boolean;
}

const TooltipContext = createContext<TooltipContextValue | null>(null);

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [persistentDismissed, setPersistentDismissed] = useState<Set<string>>(new Set());
  const [sessionDismissed, setSessionDismissed] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<ActiveTooltip | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const state = await loadTooltipDismissals();
      if (!cancelled) {
        setPersistentDismissed(state.dismissed);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReducedMotion)
      .catch(() => setReducedMotion(false));
    const subscription = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      setReducedMotion,
    );
    return () => subscription?.remove();
  }, []);

  const isDismissed = useCallback(
    (tooltipId: string) =>
      persistentDismissed.has(tooltipId) || sessionDismissed.has(tooltipId),
    [persistentDismissed, sessionDismissed],
  );

  const dismissActiveTooltip = useCallback(() => {
    setActive((current) => {
      if (!current) return null;
      const { definition } = current;
      if (definition.showOncePerSession) {
        setSessionDismissed((prev) => new Set(prev).add(definition.id));
      }
      if (definition.persistDismissal) {
        setPersistentDismissed((prev) => new Set(prev).add(definition.id));
        void persistTooltipDismissal(definition.id);
      }
      return null;
    });
  }, []);

  const dismissTooltip = useCallback(
    (tooltipId?: string) => {
      setActive((current) => {
        if (!current) return null;
        if (tooltipId && current.definition.id !== tooltipId) return current;
        const { definition } = current;
        if (definition.showOncePerSession) {
          setSessionDismissed((prev) => new Set(prev).add(definition.id));
        }
        if (definition.persistDismissal) {
          setPersistentDismissed((prev) => new Set(prev).add(definition.id));
          void persistTooltipDismissal(definition.id);
        }
        return null;
      });
    },
    [],
  );

  const showTooltip = useCallback(
    (definition: TooltipDefinition, anchor: AnchorLayout | null = null) => {
      if (isDismissed(definition.id)) return;
      setActive({ definition, anchor });
    },
    [isDismissed],
  );

  const value = useMemo(
    () => ({
      ready,
      activeTooltipId: active?.definition.id ?? null,
      showTooltip,
      dismissTooltip,
      dismissActiveTooltip,
      isDismissed,
    }),
    [ready, active, showTooltip, dismissTooltip, dismissActiveTooltip, isDismissed],
  );

  return (
    <TooltipContext.Provider value={value}>
      {children}
      <TooltipOverlay
        visible={Boolean(active)}
        tooltip={active?.definition ?? null}
        anchor={active?.anchor ?? null}
        reducedMotion={reducedMotion}
        onDismiss={dismissActiveTooltip}
      />
    </TooltipContext.Provider>
  );
}

export function useTooltip(): TooltipContextValue {
  const ctx = useContext(TooltipContext);
  if (!ctx) throw new Error('useTooltip must be used within TooltipProvider');
  return ctx;
}

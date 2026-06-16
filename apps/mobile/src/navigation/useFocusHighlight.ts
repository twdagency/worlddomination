import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export const FOCUS_HIGHLIGHT_MS = 1500;

/** Brief highlight flash when a screen focuses an entity (respects reduced motion). */
export function useFocusHighlight(focusId: string | undefined, durationMs = FOCUS_HIGHLIGHT_MS) {
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  useEffect(() => {
    if (!focusId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled) return;
      setHighlightedId(focusId);
      if (reduceMotion) {
        setHighlightedId(null);
        return;
      }
      timer = setTimeout(() => setHighlightedId(null), durationMs);
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [focusId, durationMs]);

  return highlightedId;
}

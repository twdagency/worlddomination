import React, { act, useEffect } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import TestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameProvider, useGame } from '../src/game/GameContext';
import { STORAGE_KEYS } from '../src/theme/terminal';

vi.mock('../src/components/feedback/ToastProvider', () => ({
  useToast: () => ({ showToast: vi.fn(), dismissToast: vi.fn(), toast: null }),
}));

vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-native')>();
  return {
    ...actual,
    AppState: {
      addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    },
  };
});

function ReadStateProbe({
  onUpdate,
}: {
  onUpdate: (value: { lastViewedDispatchesAt: number; markDispatchesViewed: () => void }) => void;
}) {
  const { lastViewedDispatchesAt, markDispatchesViewed, ready } = useGame();
  useEffect(() => {
    if (!ready) return;
    onUpdate({ lastViewedDispatchesAt, markDispatchesViewed });
  }, [ready, lastViewedDispatchesAt, markDispatchesViewed, onUpdate]);
  return null;
}

describe('GameContext dispatch read state', () => {
  beforeEach(() => {
    vi.mocked(AsyncStorage.getItem).mockReset();
    vi.mocked(AsyncStorage.setItem).mockReset();
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    vi.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
  });

  it('hydrates lastViewedDispatchesAt from AsyncStorage on mount', async () => {
    vi.mocked(AsyncStorage.getItem).mockImplementation(async (key) => {
      if (key === STORAGE_KEYS.lastViewedDispatchesAt) return '1700600000000';
      return null;
    });

    let lastViewed = -1;
    await act(async () => {
      TestRenderer.create(
        <GameProvider>
          <ReadStateProbe
            onUpdate={({ lastViewedDispatchesAt }) => {
              lastViewed = lastViewedDispatchesAt;
            }}
          />
        </GameProvider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(lastViewed).toBe(1_700_600_000_000);
  });

  it('persists timestamp when markDispatchesViewed is called', async () => {
    const now = 1_700_600_123_456;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    let markDispatchesViewed: (() => void) | null = null;
    await act(async () => {
      TestRenderer.create(
        <GameProvider>
          <ReadStateProbe
            onUpdate={(value) => {
              markDispatchesViewed = value.markDispatchesViewed;
            }}
          />
        </GameProvider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await act(async () => {
      markDispatchesViewed?.();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.lastViewedDispatchesAt,
      String(now),
    );

    vi.mocked(Date.now).mockRestore();
  });
});

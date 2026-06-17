import React, { act, useEffect } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import TestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameProvider, useGame } from '../src/game/GameContext';
import { serializeDispatchReadState } from '../src/game/dispatchReadState';
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
  onUpdate: (value: {
    dispatchReadState: { atMs: number; throughEventSerial: number };
    markDispatchesViewed: () => void;
    worldNowMs: number;
  }) => void;
}) {
  const { dispatchReadState, markDispatchesViewed, ready, world } = useGame();
  useEffect(() => {
    if (!ready) return;
    onUpdate({ dispatchReadState, markDispatchesViewed, worldNowMs: world.nowMs });
  }, [ready, dispatchReadState, markDispatchesViewed, world.nowMs, onUpdate]);
  return null;
}

describe('GameContext dispatch read state', () => {
  beforeEach(() => {
    vi.mocked(AsyncStorage.getItem).mockReset();
    vi.mocked(AsyncStorage.setItem).mockReset();
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    vi.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
  });

  it('hydrates dispatchReadState from AsyncStorage on mount', async () => {
    const stored = { atMs: 1_700_600_000_000, throughEventSerial: 42 };
    vi.mocked(AsyncStorage.getItem).mockImplementation(async (key) => {
      if (key === STORAGE_KEYS.lastViewedDispatchesAt) return serializeDispatchReadState(stored);
      return null;
    });

    let readAt = -1;
    await act(async () => {
      TestRenderer.create(
        <GameProvider>
          <ReadStateProbe
            onUpdate={({ dispatchReadState }) => {
              readAt = dispatchReadState.atMs;
            }}
          />
        </GameProvider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(readAt).toBe(stored.atMs);
  });

  it('persists sim read state when markDispatchesViewed is called', async () => {
    let markDispatchesViewed: (() => void) | null = null;
    let worldNowMs = 0;
    await act(async () => {
      TestRenderer.create(
        <GameProvider>
          <ReadStateProbe
            onUpdate={(value) => {
              markDispatchesViewed = value.markDispatchesViewed;
              worldNowMs = value.worldNowMs;
            }}
          />
        </GameProvider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(worldNowMs).toBeGreaterThan(0);

    await act(async () => {
      markDispatchesViewed?.();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.lastViewedDispatchesAt,
      serializeDispatchReadState({ atMs: worldNowMs, throughEventSerial: -1 }),
    );
  });
});

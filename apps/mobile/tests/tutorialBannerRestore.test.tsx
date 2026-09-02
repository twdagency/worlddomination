import React, { act } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import TestRenderer from 'react-test-renderer';
import { createTutorialWorld } from 'shared';
import { PersistentHeader } from '../src/components/PersistentHeader';

const restoreBanner = vi.fn();

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => React.createElement('Ionicons', null),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: vi.fn() }),
}));

vi.mock('../src/game/GameContext', () => ({
  useGame: () => mockGameState,
}));

let mockGameState: {
  world: ReturnType<typeof createTutorialWorld>;
  dispatches: [];
  awayMs: number;
  isTutorialActive: boolean;
  isBannerDismissed: boolean;
  restoreBanner: typeof restoreBanner;
  returnToMenu: () => void;
};

function renderHeader() {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<PersistentHeader />);
  });
  return tree;
}

beforeEach(() => {
  restoreBanner.mockReset();
  mockGameState = {
    world: createTutorialWorld(),
    dispatches: [],
    awayMs: 0,
    isTutorialActive: true,
    isBannerDismissed: true,
    restoreBanner,
    returnToMenu: vi.fn(),
  };
});

describe('tutorial banner restore control', () => {
  it('shows restore button when tutorial is active and banner dismissed', () => {
    const tree = renderHeader();
    expect(tree.root.findByProps({ testID: 'tutorial-banner-restore' })).toBeTruthy();
  });

  it('hides restore button when banner is not dismissed', () => {
    mockGameState.isBannerDismissed = false;
    const tree = renderHeader();
    expect(() => tree.root.findByProps({ testID: 'tutorial-banner-restore' })).toThrow();
  });

  it('calls restoreBanner when restore button is pressed', () => {
    const tree = renderHeader();
    const restore = tree.root.findByProps({ testID: 'tutorial-banner-restore' });
    act(() => {
      restore.props.onPress();
    });
    expect(restoreBanner).toHaveBeenCalledTimes(1);
  });
});

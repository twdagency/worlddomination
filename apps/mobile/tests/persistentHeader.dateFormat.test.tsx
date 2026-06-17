import React, { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import TestRenderer from 'react-test-renderer';
import { createSprint4World } from 'shared';
import { PersistentHeader } from '../src/components/PersistentHeader';
import { formatGameClock } from '../src/utils/format';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => React.createElement('Ionicons', null),
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: vi.fn() }),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock('../src/game/GameContext', () => ({
  useGame: () => ({
    world: createSprint4World(1_700_000_000_000),
    dispatches: [],
    awayMs: 0,
    dispatchReadState: { atMs: 0, throughEventSerial: -1 },
    isTutorialActive: false,
    isBannerDismissed: false,
    restoreBanner: vi.fn(),
  }),
}));

function collectText(node: TestRenderer.ReactTestInstance): string {
  return node.children
    .map((child) => (typeof child === 'string' ? child : collectText(child)))
    .join(' ');
}

describe('PersistentHeader date format', () => {
  it('abbreviates without weekday and fits narrow layout', () => {
    const world = createSprint4World(1_700_000_000_000);
    const clock = formatGameClock(world.nowMs);
    expect(clock).not.toMatch(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/);
    expect(clock).toContain('·');

    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<PersistentHeader />);
    });

    const text = collectText(tree.root).replace(/\s+/g, ' ').trim();
    expect(text).toMatch(/Day 1 ·/);
    expect(text).toContain(clock);
    expect(text.length).toBeLessThan(120);
  });
});

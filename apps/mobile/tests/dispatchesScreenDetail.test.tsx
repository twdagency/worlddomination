import React, { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import TestRenderer from 'react-test-renderer';
import { createSprint4World } from 'shared';
import { DispatchesScreen } from '../src/screens/DispatchesScreen';

const goBackMock = vi.fn();

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => React.createElement('Ionicons', null),
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: goBackMock }),
  useRoute: () => ({ params: undefined, key: 'dispatches', name: 'Dispatches' }),
  useFocusEffect: (callback: () => void) => {
    callback();
  },
}));

vi.mock('../src/game/devFlag', () => ({
  showDevControls: false,
}));

vi.mock('../src/game/GameContext', () => ({
  useGame: () => ({
    world: createSprint4World(),
    dispatches: [],
    awayMs: 0,
    markDispatchesViewed: vi.fn(),
  }),
}));

function collectText(node: TestRenderer.ReactTestInstance): string {
  return node.children
    .map((child) => (typeof child === 'string' ? child : collectText(child)))
    .join(' ');
}

describe('DispatchesScreen detail view', () => {
  it('renders with a Home back button and title', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<DispatchesScreen />);
    });

    const text = collectText(tree.root);
    expect(text).toContain('Home');
    expect(text).toContain('Dispatches');
  });

  it('returns to the dashboard when the back button is pressed', () => {
    goBackMock.mockReset();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<DispatchesScreen />);
    });

    const back = tree.root.find(
      (node) => node.props.accessibilityLabel === 'Back to Home',
    );
    act(() => {
      back.props.onPress();
    });

    expect(goBackMock).toHaveBeenCalledTimes(1);
  });
});

import fs from 'node:fs';
import path from 'node:path';
import React, { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import TestRenderer from 'react-test-renderer';
import { createSprint4World } from 'shared';
import { DispatchesScreen } from '../src/screens/DispatchesScreen';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => React.createElement('Ionicons', null),
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: vi.fn() }),
  useRoute: () => ({ params: undefined, key: 'dispatches', name: 'Dispatches' }),
}));

vi.mock('../src/game/devFlag', () => ({
  isDevBuild: false,
  showDevControls: false,
}));

vi.mock('../src/game/GameContext', () => ({
  useGame: () => ({
    world: createSprint4World(),
    dispatches: [],
    awayMs: 0,
  }),
}));

function findByType(
  node: TestRenderer.ReactTestInstance,
  type: string,
): TestRenderer.ReactTestInstance | undefined {
  if (node.type === type) return node;
  for (const child of node.children) {
    if (typeof child !== 'object' || child === null) continue;
    const found = findByType(child, type);
    if (found) return found;
  }
  return undefined;
}

describe('scroll affordance', () => {
  it('DispatchesScreen source enables scroll indicators and fade gradient', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/screens/DispatchesScreen.tsx'),
      'utf8',
    );
    expect(source).toContain('showsVerticalScrollIndicator');
    expect(source).toContain('persistentScrollbar');
    expect(source).toContain('ScrollFadeFooter');
  });

  it('mounts scroll fade on DispatchesScreen', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<DispatchesScreen />);
    });
    const flatList = findByType(tree.root, 'FlatList');
    expect(flatList?.props.showsVerticalScrollIndicator).toBe(true);
    expect(flatList?.props.persistentScrollbar).toBe(true);
    expect(findByType(tree.root, 'LinearGradient')).toBeDefined();
  });
});

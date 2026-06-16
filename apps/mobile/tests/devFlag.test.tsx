import React, { act } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import TestRenderer from 'react-test-renderer';
import { createSprint4World } from 'shared';
import { DispatchesScreen } from '../src/screens/DispatchesScreen';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => React.createElement('Ionicons', null),
}));

const showDevControlsRef = vi.hoisted(() => ({ value: true }));

const goBackMock = vi.fn();

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: goBackMock }),
  useRoute: () => ({ params: undefined, key: 'dispatches', name: 'Dispatches' }),
}));

vi.mock('../src/game/devFlag', () => ({
  get isDevBuild() {
    return showDevControlsRef.value;
  },
  get showDevControls() {
    return showDevControlsRef.value;
  },
}));

vi.mock('../src/game/GameContext', () => ({
  useGame: () => ({
    world: createSprint4World(),
    dispatches: [],
    awayMs: 0,
    skipNext: vi.fn(),
    scenarioId: 'sprint-4-ai-world',
    loadScenario: vi.fn(),
  }),
}));

function collectText(node: TestRenderer.ReactTestInstance): string {
  return node.children
    .map((child) => (typeof child === 'string' ? child : collectText(child)))
    .join(' ');
}

function renderDispatches() {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<DispatchesScreen />);
  });
  return tree;
}

describe('devFlag gating', () => {
  beforeEach(() => {
    showDevControlsRef.value = true;
  });

  it('shows dev controls when showDevControls is true', () => {
    const text = collectText(renderDispatches().root);
    expect(text).toContain('[DEV] Scenario');
    expect(text).toContain('[DEV] Skip');
  });

  it('hides dev controls when showDevControls is false', () => {
    showDevControlsRef.value = false;
    const text = collectText(renderDispatches().root);
    expect(text).not.toContain('[DEV] Scenario');
    expect(text).not.toContain('[DEV] Skip to next event');
  });
});

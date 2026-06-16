import React, { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import TestRenderer from 'react-test-renderer';
import { Pressable } from 'react-native';
import { TUTORIAL_BEAT_COPY } from 'shared';
import { TutorialBanner } from './TutorialBanner';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => React.createElement('Ionicons', null),
}));

function renderBanner(
  copy = TUTORIAL_BEAT_COPY.movement,
  onDismiss = () => undefined,
  isHandoffReady = false,
  onGraduate = () => undefined,
  mode: 'collapsed' | 'expanded' = 'expanded',
) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <TutorialBanner
        copy={copy}
        mode={mode}
        onDismiss={onDismiss}
        onExpand={() => undefined}
        onCollapse={() => undefined}
        isHandoffReady={isHandoffReady}
        onGraduate={onGraduate}
      />,
    );
  });
  return tree;
}

function collectText(node: TestRenderer.ReactTestInstance): string[] {
  const parts: string[] = [];
  node.children.forEach((child) => {
    if (typeof child === 'string') {
      parts.push(child);
      return;
    }
    parts.push(...collectText(child));
  });
  return parts;
}

describe('TutorialBanner', () => {
  const copy = TUTORIAL_BEAT_COPY.movement;

  it('renders title and body when copy is provided', () => {
    const tree = renderBanner();
    const text = collectText(tree.root).join(' ');
    expect(text).toContain(copy.title);
    expect(text).toContain(copy.body);
    expect(tree.root.findByProps({ testID: 'tutorial-banner' })).toBeTruthy();
  });

  it('calls dismissBanner when the close control is pressed', () => {
    const onDismiss = vi.fn();
    const tree = renderBanner(copy, onDismiss);
    const dismiss = tree.root.findByProps({ testID: 'tutorial-banner-dismiss' });
    act(() => {
      dismiss.props.onPress();
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('expands the Why hint section on tap', () => {
    const tree = renderBanner();
    expect(collectText(tree.root).join(' ')).not.toContain(copy.hint!);

    const whyRow = tree.root.findAll(
      (node) => node.type === Pressable && collectText(node).some((line) => line.includes('Why?')),
    )[0];
    act(() => {
      whyRow.props.onPress();
    });

    expect(collectText(tree.root).join(' ')).toContain(copy.hint!);
  });

  it('shows Continue to Sandbox when handoff is ready', () => {
    const tree = renderBanner(TUTORIAL_BEAT_COPY.handoff, () => undefined, true, () => undefined);
    expect(tree.root.findByProps({ testID: 'tutorial-graduate' })).toBeTruthy();
    expect(collectText(tree.root).join(' ')).toContain('Continue to Sandbox');
  });

  it('calls onGraduate when the graduate button is pressed', () => {
    const onGraduate = vi.fn();
    const tree = renderBanner(TUTORIAL_BEAT_COPY.handoff, () => undefined, true, onGraduate);
    const graduate = tree.root.findByProps({ testID: 'tutorial-graduate' });
    act(() => {
      graduate.props.onPress();
    });
    expect(onGraduate).toHaveBeenCalledTimes(1);
  });
});

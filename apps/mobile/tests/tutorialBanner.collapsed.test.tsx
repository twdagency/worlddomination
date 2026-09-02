import React, { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import TestRenderer from 'react-test-renderer';
import { TUTORIAL_BEAT_COPY } from 'shared';
import { TutorialBanner } from '../src/components/tutorial/TutorialBanner';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => React.createElement('Ionicons', null),
}));

function renderBanner(
  mode: 'collapsed' | 'expanded',
  onExpand = vi.fn(),
  onCollapse = vi.fn(),
) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <TutorialBanner
        copy={TUTORIAL_BEAT_COPY.movement}
        mode={mode}
        onDismiss={() => undefined}
        onExpand={onExpand}
        onCollapse={onCollapse}
      />,
    );
  });
  return tree;
}

function collectText(node: TestRenderer.ReactTestInstance): string {
  return node.children
    .map((child) => {
      if (typeof child === 'string') return child;
      return collectText(child);
    })
    .join(' ');
}

describe('TutorialBanner collapsed mode', () => {
  it('renders collapsed mode with title only', () => {
    const tree = renderBanner('collapsed');
    const text = collectText(tree.root);
    expect(text).toContain(TUTORIAL_BEAT_COPY.movement.title);
    expect(text).not.toContain(TUTORIAL_BEAT_COPY.movement.body);
  });

  it('renders expanded mode with body copy', () => {
    const tree = renderBanner('expanded');
    const text = collectText(tree.root);
    expect(text).toContain(TUTORIAL_BEAT_COPY.movement.title);
    expect(text).toContain(TUTORIAL_BEAT_COPY.movement.body);
  });

  it('tap collapsed banner expands via onExpand', () => {
    const onExpand = vi.fn();
    const tree = renderBanner('collapsed', onExpand);
    const toggle = tree.root.findByProps({ testID: 'tutorial-banner-toggle' });
    act(() => {
      toggle.props.onPress();
    });
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it('tap expanded banner collapses via onCollapse', () => {
    const onCollapse = vi.fn();
    const tree = renderBanner('expanded', undefined, onCollapse);
    const toggle = tree.root.findByProps({ testID: 'tutorial-banner-toggle' });
    act(() => {
      toggle.props.onPress();
    });
    expect(onCollapse).toHaveBeenCalledTimes(1);
  });
});

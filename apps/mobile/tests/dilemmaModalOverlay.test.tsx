import React, { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import TestRenderer from 'react-test-renderer';
import { FOREIGN_RULE_DILEMMA } from 'sim';
import type { Dilemma } from 'shared';
import { DilemmaModalOverlay } from '../src/components/dilemma/DilemmaModalOverlay';

const STANDARD_DILEMMA: Dilemma = {
  ...FOREIGN_RULE_DILEMMA,
  id: 'standard-sample',
  urgency: 'standard',
};

function renderOverlay(
  props: Partial<React.ComponentProps<typeof DilemmaModalOverlay>> = {},
) {
  const onDismiss = vi.fn();
  const onResolve = vi.fn();
  let tree!: TestRenderer.ReactTestRenderer;

  act(() => {
    tree = TestRenderer.create(
      <DilemmaModalOverlay
        visible
        dilemma={FOREIGN_RULE_DILEMMA}
        urgency="crisis"
        canDismiss={false}
        onDismiss={onDismiss}
        onResolve={onResolve}
        {...props}
      />,
    );
  });

  return { tree, onDismiss, onResolve };
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

describe('DilemmaModalOverlay', () => {
  it('renders title, prompt, and options for a crisis dilemma', () => {
    const { tree } = renderOverlay();
    const text = collectText(tree.root).join(' ');

    expect(text).toContain(FOREIGN_RULE_DILEMMA.title);
    expect(text).toContain(FOREIGN_RULE_DILEMMA.prompt);
    for (const option of FOREIGN_RULE_DILEMMA.options) {
      expect(text).toContain(option.label);
    }
  });

  it('hides dismiss control for crisis dilemmas', () => {
    const { tree } = renderOverlay({ canDismiss: false, urgency: 'crisis' });
    expect(() => tree.root.findByProps({ testID: 'dilemma-overlay-dismiss' })).toThrow();
  });

  it('shows dismiss control for standard dilemmas', () => {
    const { tree, onDismiss } = renderOverlay({
      dilemma: STANDARD_DILEMMA,
      urgency: 'standard',
      canDismiss: true,
    });
    const dismiss = tree.root.findByProps({ testID: 'dilemma-overlay-dismiss' });

    act(() => {
      dismiss.props.onPress();
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onResolve with the chosen option id', () => {
    const { tree, onResolve } = renderOverlay();
    const choose = tree.root.findByProps({ testID: 'dilemma-choose-conciliation' }) as TestRenderer.ReactTestInstance & {
      props: { onPress: () => void };
    };

    act(() => {
      choose.props.onPress();
    });

    expect(onResolve).toHaveBeenCalledWith('conciliation');
  });
});

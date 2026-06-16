import React, { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import TestRenderer from 'react-test-renderer';
import { Pressable } from 'react-native';
import { FOREIGN_RULE_DILEMMA } from 'sim';
import { DilemmaModal } from '../src/components/dilemma/DilemmaModal';

function renderModal(
  props: Partial<React.ComponentProps<typeof DilemmaModal>> = {},
) {
  const onClose = vi.fn();
  const onResolve = vi.fn();
  let tree!: TestRenderer.ReactTestRenderer;

  act(() => {
    tree = TestRenderer.create(
      <DilemmaModal
        visible
        dilemma={FOREIGN_RULE_DILEMMA}
        onClose={onClose}
        onResolve={onResolve}
        {...props}
      />,
    );
  });

  return { tree, onClose, onResolve };
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

describe('DilemmaModal', () => {
  it('renders dilemma title, prompt, and all options', () => {
    const { tree } = renderModal();
    const text = collectText(tree.root).join(' ');

    expect(text).toContain(FOREIGN_RULE_DILEMMA.title);
    expect(text).toContain(FOREIGN_RULE_DILEMMA.prompt);
    for (const option of FOREIGN_RULE_DILEMMA.options) {
      expect(text).toContain(option.label);
      expect(text).toContain(option.description);
    }
  });

  it('calls onResolve with the chosen option id', () => {
    const { tree, onResolve } = renderModal();
    const choose = tree.root.findByProps({ testID: 'dilemma-choose-conciliation' });

    act(() => {
      choose.props.onPress();
    });

    expect(onResolve).toHaveBeenCalledWith('conciliation');
  });

  it('calls onClose without resolving when dismissed', () => {
    const { tree, onClose } = renderModal();
    const close = tree.root.findByProps({ testID: 'dilemma-modal-close' });

    act(() => {
      close.props.onPress();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

import React, { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import TestRenderer from 'react-test-renderer';
import { LinkText } from '../src/components/navigation/LinkText';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => React.createElement('Ionicons', null),
}));

describe('LinkText', () => {
  it('renders label text and invokes onPress when tapped', () => {
    const onPress = vi.fn();
    let tree!: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <LinkText testID="entity-link" onPress={onPress}>
          Paris
        </LinkText>,
      );
    });

    const link = tree.root.findByProps({ testID: 'entity-link' });
    expect(link).toBeDefined();

    act(() => {
      link.props.onPress();
    });

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

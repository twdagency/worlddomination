import React, { act } from 'react';
import { describe, expect, it } from 'vitest';
import TestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import { DefeatedCountryBadge } from '../src/components/country/DefeatedCountryBadge';

describe('DefeatedCountryBadge', () => {
  it('renders the defeated badge label', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<DefeatedCountryBadge />);
    });

    expect(tree.root.findByProps({ testID: 'defeated-country-badge' })).toBeTruthy();
    const labels = tree.root.findAllByType(Text);
    expect(labels.some((node) => node.props.children === 'Defeated')).toBe(true);
  });
});

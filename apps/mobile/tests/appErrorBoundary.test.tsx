import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { AppErrorBoundary } from '../src/components/AppErrorBoundary';

function Boom(): never {
  throw new Error('render failed');
}

describe('AppErrorBoundary', () => {
  it('renders a reset path instead of crashing', () => {
    const onReset = vi.fn();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <AppErrorBoundary onReset={onReset}>
          <Boom />
        </AppErrorBoundary>,
      );
    });

    expect(tree!.root.findByProps({ testID: 'app-error-boundary' })).toBeTruthy();
    act(() => {
      tree!.root.findByProps({ testID: 'app-error-reset' }).props.onPress();
    });
    expect(onReset).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });

  it('renders children when no error is thrown', () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <AppErrorBoundary onReset={() => undefined}>
          <Text>ok</Text>
        </AppErrorBoundary>,
      );
    });
    expect(tree!.root.findByType(Text).props.children).toBe('ok');
  });
});

import React, { act } from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import TestRenderer from 'react-test-renderer';
import { TooltipProvider, useTooltip } from '../src/components/tooltip/TooltipContext';
import { TooltipAnchor } from '../src/components/tooltip/TooltipAnchor';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

const TOOLTIP = {
  id: 'test-tooltip',
  title: 'Test',
  body: 'Tooltip body copy',
  dismissable: true,
  showOncePerSession: true,
};

function ActiveTooltipProbe() {
  const { activeTooltipId } = useTooltip();
  return <>{activeTooltipId ?? 'none'}</>;
}

async function flushProviderReady() {
  await act(async () => {
    await Promise.resolve();
  });
}

function findAnchorPressable(tree: TestRenderer.ReactTestRenderer) {
  return tree.root.findAll((node) => typeof node.props.onPress === 'function')[0];
}

function hasVisibleTooltip(tree: TestRenderer.ReactTestRenderer): boolean {
  const overlays = tree.root.findAllByProps({ testID: 'tooltip-overlay' });
  return overlays.some((node) => node.props.visible === true);
}

describe('tooltip system', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows tooltip on tap trigger', async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <TooltipProvider>
          <TooltipAnchor tooltip={TOOLTIP} trigger="tap">
            <></>
          </TooltipAnchor>
          <ActiveTooltipProbe />
        </TooltipProvider>,
      );
    });

    await flushProviderReady();

    await act(async () => {
      findAnchorPressable(tree)?.props.onPress?.();
      await Promise.resolve();
    });

    expect(tree.root.findByProps({ testID: 'tooltip-overlay' }).props.visible).toBe(true);
    expect(tree.root.findByProps({ testID: `tooltip-card-${TOOLTIP.id}` })).toBeTruthy();
  });

  it('dismisses tooltip from backdrop tap', async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <TooltipProvider>
          <TooltipAnchor tooltip={TOOLTIP} trigger="tap">
            <></>
          </TooltipAnchor>
          <ActiveTooltipProbe />
        </TooltipProvider>,
      );
    });

    await flushProviderReady();

    await act(async () => {
      findAnchorPressable(tree)?.props.onPress?.();
      await Promise.resolve();
    });

    await act(async () => {
      tree.root.findByProps({ testID: 'tooltip-backdrop' }).props.onPress();
    });

    expect(hasVisibleTooltip(tree)).toBe(false);
  });

  it('dismisses tooltip from close control', async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <TooltipProvider>
          <TooltipAnchor tooltip={TOOLTIP} trigger="tap">
            <></>
          </TooltipAnchor>
        </TooltipProvider>,
      );
    });

    await flushProviderReady();

    await act(async () => {
      findAnchorPressable(tree)?.props.onPress?.();
      await Promise.resolve();
    });

    await act(async () => {
      tree.root.findByProps({ testID: 'tooltip-dismiss' }).props.onPress();
    });

    expect(hasVisibleTooltip(tree)).toBe(false);
  });

  it('fires first-mount tooltip after delay', async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <TooltipProvider>
          <TooltipAnchor
            tooltip={{ ...TOOLTIP, id: 'first-mount', showOncePerSession: false }}
            trigger="first-mount"
            mountDelayMs={500}
          >
            <></>
          </TooltipAnchor>
          <ActiveTooltipProbe />
        </TooltipProvider>,
      );
    });

    await flushProviderReady();

    expect(hasVisibleTooltip(tree)).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(hasVisibleTooltip(tree)).toBe(true);
  });

  it('does not re-show session-dismissed tooltip on second tap', async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <TooltipProvider>
          <TooltipAnchor tooltip={TOOLTIP} trigger="tap">
            <></>
          </TooltipAnchor>
        </TooltipProvider>,
      );
    });

    await flushProviderReady();

    const open = () => findAnchorPressable(tree)?.props.onPress?.();

    await act(async () => {
      open();
      await Promise.resolve();
    });
    await act(async () => {
      tree.root.findByProps({ testID: 'tooltip-backdrop' }).props.onPress();
    });

    await act(async () => {
      open();
      await Promise.resolve();
    });

    expect(hasVisibleTooltip(tree)).toBe(false);
  });
});

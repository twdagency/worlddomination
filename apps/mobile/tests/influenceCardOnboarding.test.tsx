import React, { act } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import TestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSprint4World, LEADERS_BY_ID, UNIT_TYPES_BY_ID } from 'shared';
import { ensureWorldMigrations, setInfluence } from 'sim';
import { InfluenceCard } from '../src/components/dashboard/InfluenceCard';
import { TooltipProvider } from '../src/components/tooltip/TooltipContext';
import { selectPlayerInfluenceSummary } from '../src/game/influenceSelector';
import { INFLUENCE_CARD_FIRST_VIEW_TOOLTIP } from '../src/game/influenceTooltips';
import { STORAGE_KEYS } from '../src/theme/terminal';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

const START_MS = 1_700_000_000_000;
const PLAYER = 'faction-player';
const PARIS = 'territory-paris';

function worldWithInfluence() {
  let world = ensureWorldMigrations(createSprint4World(START_MS), {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
  world = setInfluence(world, PARIS, PLAYER, 47, START_MS);
  return world;
}

function hasVisibleTooltip(tree: TestRenderer.ReactTestRenderer): boolean {
  const overlays = tree.root.findAllByProps({ testID: 'tooltip-overlay' });
  return overlays.some((node) => node.props.visible === true);
}

async function flushProviderReady() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function advanceMountDelay() {
  await act(async () => {
    vi.advanceTimersByTime(500);
    await Promise.resolve();
  });
}

describe('influence card onboarding tooltip', () => {
  beforeEach(() => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    vi.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
  });

  it('shows first-view tooltip after mount delay when influence is active', async () => {
    vi.useFakeTimers();
    const summary = selectPlayerInfluenceSummary(worldWithInfluence())!;
    expect(summary.activeCityCount).toBeGreaterThan(0);
    let tree!: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <TooltipProvider>
          <InfluenceCard summary={summary} />
        </TooltipProvider>,
      );
    });

    await flushProviderReady();
    await advanceMountDelay();

    expect(hasVisibleTooltip(tree)).toBe(true);
    expect(
      tree.root.findByProps({ testID: `tooltip-card-${INFLUENCE_CARD_FIRST_VIEW_TOOLTIP.id}` }),
    ).toBeTruthy();
    vi.useRealTimers();
  });

  it('does not re-show tooltip in the same session after dismiss', async () => {
    vi.useFakeTimers();
    const summary = selectPlayerInfluenceSummary(worldWithInfluence())!;

    function ScenarioRoot({ showCard }: { showCard: boolean }) {
      return (
        <TooltipProvider>
          {showCard ? <InfluenceCard summary={summary} /> : null}
        </TooltipProvider>
      );
    }

    let tree!: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(<ScenarioRoot showCard />);
    });

    await flushProviderReady();
    await advanceMountDelay();
    expect(hasVisibleTooltip(tree)).toBe(true);

    await act(async () => {
      tree.root.findByProps({ testID: 'tooltip-dismiss' }).props.onPress();
    });

    act(() => {
      tree.update(<ScenarioRoot showCard={false} />);
    });

    act(() => {
      tree.update(<ScenarioRoot showCard />);
    });

    await flushProviderReady();
    await advanceMountDelay();
    expect(hasVisibleTooltip(tree)).toBe(false);
    vi.useRealTimers();
  });

  it('does not re-show persistently dismissed tooltip after storage hydration', async () => {
    vi.useFakeTimers();
    vi.mocked(AsyncStorage.getItem).mockImplementation(async (key) => {
      if (key === STORAGE_KEYS.tooltipDismissals) {
        return JSON.stringify([INFLUENCE_CARD_FIRST_VIEW_TOOLTIP.id]);
      }
      return null;
    });

    const summary = selectPlayerInfluenceSummary(worldWithInfluence())!;
    let tree!: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <TooltipProvider>
          <InfluenceCard summary={summary} />
        </TooltipProvider>,
      );
    });

    await flushProviderReady();
    await advanceMountDelay();
    expect(hasVisibleTooltip(tree)).toBe(false);
    vi.useRealTimers();
  });
});

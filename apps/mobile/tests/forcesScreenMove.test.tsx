import React, { act } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import TestRenderer from 'react-test-renderer';
import { createSprint4World, createTutorialWorld } from 'shared';
import { ForcesScreen } from '../src/screens/ForcesScreen';
import { OrderScreen } from '../src/screens/OrderScreen';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => React.createElement('Ionicons', null),
}));

vi.mock('react-native', async (importOriginal) => {
  const RN = await importOriginal<typeof import('react-native')>();
  const ReactNative = RN as typeof import('react-native') & {
    FlatList: typeof RN.FlatList;
  };

  function MockFlatList({
    data,
    renderItem,
    ListHeaderComponent,
    ListEmptyComponent,
  }: {
    data?: unknown[];
    renderItem: (info: { item: unknown; index: number }) => React.ReactNode;
    ListHeaderComponent?: React.ReactElement | (() => React.ReactElement);
    ListEmptyComponent?: React.ReactElement | (() => React.ReactElement);
  }) {
    const header =
      typeof ListHeaderComponent === 'function'
        ? ListHeaderComponent()
        : ListHeaderComponent;
    const empty =
      typeof ListEmptyComponent === 'function'
        ? ListEmptyComponent()
        : ListEmptyComponent;

    return React.createElement(
      ReactNative.View,
      null,
      header,
      data && data.length > 0
        ? data.map((item, index) => renderItem({ item, index }))
        : empty,
    );
  }

  return {
    ...RN,
    FlatList: MockFlatList,
  };
});

const navigateToMock = vi.fn();
const parentNavigation = { navigate: vi.fn() };

vi.mock('../src/navigation/deepLinks', () => ({
  navigateTo: (...args: unknown[]) => navigateToMock(...args),
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    getParent: () => parentNavigation,
    navigate: vi.fn(),
  }),
  useRoute: () => ({ params: routeParams }),
}));

let routeParams: { presetForceId?: string; presetDestinationId?: string } = {};

vi.mock('../src/game/GameContext', () => ({
  useGame: () => mockGameState,
}));

let mockGameState: {
  world: ReturnType<typeof createSprint4World>;
  wallNowMs: number;
};

beforeEach(() => {
  navigateToMock.mockClear();
  routeParams = {};
  mockGameState = {
    world: createSprint4World(),
    wallNowMs: createSprint4World().nowMs,
  };
});

function collectText(node: TestRenderer.ReactTestInstance): string {
  return node.children
    .map((child) => {
      if (typeof child === 'string') return child;
      return collectText(child);
    })
    .join(' ');
}

function findByTestId(
  node: TestRenderer.ReactTestInstance,
  testId: string,
): TestRenderer.ReactTestInstance | null {
  if (node.props?.testID === testId) return node;
  for (const child of node.children) {
    if (typeof child !== 'object' || child === null) continue;
    const found = findByTestId(child, testId);
    if (found) return found;
  }
  return null;
}

function renderForcesScreen() {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<ForcesScreen />);
  });
  return tree;
}

describe('ForcesScreen move integration', () => {
  it('renders movable force row with tap affordance', () => {
    const tree = renderForcesScreen();
    const text = collectText(tree.root);

    expect(text).toContain('Move →');
    expect(findByTestId(tree.root, 'force-movable-unit-player-mg')).not.toBeNull();
  });

  it('renders in-transit force row without move affordance', () => {
    const base = createSprint4World();
    mockGameState.world = {
      ...base,
      units: {
        'unit-player-mg': {
          ...base.units['unit-player-mg']!,
          locationId: undefined,
          transit: {
            fromId: 'territory-london',
            toCoord: base.territories['territory-paris']!.coord,
            toTerritoryId: 'territory-paris',
            departMs: base.nowMs,
            arriveMs: base.nowMs + 3_600_000,
            distanceKm: 300,
            stanceOnArrival: 'assault',
            intent: 'attack',
            beatId: 'test-beat',
            decisionTickMs: base.nowMs,
          },
        },
      },
    };
    mockGameState.wallNowMs = base.nowMs;

    const tree = renderForcesScreen();
    const text = collectText(tree.root);

    expect(text).toContain('IN TRANSIT');
    expect(text).not.toContain('Move →');
    expect(findByTestId(tree.root, 'force-in-transit-unit-player-mg')).not.toBeNull();
  });

  it('navigates to Order with presetForceId when a movable force is tapped', () => {
    const tree = renderForcesScreen();
    const row = findByTestId(tree.root, 'force-movable-unit-player-mg');
    expect(row).not.toBeNull();

    act(() => {
      row!.props.onPress();
    });

    expect(navigateToMock).toHaveBeenCalledWith(parentNavigation, {
      tab: 'actions',
      screen: 'order',
      presetForceId: 'unit-player-mg',
    });
  });

  it('tutorial Beat 1: Forces path and Order presetForceId select the same force', () => {
    const tutorialWorld = createTutorialWorld();
    mockGameState.world = tutorialWorld;
    mockGameState.wallNowMs = tutorialWorld.nowMs;

    const forcesTree = renderForcesScreen();
    const row = findByTestId(forcesTree.root, 'force-movable-unit-britain-infantry');
    expect(row).not.toBeNull();

    act(() => {
      row!.props.onPress();
    });

    expect(navigateToMock).toHaveBeenCalledWith(parentNavigation, {
      tab: 'actions',
      screen: 'order',
      presetForceId: 'unit-britain-infantry',
    });

    routeParams = { presetForceId: 'unit-britain-infantry' };
    let orderTree!: TestRenderer.ReactTestRenderer;
    act(() => {
      orderTree = TestRenderer.create(<OrderScreen />);
    });

    const orderText = collectText(orderTree.root);
    expect(orderText).toContain('Issue Move Order');
    expect(orderText).toContain('Deploy Levy');
  });
});

import React, { act } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import TestRenderer from 'react-test-renderer';
import { createSprint4World, LEADERS_BY_ID, UNIT_TYPES_BY_ID } from 'shared';
import { DEFAULT_TREATY_DURATION_MS, ensureWorldMigrations, formTreaty } from 'sim';
import { DiplomacyScreen } from '../src/screens/DiplomacyScreen';

const START_MS = 1_700_000_000_000;
const PLAYER = 'faction-player';
const TARGET_FACTION = 'faction-rome';
const TARGET_TERRITORY = 'territory-paris';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: (props: { testID?: string; name?: string }) =>
    React.createElement('Ionicons', { testID: props.testID, name: props.name }),
}));

vi.mock('react-native', async (importOriginal) => {
  const RN = await importOriginal<typeof import('react-native')>();

  function MockFlatList({
    data,
    renderItem,
    ListHeaderComponent,
    ListFooterComponent,
  }: {
    data?: unknown[];
    renderItem: (info: { item: unknown; index: number }) => React.ReactNode;
    ListHeaderComponent?: React.ReactElement | (() => React.ReactElement);
    ListFooterComponent?: React.ReactElement | (() => React.ReactElement);
  }) {
    const header =
      typeof ListHeaderComponent === 'function'
        ? ListHeaderComponent()
        : ListHeaderComponent;
    const footer =
      typeof ListFooterComponent === 'function'
        ? ListFooterComponent()
        : ListFooterComponent;

    return React.createElement(
      RN.View,
      null,
      header,
      data && data.length > 0
        ? data.map((item, index) => renderItem({ item, index }))
        : null,
      footer,
    );
  }

  return {
    ...RN,
    FlatList: MockFlatList,
  };
});

vi.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: {} }),
  useNavigation: () => ({ goBack: vi.fn() }),
}));

vi.mock('../src/navigation/useDeepLinkNavigation', () => ({
  useDeepLinkNavigation: () => vi.fn(),
}));

vi.mock('../src/navigation/useFocusHighlight', () => ({
  useFocusHighlight: () => null,
}));

const proposeTreaty = vi.fn(async () => undefined);

vi.mock('../src/game/GameContext', () => ({
  useGame: () => mockGameState,
}));

let mockGameState: {
  world: ReturnType<typeof ensureWorldMigrations>;
  dispatches: [];
  actionFeedback: null;
  proposeAlliance: ReturnType<typeof vi.fn>;
  breakAlliance: ReturnType<typeof vi.fn>;
  proposeTreaty: typeof proposeTreaty;
  acceptProposal: ReturnType<typeof vi.fn>;
  declineProposal: ReturnType<typeof vi.fn>;
};

function baseWorld(nowMs: number = START_MS) {
  return ensureWorldMigrations(createSprint4World(nowMs), {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

function worldWithParisTreaty(nowMs: number = START_MS) {
  return formTreaty(baseWorld(nowMs), {
    partyA: PLAYER,
    partyB: TARGET_FACTION,
    territoryIds: [TARGET_TERRITORY],
    formedAt: nowMs,
    expiresAt: nowMs + DEFAULT_TREATY_DURATION_MS,
  });
}

function renderDiplomacyScreen() {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<DiplomacyScreen />);
  });
  return tree;
}

function expandCountry(tree: TestRenderer.ReactTestRenderer, countryId: string) {
  const link = tree.root.findByProps({ testID: `diplomacy-country-link-${countryId}` });
  let node: TestRenderer.ReactTestInstance | null = link;
  let outerPressable: TestRenderer.ReactTestInstance | null = null;
  while (node) {
    if (typeof node.props.onPress === 'function') {
      outerPressable = node;
    }
    node = node.parent;
  }
  act(() => {
    outerPressable?.props.onPress?.();
  });
}

function openTreatyPicker(tree: TestRenderer.ReactTestRenderer, countryId: string) {
  expandCountry(tree, countryId);
  act(() => {
    tree.root.findByProps({ testID: `diplomacy-propose-treaty-${countryId}` }).props.onPress();
  });
}

beforeEach(() => {
  proposeTreaty.mockReset();
  mockGameState = {
    world: baseWorld(),
    dispatches: [],
    actionFeedback: null,
    proposeAlliance: vi.fn(),
    breakAlliance: vi.fn(),
    proposeTreaty,
    acceptProposal: vi.fn(),
    declineProposal: vi.fn(),
  };
});

describe('diplomacy treaty picker filter', () => {
  it('excludes territories already covered by an active treaty', () => {
    mockGameState.world = worldWithParisTreaty();
    const tree = renderDiplomacyScreen();
    openTreatyPicker(tree, TARGET_FACTION);

    expect(
      tree.root.findAllByProps({ testID: `treaty-territory-row-${TARGET_TERRITORY}` }),
    ).toHaveLength(0);
  });

  it('shows empty state when all target territories are already under treaty', () => {
    mockGameState.world = worldWithParisTreaty();
    const tree = renderDiplomacyScreen();
    openTreatyPicker(tree, TARGET_FACTION);

    const empty = tree.root.findByProps({ testID: 'treaty-picker-empty' });
    expect(empty.props.children.join('')).toContain('already under active treaty');
  });

  it('shows territory again after the treaty expires', () => {
    const expiredNow = START_MS + DEFAULT_TREATY_DURATION_MS + 1;
    mockGameState.world = {
      ...worldWithParisTreaty(START_MS),
      nowMs: expiredNow,
    };
    const tree = renderDiplomacyScreen();
    openTreatyPicker(tree, TARGET_FACTION);

    expect(
      tree.root.findByProps({ testID: `treaty-territory-row-${TARGET_TERRITORY}` }),
    ).toBeTruthy();
    expect(tree.root.findAllByProps({ testID: 'treaty-picker-empty' })).toHaveLength(0);
  });
});

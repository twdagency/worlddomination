import React, { act } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import TestRenderer from 'react-test-renderer';
import { createSprint4World, LEADERS_BY_ID, UNIT_TYPES_BY_ID } from 'shared';
import { ensureWorldMigrations } from 'sim';
import { DiplomacyScreen } from '../src/screens/DiplomacyScreen';

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
const proposeAlliance = vi.fn(async () => undefined);
const breakAlliance = vi.fn(async () => undefined);
const acceptProposal = vi.fn(async () => undefined);
const declineProposal = vi.fn(async () => undefined);

vi.mock('../src/game/GameContext', () => ({
  useGame: () => mockGameState,
}));

let mockGameState: {
  world: ReturnType<typeof ensureWorldMigrations>;
  dispatches: [];
  actionFeedback: null;
  proposeAlliance: typeof proposeAlliance;
  breakAlliance: typeof breakAlliance;
  proposeTreaty: typeof proposeTreaty;
  acceptProposal: typeof acceptProposal;
  declineProposal: typeof declineProposal;
};

function world() {
  return ensureWorldMigrations(createSprint4World(1_700_000_000_000), {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
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
  proposeAlliance.mockReset();
  breakAlliance.mockReset();
  acceptProposal.mockReset();
  declineProposal.mockReset();
  mockGameState = {
    world: world(),
    dispatches: [],
    actionFeedback: null,
    proposeAlliance,
    breakAlliance,
    proposeTreaty,
    acceptProposal,
    declineProposal,
  };
});

describe('treaty UX contracts (Sprint 9.5)', () => {
  it('treaty offer requires explicit confirmation before submission', () => {
    const tree = renderDiplomacyScreen();
    openTreatyPicker(tree, TARGET_FACTION);

    act(() => {
      tree.root.findByProps({ testID: `treaty-territory-row-${TARGET_TERRITORY}` }).props.onPress();
    });

    expect(proposeTreaty).not.toHaveBeenCalled();

    act(() => {
      tree.root.findByProps({ testID: 'treaty-send-offer' }).props.onPress();
    });

    expect(proposeTreaty).toHaveBeenCalledTimes(1);
    expect(proposeTreaty).toHaveBeenCalledWith(TARGET_FACTION, TARGET_TERRITORY);
    expect(tree.root.findAllByProps({ testID: 'treaty-send-offer' })).toHaveLength(0);
  });

  it('treaty offer shows visible selection state before submission', () => {
    const tree = renderDiplomacyScreen();
    openTreatyPicker(tree, TARGET_FACTION);

    expect(
      tree.root.findAllByProps({ testID: `treaty-territory-selected-${TARGET_TERRITORY}` }),
    ).toHaveLength(0);

    act(() => {
      tree.root.findByProps({ testID: `treaty-territory-row-${TARGET_TERRITORY}` }).props.onPress();
    });

    expect(
      tree.root.findByProps({ testID: `treaty-territory-selected-${TARGET_TERRITORY}` }),
    ).toBeTruthy();
    expect(proposeTreaty).not.toHaveBeenCalled();
  });

  it('send button only enables after selection', () => {
    const tree = renderDiplomacyScreen();
    openTreatyPicker(tree, TARGET_FACTION);

    const send = tree.root.findByProps({ testID: 'treaty-send-offer' });
    expect(send.props.disabled).toBe(true);

    act(() => {
      tree.root.findByProps({ testID: `treaty-territory-row-${TARGET_TERRITORY}` }).props.onPress();
    });

    expect(tree.root.findByProps({ testID: 'treaty-send-offer' }).props.disabled).toBe(false);
  });

  it('cancel button resets state without submitting', () => {
    const tree = renderDiplomacyScreen();
    openTreatyPicker(tree, TARGET_FACTION);

    act(() => {
      tree.root.findByProps({ testID: `treaty-territory-row-${TARGET_TERRITORY}` }).props.onPress();
    });

    act(() => {
      tree.root.findByProps({ testID: 'treaty-cancel-picker' }).props.onPress();
    });

    expect(proposeTreaty).not.toHaveBeenCalled();
    expect(tree.root.findAllByProps({ testID: 'treaty-send-offer' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: `treaty-territory-row-${TARGET_TERRITORY}` })).toHaveLength(
      0,
    );
  });
});

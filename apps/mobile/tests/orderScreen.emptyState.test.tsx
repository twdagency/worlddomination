import React, { act } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import TestRenderer from 'react-test-renderer';
import { createSprint4World, createTutorialWorld } from 'shared';
import { OrderScreen } from '../src/screens/OrderScreen';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => React.createElement('Ionicons', null),
}));

vi.mock('../src/game/GameContext', () => ({
  useGame: () => mockGameState,
}));

let mockGameState: {
  world: ReturnType<typeof createTutorialWorld>;
  confirmMove: ReturnType<typeof vi.fn>;
  actionFeedback: null;
  isTutorialActive: boolean;
  currentBeat: string | null;
};

beforeEach(() => {
  mockGameState = {
    world: createTutorialWorld(),
    confirmMove: vi.fn(),
    actionFeedback: null,
    isTutorialActive: true,
    currentBeat: 'movement',
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

function renderOrderScreen() {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<OrderScreen />);
  });
  return tree;
}

describe('OrderScreen empty states', () => {
  it('shows select-force copy when multiple forces and none selected', () => {
    const base = createSprint4World();
    const playerId = base.factions['faction-player']?.isPlayer
      ? 'faction-player'
      : Object.values(base.factions).find((f) => f.isPlayer)!.id;
    const world = {
      ...base,
      units: {
        ...base.units,
        'unit-player-second': {
          id: 'unit-player-second',
          typeId: 'levy-t1',
          ownerId: playerId,
          count: 1,
          locationId: 'territory-london',
          stance: 'defend' as const,
        },
      },
    };
    mockGameState.world = world;
    mockGameState.isTutorialActive = false;
    mockGameState.currentBeat = null;

    const tree = renderOrderScreen();
    const text = collectText(tree.root);
    expect(text).toContain('Select a force above to issue an order.');
  });

  it('shows cannot-move copy when force has no valid destinations', () => {
    const base = createTutorialWorld();
    const world = {
      ...base,
      territories: {
        'territory-london-tutorial': base.territories['territory-london-tutorial']!,
      },
    };
    mockGameState.world = world;
    mockGameState.isTutorialActive = true;
    mockGameState.currentBeat = 'movement';

    const tree = renderOrderScreen();
    const text = collectText(tree.root);
    expect(text).toContain('cannot move from');
    expect(text).toContain('no reachable territories');
  });
});

import React, { act } from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import TestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import { createSprint4World, resolvePlayerFactionId } from 'shared';
import { stampEvents } from 'sim';

const START_MS = 1_700_600_000_000;
import { DashboardScreen } from '../src/screens/DashboardScreen';
import {
  DASHBOARD_DISPATCHES_DIGEST_LIMIT,
  getDashboardDispatchesDigest,
} from '../src/game/playerView';
import { testSimEvent } from '../src/test/simEventFixtures';

const navigateMock = vi.hoisted(() => vi.fn());
const parentNavigateMock = vi.hoisted(() => vi.fn());

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => React.createElement('Ionicons', null),
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: navigateMock,
    getParent: () => ({ navigate: parentNavigateMock }),
  }),
  useRoute: () => ({ params: undefined, key: 'dispatches', name: 'Dispatches' }),
}));

const gameState = vi.hoisted(() => ({
  world: null as import('sim').WorldState | null,
  dispatches: [] as import('sim').SimEvent[],
}));

vi.mock('../src/game/GameContext', () => ({
  useGame: () => ({
    world: gameState.world ?? createSprint4World(START_MS),
    dispatches: gameState.dispatches,
    resolvePendingDilemma: vi.fn(),
    openDilemmaModal: vi.fn(),
  }),
}));

function findByTestId(root: ReactTestInstance, testId: string): ReactTestInstance | null {
  const matches = root.findAll(
    (node) => typeof node.props.testID === 'string' && node.props.testID === testId,
  );
  return matches[0] ?? null;
}

function renderDashboard() {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<DashboardScreen />);
  });
  return tree;
}

describe('dashboard layout', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    parentNavigateMock.mockReset();
    gameState.world = createSprint4World();
    gameState.dispatches = [];
  });

  it('places the dispatches card before country status and quick actions', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/screens/DashboardScreen.tsx'),
      'utf8',
    );
    const dispatchesAt = source.indexOf('<DispatchesCard');
    const countryAt = source.indexOf('<CountryStatusCard');
    const forcesAt = source.indexOf('<ActiveForcesCard');
    const quickAt = source.indexOf('<QuickActionsCard');

    expect(dispatchesAt).toBeGreaterThan(-1);
    expect(countryAt).toBeGreaterThan(dispatchesAt);
    expect(forcesAt).toBeGreaterThan(countryAt);
    expect(quickAt).toBeGreaterThan(forcesAt);
  });

  it('shows up to five digest items on the dispatches card', () => {
    const world = createSprint4World();
    const playerId = resolvePlayerFactionId(world)!;
    const { events } = stampEvents(world, Array.from({ length: 7 }, (_, index) =>
      testSimEvent({
        kind: 'battle',
        at: world.nowMs + index,
        territoryId: 'territory-paris',
        report: {
          narrative: `Battle ${index}`,
          attackerId: playerId,
          defenderId: 'faction-rome',
          attackerLosses: 0,
          defenderLosses: 1,
          attackerPower: 10,
          defenderPower: 8,
          winnerId: playerId,
        },
        importance: index < 2 ? 'high' : 'low',
      }),
    ));

    gameState.world = world;
    gameState.dispatches = events;

    const digest = getDashboardDispatchesDigest(world, events);
    expect(digest.length).toBe(DASHBOARD_DISPATCHES_DIGEST_LIMIT);

    const tree = renderDashboard();
    expect(findByTestId(tree.root, 'dashboard-dispatches-card')).not.toBeNull();
    expect(findByTestId(tree.root, 'dispatch-digest-test-event-2')).not.toBeNull();
  });

  it('navigates to a dispatch detail when a digest row is tapped', () => {
    const world = createSprint4World();
    const playerId = resolvePlayerFactionId(world)!;
    const { events } = stampEvents(world, [
      {
        ...testSimEvent({
          kind: 'battle',
          at: world.nowMs,
          territoryId: 'territory-paris',
          report: {
            narrative: 'Assault on Paris',
            attackerId: playerId,
            defenderId: 'faction-rome',
            attackerLosses: 0,
            defenderLosses: 1,
            attackerPower: 10,
            defenderPower: 8,
            winnerId: playerId,
          },
          importance: 'high',
        }),
        eventId: 'evt-battle-target',
      },
    ]);

    gameState.world = world;
    gameState.dispatches = events;

    const tree = renderDashboard();
    const row = findByTestId(tree.root, 'dispatch-digest-evt-battle-target');
    expect(row).not.toBeNull();

    act(() => {
      row!.props.onPress();
    });

    expect(navigateMock).toHaveBeenCalledWith('Dispatches', {
      dispatchId: 'evt-battle-target',
    });
  });

  it('navigates to the full dispatches feed from view all', () => {
    const world = createSprint4World();
    const playerId = resolvePlayerFactionId(world)!;
    const { events } = stampEvents(world, [
      {
        ...testSimEvent({
          kind: 'battle',
          at: world.nowMs,
          territoryId: 'territory-paris',
          report: {
            narrative: 'Assault on Paris',
            attackerId: playerId,
            defenderId: 'faction-rome',
            attackerLosses: 0,
            defenderLosses: 1,
            attackerPower: 10,
            defenderPower: 8,
            winnerId: playerId,
          },
          importance: 'high',
        }),
        eventId: 'evt-battle-view-all',
      },
    ]);

    gameState.world = world;
    gameState.dispatches = events;

    const tree = renderDashboard();
    const viewAll = findByTestId(tree.root, 'dispatches-view-all');
    expect(viewAll).not.toBeNull();

    act(() => {
      viewAll!.props.onPress();
    });

    expect(navigateMock).toHaveBeenCalledWith('Dispatches', undefined);
  });
});

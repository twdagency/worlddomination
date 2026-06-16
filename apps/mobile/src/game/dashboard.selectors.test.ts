import { describe, expect, it } from 'vitest';
import { createSprint4World } from 'shared';
import type { SimEvent } from 'sim';
import { resolvePlayerFactionId } from 'shared';
import {
  DASHBOARD_AWAY_COLLAPSE_MS,
  getDashboardCatchUpSummary,
  getDashboardEmpireSummary,
  getDashboardNavCards,
  getDashboardUrgentCount,
} from '../game/playerView';

const START_MS = 1_700_000_000_000;

function sprint4PlayerId(): string {
  return resolvePlayerFactionId(createSprint4World(START_MS))!;
}

describe('dashboard catch-up selector', () => {
  it('collapses to current status when away duration is under one game-hour', () => {
    const world = createSprint4World(START_MS);
    const summary = getDashboardCatchUpSummary(world, [], DASHBOARD_AWAY_COLLAPSE_MS - 1);

    expect(summary.mode).toBe('current');
    expect(summary.totalCount).toBe(0);
  });

  it('categorizes visibility-gated events by importance metadata', () => {
    const world = createSprint4World(START_MS + 6 * 3_600_000);
    const awayMs = 6 * 3_600_000;
    const events: SimEvent[] = [
      {
        kind: 'allianceProposed',
        at: START_MS + 2 * 3_600_000,
        proposalId: 'proposal-catchup',
        from: 'faction-rome',
        to: sprint4PlayerId(),
        expiresAt: START_MS + 50 * 3_600_000,
        beatId: 'beat-test',
        decisionTickMs: START_MS + 2 * 3_600_000,
        importance: 'high',
      },
      {
        kind: 'buildStarted',
        at: START_MS + 3 * 3_600_000,
        territoryId: 'territory-london',
        factionId: sprint4PlayerId(),
        unitTypeId: 'levy-t1',
        count: 1,
        intent: 'build',
        source: 'direct',
        beatId: 'beat-build',
        decisionTickMs: START_MS + 3 * 3_600_000,
        importance: 'medium',
      },
      {
        kind: 'income',
        at: START_MS + 4 * 3_600_000,
        funding: 100,
        resourcesByTerritory: {},
        importance: 'low',
      },
    ];

    const summary = getDashboardCatchUpSummary(world, events, awayMs);

    expect(summary.mode).toBe('away');
    expect(summary.critical).toHaveLength(1);
    expect(summary.notableCount).toBe(1);
    expect(summary.routineCount).toBe(1);
    expect(summary.totalCount).toBe(3);
  });

  it('filters out events the player cannot see', () => {
    const world = createSprint4World(START_MS + 3_600_000);
    const events: SimEvent[] = [
      {
        kind: 'intelReport',
        at: START_MS + 1_800_000,
        observerFaction: 'faction-rome',
        receiverFaction: 'faction-rome',
        territoryId: 'territory-paris',
        source: 'direct',
        variant: 'activity',
        intent: 'attack',
        beatId: 'beat-hidden',
        decisionTickMs: START_MS + 1_800_000,
        importance: 'high',
      },
    ];

    const summary = getDashboardCatchUpSummary(world, events, 3_600_000);
    expect(summary.critical).toHaveLength(0);
    expect(summary.totalCount).toBe(0);
  });
});

describe('dashboard empire summary selector', () => {
  it('returns glance-readable empire state for the player faction', () => {
    const world = createSprint4World(START_MS);
    const summary = getDashboardEmpireSummary(world);

    expect(summary).not.toBeNull();
    expect(summary?.leaderName).toBe('Elizabeth');
    expect(summary?.territoryNames).toContain('London');
    expect(summary?.funding).toBeGreaterThan(0);
    expect(summary?.era).toBe('Early Modern');
    expect(summary?.gameDay).toBe(world.day);
  });
});

describe('dashboard navigation cards', () => {
  it('surfaces diplomacy badge when proposals are pending', () => {
    const world = {
      ...createSprint4World(START_MS),
      pendingProposals: [
        {
          id: 'proposal-test',
          from: 'faction-rome',
          to: sprint4PlayerId(),
          type: 'alliance' as const,
          proposedAt: START_MS,
          expiresAt: START_MS + 48 * 3_600_000,
        },
      ],
    };
    const cards = getDashboardNavCards(world, []);
    const diplomacy = cards.find((card) => card.screen === 'Diplomacy');

    expect(diplomacy?.badgeCount).toBe(1);
    expect(getDashboardUrgentCount(world, [])).toBe(1);
  });
});

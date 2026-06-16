import { describe, expect, it } from 'vitest';
import { createSprint4World, resolvePlayerFactionId } from 'shared';
import type { SimEvent } from 'sim';
import { testSimEvent } from '../test/simEventFixtures';
import { getDashboardUrgentItems } from '../game/playerView';

const START_MS = 1_700_000_000_000;
const playerId = () => resolvePlayerFactionId(createSprint4World(START_MS))!;

describe('dashboard urgent item prioritization', () => {
  it('ranks incoming proposals above build blockers', () => {
    const world = {
      ...createSprint4World(START_MS),
      territories: {
        ...createSprint4World(START_MS).territories,
        'territory-london': {
          ...createSprint4World(START_MS).territories['territory-london'],
          resources: { food: 5 },
          buildQueue: [
            {
              unitTypeId: 'levy-t1',
              count: 1,
              startMs: START_MS,
              durationMs: 12 * 3_600_000,
            },
          ],
        },
      },
      pendingProposals: [
        {
          id: 'proposal-urgent',
          from: 'faction-rome',
          to: playerId(),
          type: 'alliance' as const,
          proposedAt: START_MS,
          expiresAt: START_MS + 4 * 3_600_000,
        },
      ],
    };

    const items = getDashboardUrgentItems(world, []);

    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items[0]?.kind).toBe('alliance-proposal');
    expect(items.some((item) => item.kind === 'build-blocker')).toBe(true);
  });

  it('includes crisis events within the recent window', () => {
    const world = createSprint4World(START_MS + 3_600_000);
    const events: SimEvent[] = [
      testSimEvent({
        kind: 'battle',
        at: START_MS + 2 * 3_600_000,
        territoryId: 'territory-paris',
        report: {
          narrative: 'Heavy fighting at Paris',
          attackerId: playerId(),
          defenderId: 'faction-rome',
          attackerLosses: 1,
          defenderLosses: 2,
          attackerPower: 10,
          defenderPower: 8,
          winnerId: playerId(),
        },
        importance: 'high',
      }),
    ];

    const items = getDashboardUrgentItems(world, events);
    expect(items.some((item) => item.kind === 'crisis')).toBe(true);
    expect(items.find((item) => item.kind === 'crisis')?.navigation.screen).toBe('Dispatches');
  });

  it('returns navigation targets for diplomacy and territory items', () => {
    const world = {
      ...createSprint4World(START_MS),
      pendingProposals: [
        {
          id: 'proposal-nav',
          from: 'faction-steppe',
          to: playerId(),
          type: 'treaty' as const,
          scope: { territoryIds: ['territory-berlin'] },
          proposedAt: START_MS,
          expiresAt: START_MS + 24 * 3_600_000,
        },
      ],
    };

    const [first] = getDashboardUrgentItems(world, []);
    expect(first?.navigation).toEqual({
      screen: 'Diplomacy',
      factionId: 'faction-steppe',
    });
  });
});
